"use server";

import { randomInt, randomUUID } from "node:crypto";
import { verifyCustomerSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { TRACKING_ORDER_STATUSES, normalizeOrderStatus } from "@/lib/orderWorkflow";
import type { Order } from "@/lib/types";

/** A customer can open their own live tracking from order details, without waiting for a message. */
export async function openCustomerTrackingAction(id: string): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const session = await verifyCustomerSession();
  if (!/^[\w-]{1,128}$/.test(id)) return { ok: false, error: "Commande introuvable." };
  const ref = adminDb.collection("orders").doc(id);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const order = snap.data() as Order | undefined;
    if (!order || order.uid !== session.uid) return { ok: false as const, error: "Commande introuvable." };
    if (!TRACKING_ORDER_STATUSES.has(normalizeOrderStatus(order.status))) return { ok: false as const, error: "Le suivi est disponible uniquement pendant la livraison." };
    const now = Date.now();
    const valid = order.locationToken && (!order.locationTokenExpiresAt || Date.parse(order.locationTokenExpiresAt) > now);
    const token = valid ? order.locationToken! : randomUUID();
    const patch: Partial<Order> = {};
    if (!valid || !order.locationTokenExpiresAt) Object.assign(patch, {
      locationToken: token, locationTokenExpiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(), trackingRequestedAt: new Date(now).toISOString(),
    });
    if (!order.deliveryCode) patch.deliveryCode = String(randomInt(0, 10000)).padStart(4, "0");
    if (Object.keys(patch).length) tx.update(ref, patch);
    return { ok: true as const, href: `/livraison/${token}` };
  });
}
