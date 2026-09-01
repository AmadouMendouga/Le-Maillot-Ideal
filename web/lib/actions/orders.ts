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
import type { Order, OrderItem, Product, TestimonialSubmission } from "@/lib/types";

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
  field: "reviewToken" | "locationToken" = "reviewToken"
): Promise<(Order & { id: string }) | null> {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return null;
  const snap = await adminDb.collection("orders").where(field, "==", cleanToken).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Order, "id">) };
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
  });

  return { ok: true, reviewToken };
}

// Léger, sur le même principe que reviewToken : un identifiant à usage
// dédié (pas de session client requise) pour la page publique de partage de
// position, envoyée par WhatsApp comme le lien d'avis.
export async function getOrCreateLocationTokenAction(
  id: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  await verifyAdminSession();

  const ref = adminDb.collection("orders").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };

  const order = snap.data() as Order;
  const token = order.locationToken || randomUUID();
  if (!order.locationToken) await ref.update({ locationToken: token });

  return { ok: true, token };
}

export async function getOrderLocationAction(
  id: string
): Promise<
  | { ok: true; locationSharing: boolean; liveLocation: Order["liveLocation"] }
  | { ok: false; error: string }
> {
  await verifyAdminSession();

  const snap = await adminDb.collection("orders").doc(id).get();
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };
  const order = snap.data() as Order;

  return { ok: true, locationSharing: order.locationSharing, liveLocation: order.liveLocation };
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

// --- Public, gardées par locationToken (aucune session) -----------------
// Partage de position en direct pendant la livraison. Même principe de
// sécurité que le dépôt d'avis : un jeton à usage dédié, jamais une session.
// `liveLocation` sur la commande garde la dernière position (lecture rapide,
// pas de requête sur la sous-collection pour l'affichage courant) ; chaque
// mise à jour est aussi ajoutée à la sous-collection orders/{id}/locationPoints
// pour reconstituer le trajet — fermée en lecture/écriture côté client comme
// le reste (aucune règle explicite dans firestore.rules ⇒ retombe sur le
// catch-all `allow read, write: if false`), donc uniquement via ces Server
// Actions (Admin SDK).

export async function getOrderForLocationAction(
  token: string
): Promise<{ ok: true; customerName: string; sharing: boolean } | { ok: false; error: string }> {
  const order = await findOrderByToken(token, "locationToken");
  if (!order) return { ok: false, error: "Ce lien n'est pas valide." };
  if (order.status !== "confirmee") {
    return { ok: false, error: "Cette commande n'est plus en attente de livraison." };
  }
  return { ok: true, customerName: order.customerName, sharing: order.locationSharing };
}

export async function updateLiveLocationAction(
  token: string,
  lat: number,
  lng: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await findOrderByToken(token, "locationToken");
  if (!order) return { ok: false, error: "Lien invalide." };
  if (order.status !== "confirmee") return { ok: false, error: "Livraison déjà terminée." };

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, error: "Position invalide." };
  }

  const at = new Date().toISOString();
  const orderRef = adminDb.collection("orders").doc(order.id);
  await Promise.all([
    orderRef.update({ locationSharing: true, liveLocation: { lat, lng, updatedAt: at } }),
    orderRef.collection("locationPoints").add({ lat, lng, at }),
  ]);

  return { ok: true };
}

export async function stopLocationSharingAction(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await findOrderByToken(token, "locationToken");
  if (!order) return { ok: false, error: "Lien invalide." };

  await adminDb.collection("orders").doc(order.id).update({ locationSharing: false });
  return { ok: true };
}

export interface LocationPoint {
  lat: number;
  lng: number;
  at: string;
}

export async function getOrderLocationHistoryAction(
  id: string
): Promise<
  | { ok: true; locationSharing: boolean; liveLocation: Order["liveLocation"]; points: LocationPoint[] }
  | { ok: false; error: string }
> {
  await verifyAdminSession();

  const orderRef = adminDb.collection("orders").doc(id);
  const [snap, pointsSnap] = await Promise.all([
    orderRef.get(),
    orderRef.collection("locationPoints").orderBy("at", "asc").get(),
  ]);
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };
  const order = snap.data() as Order;
  const points = pointsSnap.docs.map((d) => d.data() as LocationPoint);

  return { ok: true, locationSharing: order.locationSharing, liveLocation: order.liveLocation, points };
}
