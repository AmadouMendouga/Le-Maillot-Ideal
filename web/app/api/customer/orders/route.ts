import { verifyCustomerSession } from "@/lib/auth/dal";
import { getOrderById, getOrdersForCustomer } from "@/lib/data/orders";
import { toCustomerOrderView } from "@/lib/customerOrderView";
import { privateJson, privateReadError } from "@/lib/privateResponse";

export async function GET(request: Request) {
  try {
    const session = await verifyCustomerSession();
    const id = new URL(request.url).searchParams.get("orderId");
    if (id !== null) {
      if (!/^[\w-]{1,128}$/.test(id)) return privateJson({ error: "Commande introuvable." }, 404);
      const order = await getOrderById(id, session.uid);
      if (!order) return privateJson({ error: "Commande introuvable." }, 404);
      return privateJson(toCustomerOrderView(order, true));
    }
    const orders = await getOrdersForCustomer(session.uid);
    return privateJson(orders.map((order) => toCustomerOrderView(order)));
  } catch (error) { return privateReadError(error); }
}
