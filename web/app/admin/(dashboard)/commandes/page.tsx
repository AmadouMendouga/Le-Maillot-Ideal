import { getAllOrders } from "@/lib/data/orders";
import { getAllProducts } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";
import { OrdersAdmin } from "@/components/admin/OrdersAdmin";

export default async function AdminOrdersPage() {
  const [orders, products, settings] = await Promise.all([getAllOrders(), getAllProducts(), getSiteSettings()]);
  return <OrdersAdmin initialOrders={orders} products={products} settings={settings} />;
}
