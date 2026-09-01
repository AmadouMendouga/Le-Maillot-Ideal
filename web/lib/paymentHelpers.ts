import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Order, Product } from "@/lib/types";

// Séparé de lib/actions/payments.ts ("use server") volontairement : tout
// export async d'un fichier "use server" devient un point d'entrée appelable
// directement par un client (Server Action), avec ses propres arguments non
// validés. applyPaymentResult prend un Order complet et un statut tels
// quels — elle ne doit être appelable que par du code déjà gardé côté
// serveur (la signature du webhook, ou la session + le contrôle de
// propriété de checkPaymentStatusAction), jamais directement depuis le
// navigateur.
export async function applyPaymentResult(
  order: Order,
  status: "SUCCESSFUL" | "FAILED",
  reason: string | null
): Promise<void> {
  const orderRef = adminDb.collection("orders").doc(order.id);

  if (status === "FAILED") {
    await orderRef.update({ paymentStatus: "failed", paymentFailureReason: reason || "Paiement refusé." });
    return;
  }

  await adminDb.runTransaction(async (tx) => {
    // Toutes les lectures d'abord (règle des transactions Firestore : aucune
    // écriture avant que toutes les lectures soient faites).
    const freshSnap = await tx.get(orderRef);
    const fresh = freshSnap.data() as Order;
    if (fresh.paymentStatus === "paid") return; // déjà traité (webhook + vérification manuelle en même temps)

    const items = fresh.items || [];
    const productRefs = items.map((item) => adminDb.collection("products").doc(item.slug));
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    for (let i = 0; i < items.length; i++) {
      const productSnap = productSnaps[i];
      if (!productSnap.exists) continue;
      const stock = (productSnap.data() as Product).stock;
      tx.update(productRefs[i], { stock: Math.max(0, stock - items[i].qty) });
    }

    tx.update(orderRef, { paymentStatus: "paid", paidAt: new Date().toISOString() });
  });
}
