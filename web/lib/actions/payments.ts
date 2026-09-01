"use server";

// Paiement en ligne CamPay (addendum 3 du plan). Le parcours WhatsApp reste
// le canal principal et n'est jamais affecté par ce fichier — ces actions ne
// s'exécutent qu'à la demande explicite d'un client connecté qui choisit
// « Payer par Mobile Money ».
import { randomUUID } from "node:crypto";
import { verifyCustomerSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { getOrderById } from "@/lib/data/orders";
import { campayCollect, campayGetTransaction } from "@/lib/campay";
import { applyPaymentResult } from "@/lib/paymentHelpers";
import type { OrderItem, PaymentStatus, Product } from "@/lib/types";

export interface InitiateCampayPaymentInput {
  items: OrderItem[];
}

export type InitiateCampayPaymentResult =
  | { ok: true; orderId: string; ussdCode: string; operator: string }
  | { ok: false; error: string };

export async function initiateCampayPaymentAction(
  input: InitiateCampayPaymentInput
): Promise<InitiateCampayPaymentResult> {
  const session = await verifyCustomerSession();

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "Panier vide." };
  }

  const profileSnap = await adminDb.collection("customers").doc(session.uid).get();
  if (!profileSnap.exists) return { ok: false, error: "Profil introuvable." };
  const profile = profileSnap.data() as { name: string; phone: string };

  // Ne jamais faire confiance à un total envoyé par le client — on relit les
  // prix et le stock réels depuis Firestore, comme lib/cart.ts le fait déjà
  // pour le message WhatsApp.
  const productSnaps = await Promise.all(
    input.items.map((item) => adminDb.collection("products").doc(item.slug).get())
  );

  let total = 0;
  const summaryParts: string[] = [];
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    const snap = productSnaps[i];
    if (!snap.exists) return { ok: false, error: "Un article du panier n'existe plus." };
    const product = snap.data() as Product;
    if (!Number.isFinite(item.qty) || item.qty < 1) {
      return { ok: false, error: "Quantité invalide." };
    }
    if (product.stock < item.qty) {
      return { ok: false, error: `Stock insuffisant pour ${product.name}.` };
    }
    total += product.price * item.qty;
    summaryParts.push(`${item.qty}x ${product.name} (${item.size})`);
  }

  if (total <= 0) return { ok: false, error: "Montant invalide." };

  const paymentReference = randomUUID();
  const orderRef = adminDb.collection("orders").doc();
  await orderRef.set({
    customerName: profile.name,
    customerPhone: profile.phone,
    orderSummary: summaryParts.join(", "),
    address: null,
    items: input.items,
    total,
    status: "confirmee",
    createdAt: new Date().toISOString(),
    deliveredAt: null,
    reviewToken: null,
    reviewSubmitted: false,
    uid: session.uid,
    paymentStatus: "pending",
    paymentReference,
    campayReference: null,
    ussdCode: null,
    paidAt: null,
    paymentFailureReason: null,
  });

  try {
    const result = await campayCollect({
      amount: total,
      from: profile.phone,
      description: "Le Maillot Idéal — commande en ligne",
      externalReference: paymentReference,
    });
    await orderRef.update({ campayReference: result.reference, ussdCode: result.ussd_code });
    return { ok: true, orderId: orderRef.id, ussdCode: result.ussd_code, operator: result.operator };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Échec de l'initialisation du paiement.";
    await orderRef.update({ paymentStatus: "failed", paymentFailureReason: message });
    return { ok: false, error: message };
  }
}

export type CheckPaymentStatusResult =
  | { ok: true; paymentStatus: PaymentStatus; paymentFailureReason: string | null }
  | { ok: false; error: string };

export async function checkPaymentStatusAction(
  orderId: string,
  opts?: { forceLiveCheck?: boolean }
): Promise<CheckPaymentStatusResult> {
  const session = await verifyCustomerSession();

  const order = await getOrderById(orderId, session.uid);
  if (!order) return { ok: false, error: "Commande introuvable." };

  // Filet de secours si le webhook tarde — interroge CamPay directement et
  // resynchronise Firestore. Pas le mécanisme principal (voir le plan).
  if (opts?.forceLiveCheck && order.paymentStatus === "pending" && order.campayReference) {
    try {
      const live = await campayGetTransaction(order.campayReference);
      if (live.status === "SUCCESSFUL" || live.status === "FAILED") {
        await applyPaymentResult(order, live.status, live.reason);
        return {
          ok: true,
          paymentStatus: live.status === "SUCCESSFUL" ? "paid" : "failed",
          paymentFailureReason: live.reason,
        };
      }
    } catch {
      // le statut Firestore actuel reste la meilleure information disponible
    }
  }

  return { ok: true, paymentStatus: order.paymentStatus, paymentFailureReason: order.paymentFailureReason };
}
