import { adminDb } from "@/lib/firebase/admin";
import { campayGetTransaction, campayTransactionMismatch, verifyCampayWebhookSignature } from "@/lib/campay";
import { applyPaymentResult } from "@/lib/paymentHelpers";
import type { Order } from "@/lib/types";

// Appelé par CamPay, jamais par notre propre client — pas de session à
// vérifier ici, l'authenticité vient uniquement de la signature JWT (voir
// le plan, addendum 3, section Sécurité). Ne fonctionne pas en local :
// CamPay ne peut pas atteindre localhost, à tester sur la preview déployée.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ ok: false }, { status: 400 });

  const { external_reference, endpoint, signature, reference } = body as {
    external_reference?: string;
    endpoint?: string;
    signature?: string;
    reference?: string;
  };

  if (typeof signature !== "string" || signature.length > 8192 || !verifyCampayWebhookSignature(signature, process.env.CAMPAY_WEBHOOK_KEY || "")) {
    return Response.json({ ok: false, error: "Signature invalide." }, { status: 401 });
  }

  // On ne traite que les paiements (collect) ; les retraits (withdraw)
  // n'existent pas dans ce flux.
  if (endpoint !== "collect") {
    return Response.json({ ok: true });
  }
  if (typeof external_reference !== "string" || !external_reference.trim() || external_reference.length > 200) {
    return Response.json({ ok: false, error: "Référence externe invalide." }, { status: 400 });
  }
  const snap = await adminDb.collection("orders").where("paymentReference", "==", external_reference.trim()).limit(1).get();
  if (snap.empty) {
    return Response.json({ ok: true });
  }

  const doc = snap.docs[0];
  const order: Order = { id: doc.id, ...(doc.data() as Omit<Order, "id">) };
  const providerReference = order.campayReference || (typeof reference === "string" ? reference.trim() : "");
  if (!providerReference) {
    return Response.json({ ok: false, error: "Transaction pas encore rattachée." }, { status: 409 });
  }

  // Le corps du webhook n'est qu'un signal : le statut qui fait autorité est
  // relu auprès de CamPay et réconcilié avec la commande avant toute mutation.
  let transaction;
  try {
    transaction = await campayGetTransaction(providerReference);
  } catch {
    return Response.json({ ok: false, error: "Vérification CamPay temporairement indisponible." }, { status: 503 });
  }
  const mismatch = campayTransactionMismatch(order, transaction);
  if (mismatch) return Response.json({ ok: false, error: mismatch }, { status: 409 });
  if (!order.campayReference) {
    await doc.ref.update({ campayReference: transaction.reference });
  }
  if (transaction.status === "SUCCESSFUL" || transaction.status === "FAILED") {
    await applyPaymentResult(order.id, transaction.status, transaction.reason);
  }

  return Response.json({ ok: true });
}
