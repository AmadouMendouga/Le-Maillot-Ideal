import "server-only";
import { orderStatusPatch } from "@/lib/orderStatusHistory";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { decrementQuotedStock, incrementQuotedStock, loadInventoryQuote } from "@/lib/orderInventory";
import type { Order } from "@/lib/types";

export type PaymentApplicationResult = "paid" | "failed" | "needs_review" | "ignored";

/** Applique le statut et son effet de stock dans une seule transaction idempotente. */
export async function applyPaymentResult(
  orderId: string,
  status: "SUCCESSFUL" | "FAILED",
  reason: string | null
): Promise<PaymentApplicationResult> {
  const orderRef = adminDb.collection("orders").doc(orderId);
  const result = await adminDb.runTransaction(async (tx): Promise<PaymentApplicationResult> => {
    const freshSnap = await tx.get(orderRef);
    if (!freshSnap.exists) return "ignored";
    const fresh = { id: freshSnap.id, ...(freshSnap.data() as Omit<Order, "id">) };

    // Un paiement acquis n'est jamais rétrogradé par une notification tardive.
    if (fresh.paymentStatus === "paid" || fresh.paymentStatus === "review") return "ignored";

    if (status === "FAILED") {
      if (fresh.paymentStatus === "failed") return "ignored";
      if (fresh.stockState === "reserved") {
        const inventory = await loadInventoryQuote(tx, fresh.items || [], {
          validateSizes: false,
          enforceStock: false,
        });
        if (!inventory.ok) {
          tx.update(orderRef, {
            paymentStatus: "failed",
            paymentFailureReason: reason || "Paiement refusé.",
            stockState: "needs_review",
            inventoryIssue: true,
          });
          return "needs_review";
        }
        incrementQuotedStock(tx, inventory.quote);
      }
      tx.update(orderRef, {
        paymentStatus: "failed",
        paymentFailureReason: reason || "Paiement refusé.",
        stockState: fresh.stockState === "reserved" ? "released" : fresh.stockState,
      });
      return "failed";
    }

    if (fresh.stockState !== "reserved") {
      // Compatibilité avec les anciennes commandes et avec une réussite tardive
      // après libération : on reprend le stock au plus une fois.
      const inventory = await loadInventoryQuote(tx, fresh.items || []);
      if (!inventory.ok) {
        tx.update(orderRef, {
          paymentStatus: "review",
          paidAt: new Date().toISOString(),
          stockState: "needs_review",
          inventoryIssue: true,
          paymentFailureReason: `Paiement reçu, intervention requise : ${inventory.error}`,
        });
        return "needs_review";
      }
      decrementQuotedStock(tx, inventory.quote);
    }

    tx.update(orderRef, {
      paymentStatus: "paid",
      ...(fresh.status === "recue" ? orderStatusPatch(fresh, "confirmee", new Date().toISOString()) : {}),
      paidAt: fresh.paidAt || new Date().toISOString(),
      stockState: "committed",
      inventoryIssue: false,
      paymentFailureReason: null,
    });
    return "paid";
  });

  if (result !== "ignored") revalidatePath("/", "layout");
  return result;
}
