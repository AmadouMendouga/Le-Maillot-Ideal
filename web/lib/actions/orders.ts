"use server";

// Suivi de commandes + collecte d'avis post-achat (addendum au plan de
// migration). Trois de ces actions n'appellent PAS verifyAdminSession — c'est
// le seul endroit du code où c'est le cas, et c'est intentionnel : elles sont
// appelées depuis /avis/[token], une page publique sans compte client. Leur
// sécurité repose sur le reviewToken (crypto.randomUUID(), 122 bits d'entropie,
// à usage unique) plutôt que sur une session — jamais sur une vérification côté
// navigateur (CLAUDE.md §12).
import { createHash, randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { verifyAdminSession, verifyCustomerSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { decrementQuotedStock, loadInventoryQuote } from "@/lib/orderInventory";
import { validateOrderItems } from "@/lib/orderValidation";
import { hasUsableAccuracy, MAX_TRACK_POINTS, shouldAppendTrackPoint } from "@/lib/location";
import { signUpload } from "@/lib/cloudinary";
import { SQUARE_TRANSFORMATION } from "@/lib/cloudinaryTransforms";
import {
  canGenerateTrackingLink,
  canUpdateLiveLocation,
  normalizeOrderStatus,
  TERMINAL_ORDER_STATUSES,
} from "@/lib/orderWorkflow";
import type { UploadSignature } from "@/lib/actions/upload";
import type { DeliveryIncidentType, LiveLocation, Order, OrderItem, OrderStatus, TestimonialSubmission } from "@/lib/types";

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

// Code à 4 chiffres, montré au client, demandé par le livreur avant de
// pouvoir clôturer la livraison — confirme qu'il a bien trouvé le bon
// client, sans caméra ni scan (voir markOrderDeliveredByCourierAction).
function generateDeliveryCode(): string {
  return String(randomInt(1000, 10000));
}

function locationHistoryPurgeDueAt(from: Date): string {
  return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function trackingTokenExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

class OrderInputError extends Error {}

function customerOrderDocumentId(uid: string, requestId: string): string {
  return `whatsapp-${createHash("sha256").update(`${uid}:${requestId}`).digest("hex").slice(0, 40)}`;
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
        expires: "courierLocationTokenExpiresAt" as const,
        sharing: "courierLocationSharing" as const,
        live: "courierLiveLocation" as const,
        points: "courierLocationPoints",
      }
    : {
        token: "locationToken" as const,
        expires: "locationTokenExpiresAt" as const,
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
  if (byCustomer && (!byCustomer.locationTokenExpiresAt || Date.parse(byCustomer.locationTokenExpiresAt) > Date.now())) {
    return { order: byCustomer, role: "customer" };
  }
  const byCourier = await findOrderByToken(token, "courierLocationToken");
  if (byCourier) {
    if (byCourier.courierLocationTokenExpiresAt && Date.parse(byCourier.courierLocationTokenExpiresAt) <= Date.now()) return null;
    if (byCourier.assignedCourierId) {
      const courier = await adminDb.collection("couriers").doc(byCourier.assignedCourierId).get();
      if (!courier.exists || courier.data()?.active !== true) return null;
    }
    return { order: byCourier, role: "courier" };
  }
  return null;
}

// --- Admin (verifyAdminSession) ---------------------------------------

export interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  orderSummary: string;
  address?: string;
  deliverySlot?: string;
  items?: OrderItem[];
}

export async function createOrderAction(
  input: CreateOrderInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await verifyAdminSession();

  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.replace(/\D/g, "");
  const orderSummary = input.orderSummary.trim();
  const rawItems = input.items || [];
  const validated = rawItems.length ? validateOrderItems(rawItems) : { ok: true as const, items: [] as OrderItem[] };

  if (!customerName) return { ok: false, error: "Le nom du client est obligatoire." };
  if (customerPhone.length < 8 || customerPhone.length > 15) {
    return { ok: false, error: "Le numéro WhatsApp doit contenir 8 à 15 chiffres." };
  }
  if (!orderSummary) return { ok: false, error: "Décrivez le contenu de la commande." };
  if (!validated.ok) return validated;
  const items = validated.items;

  const ref = adminDb.collection("orders").doc();
  const baseOrder = {
    customerName,
    customerPhone,
    orderSummary,
    address: input.address?.trim() || null,
    locationToken: null,
    locationTokenExpiresAt: null,
    locationSharing: false,
    liveLocation: null,
    courierLocationToken: null,
    courierLocationTokenExpiresAt: null,
    courierLocationSharing: false,
    courierLiveLocation: null,
    deliveryCode: generateDeliveryCode(),
    status: "confirmee",
    createdAt: new Date().toISOString(),
    statusUpdatedAt: new Date().toISOString(),
    deliverySlot: input.deliverySlot?.trim().slice(0, 120) || null,
    deliveredAt: null,
    reviewToken: null,
    reviewSubmitted: false,
    uid: null,
    ...UNPAID_PAYMENT_FIELDS,
  };

  try {
    if (items.length) {
      await adminDb.runTransaction(async (tx) => {
        const inventory = await loadInventoryQuote(tx, items);
        if (!inventory.ok) throw new OrderInputError(inventory.error);
        decrementQuotedStock(tx, inventory.quote);
        tx.set(ref, { ...baseOrder, items: inventory.quote.items, total: inventory.quote.total });
      });
    } else {
      await ref.set(baseOrder);
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Impossible d'enregistrer la commande." };
  }

  if (items.length) revalidatePath("/", "layout");

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
  /** Stable pour un même clic/réessai : rend création de commande et stock idempotents. */
  requestId: string;
  /** Conservés optionnels pour les anciens clients, mais toujours ignorés côté serveur. */
  orderSummary?: string;
  total?: number;
}

// Appelée depuis CartPanel au clic sur « Commander sur WhatsApp », en plus de
// l'ouverture du lien wa.me (jamais à la place) — voir l'addendum 2. Best
// effort : si ça échoue, la commande WhatsApp reste le canal qui compte,
// l'appelant n'affiche pas d'erreur au client pour ça.
export async function createCustomerOrderAction(
  input: CreateCustomerOrderInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await verifyCustomerSession();

  if (!input || !Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "Panier vide." };
  }
  const requestId = String(input.requestId || "").trim();
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestId)) {
    return { ok: false, error: "Identifiant de commande invalide." };
  }

  const profileSnap = await adminDb.collection("customers").doc(session.uid).get();
  if (!profileSnap.exists) return { ok: false, error: "Profil introuvable." };
  const profile = profileSnap.data() as { name: string; phone: string };

  const ref = adminDb.collection("orders").doc(customerOrderDocumentId(session.uid, requestId));
  try {
    await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) return;

      const inventory = await loadInventoryQuote(tx, input.items);
      if (!inventory.ok) throw new OrderInputError(inventory.error);
      decrementQuotedStock(tx, inventory.quote);
      tx.set(ref, {
        customerName: profile.name,
        customerPhone: profile.phone,
        orderSummary: inventory.quote.summary,
        address: null,
        locationToken: null,
        locationTokenExpiresAt: null,
        locationSharing: false,
        liveLocation: null,
        courierLocationToken: null,
        courierLocationTokenExpiresAt: null,
        courierLocationSharing: false,
        courierLiveLocation: null,
        deliveryCode: generateDeliveryCode(),
        items: inventory.quote.items,
        total: inventory.quote.total,
        checkoutRequestId: requestId,
        status: "recue",
        createdAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString(),
        deliverySlot: null,
        deliveredAt: null,
        reviewToken: null,
        reviewSubmitted: false,
        uid: session.uid,
        ...UNPAID_PAYMENT_FIELDS,
      });
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Impossible d'enregistrer la commande." };
  }

  revalidatePath("/", "layout");

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
  if (normalizeOrderStatus(order.status) !== "arrivee") {
    return { ok: false, error: "Le livreur doit être signalé comme arrivé avant de clôturer la livraison." };
  }
  const reviewToken = order.reviewToken || randomUUID();
  const deliveredAt = order.deliveredAt || new Date().toISOString();
  await ref.update({
    status: "livree",
    statusUpdatedAt: deliveredAt,
    deliveredAt,
    reviewToken,
    // La livraison est faite, plus besoin de suivre la position — évite
    // qu'un onglet resté ouvert continue de remonter des positions inutiles.
    locationSharing: false,
    courierLocationSharing: false,
    locationHistoryPurgeDueAt: locationHistoryPurgeDueAt(new Date(deliveredAt)),
  });

  return { ok: true, reviewToken };
}

export async function updateOrderStatusAction(
  id: string,
  status: OrderStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();
  if (!id || normalizeOrderStatus(status) !== status) return { ok: false, error: "État invalide." };

  const ref = adminDb.collection("orders").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };
  const order = snap.data() as Order;
  const current = normalizeOrderStatus(order.status);
  if (current === "livree") return { ok: false, error: "Une commande livrée ne peut plus être modifiée." };
  if (status === "livree") return { ok: false, error: "Utilisez la validation par code ou « Marquer livrée »." };
  if (status === "livreur_assigne" && !order.assignedCourierId && !order.courierLocationToken) {
    return { ok: false, error: "Affectez d'abord un livreur ou créez son lien ponctuel." };
  }
  if ((status === "en_route" || status === "arrivee") && !order.courierLocationToken) {
    return { ok: false, error: "Aucun accès livreur n'est associé à cette commande." };
  }

  const now = new Date().toISOString();
  await ref.update({
    status,
    statusUpdatedAt: now,
    ...(status === "en_route" ? { trackingStartedAt: order.trackingStartedAt || now } : {}),
    ...(status === "arrivee" ? { courierArrivedAt: order.courierArrivedAt || now } : {}),
    ...(TERMINAL_ORDER_STATUSES.has(status)
      ? { locationSharing: false, courierLocationSharing: false }
      : {}),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateDeliverySlotAction(
  id: string,
  deliverySlot: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();
  const value = String(deliverySlot || "").trim().slice(0, 120);
  const ref = adminDb.collection("orders").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };
  await ref.update({ deliverySlot: value || null });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reportDeliveryIncidentAction(
  id: string,
  type: DeliveryIncidentType | null,
  note = ""
): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();
  const allowed: DeliveryIncidentType[] = ["client_injoignable", "adresse_incorrecte", "livreur_indisponible", "report_client", "autre"];
  if (type && !allowed.includes(type)) return { ok: false, error: "Incident invalide." };
  const ref = adminDb.collection("orders").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };
  await ref.update({
    deliveryIncidentType: type,
    deliveryIncidentNote: type ? String(note || "").trim().slice(0, 300) || null : null,
    deliveryIncidentAt: type ? new Date().toISOString() : null,
    ...(type ? { status: "reportee", statusUpdatedAt: new Date().toISOString(), locationSharing: false, courierLocationSharing: false } : {}),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Montant payé au livreur pour une course donnée — décidé au cas par cas par
// l'admin (pas de barème automatique, confirmé le 06/09/2026), saisi une
// fois la livraison faite. Alimente "Mes gains" sur le tableau de bord du
// livreur enregistré (lib/actions/couriers.ts).
export async function setCourierPayoutAction(orderId: string, amount: number): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();

  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Montant invalide." };

  const ref = adminDb.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };

  await ref.update({ courierPayout: amount });
  return { ok: true };
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
  const status = normalizeOrderStatus(order.status);
  if (!canGenerateTrackingLink(status, role)) {
    return {
      ok: false,
      error:
        role === "customer"
          ? "Le lien client devient disponible lorsque le livreur est en route."
          : "Préparez la commande avant de créer l'accès du livreur.",
    };
  }
  const existing = order[fields.token];
  const expiresAt = order[fields.expires];
  const expired = Boolean(expiresAt && Date.parse(expiresAt) <= Date.now());
  const token = existing && !expired ? existing : randomUUID();
  if (!existing || expired || !expiresAt) {
    await ref.update({
      [fields.token]: token,
      [fields.expires]: trackingTokenExpiresAt(),
      ...(role === "courier" && status === "prete" ? { status: "livreur_assigne", statusUpdatedAt: new Date().toISOString() } : {}),
      ...(role === "customer" ? { trackingRequestedAt: new Date().toISOString() } : {}),
    });
  }

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

  revalidatePath("/", "layout");

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

export interface CourierDeliveryDetails {
  customerPhone: string;
  address: string | null;
  orderSummary: string;
  deliverySlot: string | null;
}

export async function getOrderForLocationAction(token: string): Promise<
  | {
      ok: true;
      customerName: string;
      sharing: boolean;
      role: LocationRole;
      // Détails de la commande utiles pour livrer — absents côté client, qui
      // connaît déjà le contenu de sa propre commande.
      delivery?: CourierDeliveryDetails;
      // Code à donner au livreur à la réception — absent côté livreur : lui
      // demander de le saisir n'a de sens que si le client seul le connaît.
      deliveryCode?: string;
      status: OrderStatus;
    }
  | { ok: false; error: string }
> {
  const found = await findOrderByEitherLocationToken(token);
  if (!found) return { ok: false, error: "Ce lien n'est pas valide." };
  const { order, role } = found;
  const status = normalizeOrderStatus(order.status);
  if (!canGenerateTrackingLink(status, role)) return { ok: false, error: "Le suivi n'est pas encore disponible pour cette commande." };
  const fields = locationFields(role);

  // Rétrocompatibilité : les commandes créées avant l'introduction de ce
  // code n'en ont pas — généré à la volée plutôt que par une migration.
  let deliveryCode = order.deliveryCode;
  if (!deliveryCode) {
    deliveryCode = generateDeliveryCode();
    await adminDb.collection("orders").doc(order.id).update({ deliveryCode });
  }

  return {
    ok: true,
    customerName: order.customerName,
    sharing: order[fields.sharing],
    role,
    status,
    ...(role === "courier"
      ? { delivery: { customerPhone: order.customerPhone, address: order.address, orderSummary: order.orderSummary, deliverySlot: order.deliverySlot || null } }
      : { deliveryCode }),
  };
}

// Clôture la livraison depuis le lien du LIVREUR uniquement — le rôle est
// déduit du jeton (voir findOrderByEitherLocationToken), donc le jeton client
// ne peut jamais déclencher cette action. Le code à 4 chiffres (affiché côté
// client, voir getOrderForLocationAction) confirme que le livreur a bien
// trouvé le bon client avant de pouvoir clôturer — sans lui, n'importe qui
// avec le lien du livreur pourrait clôturer une livraison qui n'a pas eu
// lieu. Mêmes effets de bord que markOrderDeliveredAction (admin) : à ne pas
// dupliquer, seule la garde d'accès diffère.
export async function markOrderDeliveredByCourierAction(
  token: string,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const found = await findOrderByEitherLocationToken(token);
  if (!found) return { ok: false, error: "Lien invalide." };
  if (found.role !== "courier") return { ok: false, error: "Seul le lien du livreur permet de clôturer la livraison." };
  const cleanToken = String(token || "").trim();
  const cleanCode = String(code || "").replace(/\D/g, "").slice(0, 4);
  const orderRef = adminDb.collection("orders").doc(found.order.id);
  const outcome = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) return { ok: false as const, error: "Lien invalide." };
    const order = snap.data() as Order;
    if (order.courierLocationToken !== cleanToken) return { ok: false as const, error: "Lien invalide." };
    if (normalizeOrderStatus(order.status) !== "arrivee") return { ok: false as const, error: "Signalez d'abord votre arrivée chez le client." };

    const now = new Date();
    const lockedUntil = order.deliveryCodeLockedUntil ? new Date(order.deliveryCodeLockedUntil) : null;
    if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
      return { ok: false as const, error: "Trop de codes incorrects. Réessayez dans quelques minutes." };
    }
    if (!order.deliveryCode || cleanCode !== order.deliveryCode) {
      const attempts = (order.deliveryCodeAttempts || 0) + 1;
      const lock = attempts >= 5 ? new Date(now.getTime() + 10 * 60 * 1000).toISOString() : null;
      tx.update(orderRef, {
        deliveryCodeAttempts: attempts >= 5 ? 0 : attempts,
        deliveryCodeLockedUntil: lock,
      });
      return {
        ok: false as const,
        error: lock ? "Trop de codes incorrects. Réessayez dans 10 minutes." : "Code incorrect — demandez-le au client.",
      };
    }

    const deliveredAt = order.deliveredAt || now.toISOString();
    tx.update(orderRef, {
      status: "livree",
      statusUpdatedAt: deliveredAt,
      deliveredAt,
      reviewToken: order.reviewToken || randomUUID(),
      locationSharing: false,
      courierLocationSharing: false,
      deliveryCodeAttempts: 0,
      deliveryCodeLockedUntil: null,
      locationHistoryPurgeDueAt: locationHistoryPurgeDueAt(new Date(deliveredAt)),
    });
    return { ok: true as const };
  });
  if (!outcome.ok) return outcome;

  // Pas de revalidatePath ici (contrairement aux autres actions de ce
  // fichier) : cette action est appelée depuis la page publique du livreur
  // elle-même — revalider forçait Next.js à refaire tourner cette même page
  // aussitôt après, qui relit alors une commande dont le statut vient de
  // changer et affiche "lien invalide" à la place de l'écran de succès
  // (constaté le 06/09/2026). markOrderDeliveredAction, son équivalent admin,
  // n'en a pas non plus.
  return { ok: true };
}

export async function startDeliveryByCourierAction(
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const found = await findOrderByEitherLocationToken(token);
  if (!found || found.role !== "courier") return { ok: false, error: "Lien livreur invalide." };
  const ref = adminDb.collection("orders").doc(found.order.id);
  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false as const, error: "Commande introuvable." };
    const order = snap.data() as Order;
    if (order.courierLocationToken !== String(token || "").trim()) return { ok: false as const, error: "Lien livreur invalide." };
    const status = normalizeOrderStatus(order.status);
    if (status === "en_route" || status === "arrivee") return { ok: true as const };
    if (status !== "prete" && status !== "livreur_assigne") {
      return { ok: false as const, error: "La commande doit être prête avant le départ." };
    }
    const now = new Date().toISOString();
    tx.update(ref, { status: "en_route", statusUpdatedAt: now, trackingStartedAt: order.trackingStartedAt || now });
    return { ok: true as const };
  });
  return result;
}

export async function markCourierArrivedAction(
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const found = await findOrderByEitherLocationToken(token);
  if (!found || found.role !== "courier") return { ok: false, error: "Lien livreur invalide." };
  const ref = adminDb.collection("orders").doc(found.order.id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };
  const order = snap.data() as Order;
  if (normalizeOrderStatus(order.status) !== "en_route") return { ok: false, error: "La livraison doit être en route." };
  const now = new Date().toISOString();
  await ref.update({ status: "arrivee", statusUpdatedAt: now, courierArrivedAt: order.courierArrivedAt || now });
  return { ok: true };
}

export async function updateLiveLocationAction(
  token: string,
  lat: number,
  lng: number,
  accuracy?: number,
  speed?: number | null,
  heading?: number | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const found = await findOrderByEitherLocationToken(token);
  if (!found) return { ok: false, error: "Lien invalide." };
  const { order, role } = found;
  if (!canUpdateLiveLocation(normalizeOrderStatus(order.status))) {
    return { ok: false, error: "Le suivi GPS démarre uniquement lorsque le livreur est en route." };
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, error: "Position invalide." };
  }
  if (!hasUsableAccuracy(accuracy)) {
    return { ok: false, error: "Signal GPS trop imprécis. Placez-vous si possible près d'une fenêtre ou à l'extérieur." };
  }

  const fields = locationFields(role);
  const at = new Date().toISOString();
  const orderRef = adminDb.collection("orders").doc(order.id);
  const pointRef = orderRef.collection(fields.points).doc();
  const cleanToken = String(token || "").trim();
  const next: LocationPoint = {
    lat,
    lng,
    at,
    ...(accuracy === undefined ? {} : { accuracy }),
    speed: typeof speed === "number" && Number.isFinite(speed) && speed >= 0 ? speed : null,
    heading: typeof heading === "number" && Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading : null,
  };

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new Error("invalid");
    const currentOrder = snap.data() as Order;
    if (!canUpdateLiveLocation(normalizeOrderStatus(currentOrder.status)) || currentOrder[fields.token] !== cleanToken) throw new Error("invalid");

    const previousLive = currentOrder[fields.live];
    if (previousLive && Date.now() - new Date(previousLive.updatedAt).getTime() < 4000) return;
    const previous = previousLive
      ? { ...previousLive, at: previousLive.updatedAt }
      : null;
    const append = shouldAppendTrackPoint(previous, next);
    const liveLocation = append || !previousLive
      ? {
          lat: next.lat,
          lng: next.lng,
          updatedAt: at,
          ...(next.accuracy === undefined ? {} : { accuracy: next.accuracy }),
          speed: next.speed,
          heading: next.heading,
        }
      : { ...previousLive, updatedAt: at, accuracy: Math.min(previousLive.accuracy ?? accuracy ?? 100, accuracy ?? 100) };

    tx.update(orderRef, { [fields.sharing]: true, [fields.live]: liveLocation });
    if (append) tx.set(pointRef, next);
  });

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
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
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
    orderRef.collection(fields.points).orderBy("at", "desc").limit(MAX_TRACK_POINTS).get(),
  ]);
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };
  const order = snap.data() as Order;
  const points = pointsSnap.docs.map((d) => d.data() as LocationPoint).reverse();

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
): Promise<
  | { ok: true; customer: SharedTrack; courier: SharedTrack; status: OrderStatus; delivered: boolean; reviewToken: string | null }
  | { ok: false; error: string }
> {
  const found = await findOrderByEitherLocationToken(token);
  if (!found) return { ok: false, error: "Lien invalide." };
  const { order } = found;

  return {
    ok: true,
    customer: {
      // La carte publique utilise les positions actuelles et l'itinéraire
      // routier. L'historique reste réservé au tiroir admin : ne pas relire
      // jusqu'à 400 documents toutes les 6 secondes sur chaque téléphone.
      points: [],
      current: order.liveLocation,
      sharing: order.locationSharing,
    },
    courier: {
      points: [],
      current: order.courierLiveLocation,
      sharing: order.courierLocationSharing,
    },
    // Vrai statut Firestore, pas un état local : la livraison peut se clôturer
    // depuis l'appareil du livreur (code) OU depuis l'admin (bouton "Marquer
    // livrée") — dans les deux cas ce sondage, déjà actif des deux côtés, doit
    // faire passer l'autre partie en "Livrée" sans action de sa part (retour
    // client du 06/09/2026 : le client restait bloqué sur "En route").
    status: normalizeOrderStatus(order.status),
    delivered: order.status === "livree",
    // Permet au client de proposer un avis + une photo dès l'écran "Livraison
    // terminée !", sans attendre que l'admin pense à cliquer "Demander un
    // avis" (le mécanisme d'avis+photo existe déjà, /avis/[token] — seul le
    // moment où on le propose changeait). Jamais avant reviewSubmitted=false
    // ni avant "livree" : reviewToken peut exister mais avoir déjà servi.
    reviewToken: found.role === "customer" && order.status === "livree" && !order.reviewSubmitted ? order.reviewToken : null,
  };
}
