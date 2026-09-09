import { getAllOrders } from "@/lib/data/orders";
import { getAllCouriers } from "@/lib/data/couriers";
import { privateJson, privateReadError } from "@/lib/privateResponse";

export async function GET() {
  try {
    const [orders, couriers] = await Promise.all([getAllOrders(), getAllCouriers()]);
    return privateJson({ orders, couriers });
  } catch (error) { return privateReadError(error); }
}
