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
import type { Order, OrderItem, TestimonialSubmission } from "@/lib/types";

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

async function findOrderByToken(token: string): Promise<(Order & { id: string }) | null> {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return null;
  const snap = await adminDb.collection("orders").where("reviewToken", "==", cleanToken).limit(1).get();
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
}

export async function createOrderAction(
  input: CreateOrderInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await verifyAdminSession();

  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.replace(/\D/g, "");
  const orderSummary = input.orderSummary.trim();

  if (!customerName) return { ok: false, error: "Le nom du client est obligatoire." };
  if (customerPhone.length < 8 || customerPhone.length > 15) {
    return { ok: false, error: "Le numéro WhatsApp doit contenir 8 à 15 chiffres." };
  }
  if (!orderSummary) return { ok: false, error: "Décrivez le contenu de la commande." };

  const ref = await adminDb.collection("orders").add({
    customerName,
    customerPhone,
    orderSummary,
    address: input.address?.trim() || null,
    status: "confirmee",
    createdAt: new Date().toISOString(),
    deliveredAt: null,
    reviewToken: null,
    reviewSubmitted: false,
    uid: null,
    ...UNPAID_PAYMENT_FIELDS,
  });

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

  const ref = await adminDb.collection("orders").add({
    customerName: profile.name,
    customerPhone: profile.phone,
    orderSummary: input.orderSummary.trim(),
    address: null,
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
  });

  return { ok: true, reviewToken };
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
