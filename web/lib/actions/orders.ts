"use server";

// Suivi de commandes + collecte d'avis post-achat (addendum au plan de
// migration). Trois de ces actions n'appellent PAS verifyAdminSession — c'est
// le seul endroit du code où c'est le cas, et c'est intentionnel : elles sont
// appelées depuis /avis/[token], une page publique sans compte client. Leur
// sécurité repose sur le reviewToken (crypto.randomUUID(), 122 bits d'entropie,
// à usage unique) plutôt que sur une session — jamais sur une vérification côté
// navigateur (CLAUDE.md §12).
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { verifyAdminSession, verifyCustomerSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { signUpload } from "@/lib/cloudinary";
import { SQUARE_TRANSFORMATION } from "@/lib/cloudinaryTransforms";
import type { UploadSignature } from "@/lib/actions/upload";
import type { LiveLocation, Order, OrderItem, Product, TestimonialSubmission } from "@/lib/types";

// Champs de paiement par défaut pour une commande qui ne passe pas par
// CamPay (WhatsApp/admin) — payée à la livraison comme aujourd'hui, hors
// suivi CamPay. Voir addendum 3.
const UNPAID_PAYMENT_FIELDS = {
  paymentStatus: "unpaid" as const,
  paymentReference: null,
  campayReference: null,
  ussdCode: null,
  paidAt: null,
  paymentFailureReason: null,
};

// Le bouton « Commander sur WhatsApp » (CartPanel) n'est pas désactivé après
// coup et le panier n'est pas vidé — un client peut vouloir rouvrir WhatsApp
// s'il a fermé l'onglet par erreur, donc recliquer. Sans garde, chaque clic
// recrée une commande ET redécompte le stock pour le même panier (repéré en
// admin : plusieurs lignes identiques pour le même client, quelques secondes
// d'écart). Une commande identique (mêmes articles) du même client créée
// dans cette fenêtre est considérée comme le même clic répété.
const DUPLICATE_ORDER_WINDOW_MS = 90 * 1000;

function itemsSignature(items: OrderItem[]): string {
  return items
    .map((item) => `${item.slug}:${item.size}:${item.qty}`)
    .sort()
    .join("|");
}

// Décompte le stock au moment où la vente est enregistrée (pas à la
// livraison) : « j'achète les 8 derniers, le stock passe direct en rupture »
// — sinon un deuxième client pourrait commander le même article pendant que
// le premier est encore en cours de livraison. Toutes les lectures d'abord,
// puis toutes les écritures (règle des transactions Firestore, voir
// lib/paymentHelpers.ts qui suit déjà ce principe pour CamPay).
async function decrementStockForItems(items: OrderItem[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!items.length) return { ok: true };

  try {
    await adminDb.runTransaction(async (tx) => {
      const refs = items.map((item) => adminDb.collection("products").doc(item.slug));
      const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

      for (let i = 0; i < items.length; i++) {
        const snap = snaps[i];
        if (!snap.exists) throw new Error(`Article introuvable : ${items[i].slug}.`);
        const product = snap.data() as Product;
        if (product.stock < items[i].qty) {
          throw new Error(`Stock insuffisant pour ${product.name} (${product.stock} restant(s)).`);
        }
      }
      for (let i = 0; i < items.length; i++) {
        const product = snaps[i].data() as Product;
        tx.update(refs[i], { stock: product.stock - items[i].qty });
      }
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Stock insuffisant." };
  }

  return { ok: true };
}

async function findOrderByToken(
  token: string,
  field: "reviewToken" | "locationToken" | "courierLocationToken" = "reviewToken"
): Promise<(Order & { id: string }) | null> {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return null;
  const snap = await adminDb.collection("orders").where(field, "==", cleanToken).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Order, "id">) };
}

// Qui livre varie (Djimi lui-même ou une aide ponctuelle, CLAUDE.md) — deux
// canaux de partage de position séparés, même mécanique, jamais mélangés.
export type LocationRole = "customer" | "courier";

function locationFields(role: LocationRole) {
  return role === "courier"
    ? {
        token: "courierLocationToken" as const,
        sharing: "courierLocationSharing" as const,
        live: "courierLiveLocation" as const,
        points: "courierLocationPoints",
      }
    : {
        token: "locationToken" as const,
        sharing: "locationSharing" as const,
        live: "liveLocation" as const,
        points: "locationPoints",
      };
}

// Le rôle n'est jamais affirmé par l'appelant : on le déduit du champ que le
// jeton fait correspondre (client ou livreur), donc personne ne peut se
// faire passer pour l'autre juste en changeant un paramètre.
async function findOrderByEitherLocationToken(
  token: string
): Promise<{ order: Order & { id: string }; role: LocationRole } | null> {
  const byCustomer = await findOrderByToken(token, "locationToken");
  if (byCustomer) return { order: byCustomer, role: "customer" };
  const byCourier = await findOrderByToken(token, "courierLocationToken");
  if (byCourier) return { order: byCourier, role: "courier" };
  return null;
}

// --- Admin (verifyAdminSession) ---------------------------------------

export interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  orderSummary: string;
  address?: string;
  items?: OrderItem[];
}

export async function createOrderAction(
  input: CreateOrderInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await verifyAdminSession();

  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.replace(/\D/g, "");
  const orderSummary = input.orderSummary.trim();
  const items = (input.items || []).filter((item) => item.slug && item.qty > 0);

  if (!customerName) return { ok: false, error: "Le nom du client est obligatoire." };
  if (customerPhone.length < 8 || customerPhone.length > 15) {
    return { ok: false, error: "Le numéro WhatsApp doit contenir 8 à 15 chiffres." };
  }
  if (!orderSummary) return { ok: false, error: "Décrivez le contenu de la commande." };

  // Facultatif : sans articles renseignés, la commande est enregistrée comme
  // avant (juste un résumé libre), sans toucher au stock — on ne décompte
  // que ce qu'on sait précisément avoir vendu.
  if (items.length) {
    const stockResult = await decrementStockForItems(items);
    if (!stockResult.ok) return stockResult;
  }

  const ref = await adminDb.collection("orders").add({
    customerName,
    customerPhone,
    orderSummary,
    address: input.address?.trim() || null,
    ...(items.length ? { items } : {}),
    locationToken: null,
    locationSharing: false,
    liveLocation: null,
    courierLocationToken: null,
    courierLocationSharing: false,
    courierLiveLocation: null,
    status: "confirmee",
    createdAt: new Date().toISOString(),
    deliveredAt: null,
    reviewToken: null,
    reviewSubmitted: false,
    uid: null,
    ...UNPAID_PAYMENT_FIELDS,
  });

  if (items.length) {
    revalidatePath("/boutique");
    revalidatePath("/");
    for (const item of items) revalidatePath(`/produits/${item.slug}`);
  }

  return { ok: true, id: ref.id };
}

// Léger, exprès : l'adresse/zone est souvent connue seulement après coup (la
// négociation continue sur WhatsApp après l'enregistrement de la commande),
// donc une action à part plutôt que de forcer sa saisie à la création.
export async function updateOrderAddressAction(
  id: string,
  address: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();

  const ref = adminDb.collection("orders").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };

  await ref.update({ address: address.trim() || null });
  return { ok: true };
}

// --- Client connecté (verifyCustomerSession) ----------------------------

export interface CreateCustomerOrderInput {
  items: OrderItem[];
  orderSummary: string;
  total: number;
}

// Appelée depuis CartPanel au clic sur « Commander sur WhatsApp », en plus de
// l'ouverture du lien wa.me (jamais à la place) — voir l'addendum 2. Best
// effort : si ça échoue, la commande WhatsApp reste le canal qui compte,
// l'appelant n'affiche pas d'erreur au client pour ça.
export async function createCustomerOrderAction(
  input: CreateCustomerOrderInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await verifyCustomerSession();

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "Panier vide." };
  }

  const profileSnap = await adminDb.collection("customers").doc(session.uid).get();
  if (!profileSnap.exists) return { ok: false, error: "Profil introuvable." };
  const profile = profileSnap.data() as { name: string; phone: string };

  const signature = itemsSignature(input.items);
  const existingSnap = await adminDb.collection("orders").where("uid", "==", session.uid).get();
  const duplicate = existingSnap.docs.find((d) => {
    const o = d.data() as Order;
    return (
      Array.isArray(o.items) &&
      itemsSignature(o.items) === signature &&
      Date.now() - new Date(o.createdAt).getTime() < DUPLICATE_ORDER_WINDOW_MS
    );
  });
  if (duplicate) return { ok: true, id: duplicate.id };

  const stockResult = await decrementStockForItems(input.items);
  if (!stockResult.ok) return stockResult;

  const ref = await adminDb.collection("orders").add({
    customerName: profile.name,
    customerPhone: profile.phone,
    orderSummary: input.orderSummary.trim(),
    address: null,
    locationToken: null,
    locationSharing: false,
    liveLocation: null,
    courierLocationToken: null,
    courierLocationSharing: false,
    courierLiveLocation: null,
    items: input.items,
    total: input.total,
    status: "confirmee",
    createdAt: new Date().toISOString(),
    deliveredAt: null,
    reviewToken: null,
    reviewSubmitted: false,
    uid: session.uid,
    ...UNPAID_PAYMENT_FIELDS,
  });

  revalidatePath("/boutique");
  revalidatePath("/");
  for (const item of input.items) revalidatePath(`/produits/${item.slug}`);

  return { ok: true, id: ref.id };
}

export async function markOrderDeliveredAction(
  id: string
): Promise<{ ok: true; reviewToken: string } | { ok: false; error: string }> {
  await verifyAdminSession();

  const ref = adminDb.collection("orders").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };

  const order = snap.data() as Order;
  const reviewToken = order.reviewToken || randomUUID();
  await ref.update({
    status: "livree",
    deliveredAt: order.deliveredAt || new Date().toISOString(),
    reviewToken,
    // La livraison est faite, plus besoin de suivre la position — évite
    // qu'un onglet resté ouvert continue de remonter des positions inutiles.
    locationSharing: false,
    courierLocationSharing: false,
  });

  return { ok: true, reviewToken };
}

// Léger, sur le même principe que reviewToken : un identifiant à usage
// dédié (pas de session client requise) pour la page publique de partage de
// position, envoyée par WhatsApp comme le lien d'avis.
export async function getOrCreateLocationTokenAction(
  id: string,
  role: LocationRole = "customer"
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  await verifyAdminSession();

  const fields = locationFields(role);
  const ref = adminDb.collection("orders").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };

  const order = snap.data() as Order;
  const existing = order[fields.token];
  const token = existing || randomUUID();
  if (!existing) await ref.update({ [fields.token]: token });

  return { ok: true, token };
}

export async function getOrderLocationAction(
  id: string,
  role: LocationRole = "customer"
): Promise<{ ok: true; locationSharing: boolean; liveLocation: LiveLocation } | { ok: false; error: string }> {
  await verifyAdminSession();

  const fields = locationFields(role);
  const snap = await adminDb.collection("orders").doc(id).get();
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };
  const order = snap.data() as Order;

  return { ok: true, locationSharing: order[fields.sharing], liveLocation: order[fields.live] };
}

export async function approveTestimonialSubmissionAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();

  const ref = adminDb.collection("testimonialSubmissions").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Cette soumission n'existe plus." };
  const submission = snap.data() as TestimonialSubmission;

  const existing = await adminDb.collection("testimonials").orderBy("order").get();
  await adminDb.collection("testimonials").add({
    name: submission.name,
    designation: submission.designation,
    quote: submission.quote,
    photoUrl: submission.photoUrl,
    order: existing.size,
  });
  await ref.delete();

  revalidatePath("/");
  revalidatePath("/phototheque");

  return { ok: true };
}

export async function rejectTestimonialSubmissionAction(id: string): Promise<{ ok: true }> {
  await verifyAdminSession();
  await adminDb.collection("testimonialSubmissions").doc(id).delete();
  return { ok: true };
}

// --- Public, gardées par reviewToken (aucune session) ------------------

export async function getOrderForReviewAction(
  token: string
): Promise<{ ok: true; customerName: string } | { ok: false; error: string }> {
  const order = await findOrderByToken(token);
  if (!order) return { ok: false, error: "Ce lien n'est pas valide." };
  if (order.status !== "livree") {
    return { ok: false, error: "Cette commande n'est pas encore marquée comme livrée." };
  }
  if (order.reviewSubmitted) {
    return { ok: false, error: "Un avis a déjà été envoyé avec ce lien. Merci, il est en cours de vérification !" };
  }
  return { ok: true, customerName: order.customerName };
}

export async function getReviewUploadSignatureAction(
  token: string
): Promise<UploadSignature | { ok: false; error: string }> {
  const order = await findOrderByToken(token);
  if (!order || order.status !== "livree" || order.reviewSubmitted) {
    return { ok: false, error: "Ce lien n'est plus valide." };
  }

  const folder = "le-maillot-ideal/testimonials";
  const publicId = `soumission-${order.id}`;
  const signed = signUpload({ folder, public_id: publicId, transformation: SQUARE_TRANSFORMATION });

  return {
    timestamp: signed.timestamp,
    signature: signed.signature,
    apiKey: signed.apiKey!,
    cloudName: signed.cloudName!,
    folder,
    publicId,
    transformation: SQUARE_TRANSFORMATION,
  };
}

export interface SubmitTestimonialInput {
  name: string;
  designation: string;
  quote: string;
  photoUrl: string;
}

export async function submitTestimonialAction(
  token: string,
  input: SubmitTestimonialInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.name.trim();
  const designation = input.designation.trim();
  const quote = input.quote.trim();
  const photoUrl = input.photoUrl.trim();
  const cleanToken = String(token || "").trim();

  if (!cleanToken) return { ok: false, error: "Lien invalide." };
  if (!name) return { ok: false, error: "Le nom est obligatoire." };
  if (!quote) return { ok: false, error: "Merci d'écrire quelques mots sur votre expérience." };

  try {
    // Transaction : re-vérifie reviewSubmitted au moment de l'écriture, pas
    // seulement à l'ouverture de la page — empêche une double soumission si le
    // même lien est ouvert deux fois (deux onglets, lien réutilisé).
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(adminDb.collection("orders").where("reviewToken", "==", cleanToken).limit(1));
      if (snap.empty) throw new Error("invalid");
      const orderDoc = snap.docs[0];
      const order = orderDoc.data() as Order;
      if (order.status !== "livree" || order.reviewSubmitted) throw new Error("invalid");

      const submissionRef = adminDb.collection("testimonialSubmissions").doc();
      tx.set(submissionRef, {
        orderId: orderDoc.id,
        name,
        designation,
        quote,
        photoUrl,
        submittedAt: new Date().toISOString(),
      });
      tx.update(orderDoc.ref, { reviewSubmitted: true });
    });
  } catch {
    return { ok: false, error: "Ce lien n'est plus valide — il a peut-être déjà servi." };
  }

  return { ok: true };
}

// --- Public, gardées par locationToken/courierLocationToken (aucune session) ---
// Partage de position en direct pendant la livraison, client ET livreur —
// même mécanique dupliquée sur deux canaux (voir locationFields ci-dessus).
// Même principe de sécurité que le dépôt d'avis : un jeton à usage dédié,
// jamais une session. `liveLocation`/`courierLiveLocation` sur la commande
// gardent la dernière position (lecture rapide, pas de requête sur la
// sous-collection pour l'affichage courant) ; chaque mise à jour est aussi
// ajoutée à la sous-collection correspondante (orders/{id}/locationPoints ou
// .../courierLocationPoints) pour reconstituer le trajet — fermées en
// lecture/écriture côté client comme le reste (aucune règle explicite dans
// firestore.rules ⇒ retombe sur le catch-all `allow read, write: if false`),
// donc uniquement via ces Server Actions (Admin SDK).

export async function getOrderForLocationAction(token: string): Promise<
  | { ok: true; customerName: string; sharing: boolean; role: LocationRole }
  | { ok: false; error: string }
> {
  const found = await findOrderByEitherLocationToken(token);
  if (!found) return { ok: false, error: "Ce lien n'est pas valide." };
  const { order, role } = found;
  if (order.status !== "confirmee") {
    return { ok: false, error: "Cette commande n'est plus en attente de livraison." };
  }
  const fields = locationFields(role);
  return { ok: true, customerName: order.customerName, sharing: order[fields.sharing], role };
}

export async function updateLiveLocationAction(
  token: string,
  lat: number,
  lng: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const found = await findOrderByEitherLocationToken(token);
  if (!found) return { ok: false, error: "Lien invalide." };
  const { order, role } = found;
  if (order.status !== "confirmee") return { ok: false, error: "Livraison déjà terminée." };

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, error: "Position invalide." };
  }

  const fields = locationFields(role);
  const at = new Date().toISOString();
  const orderRef = adminDb.collection("orders").doc(order.id);
  await Promise.all([
    orderRef.update({ [fields.sharing]: true, [fields.live]: { lat, lng, updatedAt: at } }),
    orderRef.collection(fields.points).add({ lat, lng, at }),
  ]);

  return { ok: true };
}

export async function stopLocationSharingAction(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const found = await findOrderByEitherLocationToken(token);
  if (!found) return { ok: false, error: "Lien invalide." };
  const fields = locationFields(found.role);

  await adminDb.collection("orders").doc(found.order.id).update({ [fields.sharing]: false });
  return { ok: true };
}

export interface LocationPoint {
  lat: number;
  lng: number;
  at: string;
}

export async function getOrderLocationHistoryAction(
  id: string,
  role: LocationRole = "customer"
): Promise<
  | { ok: true; locationSharing: boolean; liveLocation: LiveLocation; points: LocationPoint[] }
  | { ok: false; error: string }
> {
  await verifyAdminSession();

  const fields = locationFields(role);
  const orderRef = adminDb.collection("orders").doc(id);
  const [snap, pointsSnap] = await Promise.all([
    orderRef.get(),
    orderRef.collection(fields.points).orderBy("at", "asc").get(),
  ]);
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };
  const order = snap.data() as Order;
  const points = pointsSnap.docs.map((d) => d.data() as LocationPoint);

  return { ok: true, locationSharing: order[fields.sharing], liveLocation: order[fields.live], points };
}

export interface SharedTrack {
  points: LocationPoint[];
  current: LiveLocation;
  sharing: boolean;
}

// Vue publique, gardée par jeton (pas de session admin) : le client ET le
// livreur doivent tous les deux pouvoir voir où en est l'autre, pas
// seulement l'admin — n'importe lequel des deux jetons de la même commande
// donne accès aux DEUX pistes (c'est le but : se retrouver mutuellement),
// jamais à une autre commande.
export async function getSharedLocationViewAction(
  token: string
): Promise<{ ok: true; customer: SharedTrack; courier: SharedTrack } | { ok: false; error: string }> {
  const found = await findOrderByEitherLocationToken(token);
  if (!found) return { ok: false, error: "Lien invalide." };
  const { order } = found;

  const [customerPoints, courierPoints] = await Promise.all([
    adminDb.collection("orders").doc(order.id).collection("locationPoints").orderBy("at", "asc").get(),
    adminDb.collection("orders").doc(order.id).collection("courierLocationPoints").orderBy("at", "asc").get(),
  ]);

  return {
    ok: true,
    customer: {
      points: customerPoints.docs.map((d) => d.data() as LocationPoint),
      current: order.liveLocation,
      sharing: order.locationSharing,
    },
    courier: {
      points: courierPoints.docs.map((d) => d.data() as LocationPoint),
      current: order.courierLiveLocation,
      sharing: order.courierLocationSharing,
    },
  };
}
