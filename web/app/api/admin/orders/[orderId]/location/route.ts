import { verifyAdminSession } from "@/lib/auth/dal";
import { getOrderLocationHistoryAction } from "@/lib/actions/orders";
import { privateJson, privateReadError } from "@/lib/privateResponse";

/** Read-only GETs do not enter the browser's sequential Server Action queue. */
export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    await verifyAdminSession();
    const { orderId } = await params;
    if (!/^[\w-]{1,128}$/.test(orderId)) return privateJson({ error: "Commande introuvable." }, 404);
    const [customer, courier] = await Promise.all([
      getOrderLocationHistoryAction(orderId, "customer"), getOrderLocationHistoryAction(orderId, "courier"),
    ]);
    if (!customer.ok || !courier.ok) return privateJson({ error: "Commande introuvable." }, 404);
    return privateJson({
      customer: { points: customer.points, current: customer.liveLocation, sharing: customer.locationSharing },
      courier: { points: courier.points, current: courier.liveLocation, sharing: courier.locationSharing },
    });
  } catch (error) { return privateReadError(error); }
}
