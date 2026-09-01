import { adminDb } from "@/lib/firebase/admin";
import { verifyCampayWebhookSignature } from "@/lib/campay";
import { applyPaymentResult } from "@/lib/paymentHelpers";
import type { Order } from "@/lib/types";

// Appelé par CamPay, jamais par notre propre client — pas de session à
// vérifier ici, l'authenticité vient uniquement de la signature JWT (voir
// le plan, addendum 3, section Sécurité). Ne fonctionne pas en local :
// CamPay ne peut pas atteindre localhost, à tester sur la preview déployée.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ ok: false }, { status: 400 });

  const { status, external_reference, reason, endpoint, signature } = body as {
    status?: string;
    external_reference?: string;
    reason?: string | null;
    endpoint?: string;
    signature?: string;
  };

  if (!verifyCampayWebhookSignature(signature || "", process.env.CAMPAY_WEBHOOK_KEY || "")) {
    return Response.json({ ok: false, error: "Signature invalide." }, { status: 401 });
  }

  // On ne traite que les paiements (collect) ; les retraits (withdraw)
  // n'existent pas dans ce flux.
  if (endpoint !== "collect" || !external_reference) {
    return Response.json({ ok: true });
  }
  if (status !== "SUCCESSFUL" && status !== "FAILED") {
    return Response.json({ ok: true });
  }

  const snap = await adminDb.collection("orders").where("paymentReference", "==", external_reference).limit(1).get();
  if (snap.empty) {
    return Response.json({ ok: true });
  }

  const doc = snap.docs[0];
  const order: Order = { id: doc.id, ...(doc.data() as Omit<Order, "id">) };
  await applyPaymentResult(order, status, reason ?? null);

  return Response.json({ ok: true });
}
