import { getAllOrders } from "@/lib/data/orders";
import { getAllProducts } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";
import { getAllCouriers } from "@/lib/data/couriers";
import { OrdersAdmin } from "@/components/admin/OrdersAdmin";

export default async function AdminOrdersPage() {
  const [orders, products, settings, couriers] = await Promise.all([
    getAllOrders(),
    getAllProducts(),
    getSiteSettings(),
    getAllCouriers(),
  ]);
  return <OrdersAdmin initialOrders={orders} products={products} settings={settings} initialCouriers={couriers} />;
}
