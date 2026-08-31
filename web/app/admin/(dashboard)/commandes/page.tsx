import { getAllOrders } from "@/lib/data/orders";
import { getSiteSettings } from "@/lib/data/settings";
import { OrdersAdmin } from "@/components/admin/OrdersAdmin";

export default async function AdminOrdersPage() {
  const [orders, settings] = await Promise.all([getAllOrders(), getSiteSettings()]);
  return <OrdersAdmin initialOrders={orders} settings={settings} />;
}
