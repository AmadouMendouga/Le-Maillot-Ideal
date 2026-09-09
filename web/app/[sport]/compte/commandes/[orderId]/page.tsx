import { notFound } from "next/navigation";
import { requireCustomerOrRedirect } from "@/lib/auth/dal";
import { getOrderById } from "@/lib/data/orders";
import { getSiteSettings } from "@/lib/data/settings";
import { toCustomerOrderView } from "@/lib/customerOrderView";
import { OrderDetail } from "@/components/account/OrderDetail";

export const metadata = { title: "Ma commande — IKIGAI Sport", robots: { index: false, follow: false } };
export default async function OrderDetailPage({ params }: PageProps<"/[sport]/compte/commandes/[orderId]">) {
  const { sport, orderId } = await params;
  const session = await requireCustomerOrRedirect(sport);
  if (!/^[\w-]{1,128}$/.test(orderId)) notFound();
  const [order, settings] = await Promise.all([getOrderById(orderId, session.uid), getSiteSettings()]);
  if (!order) notFound();
  return <main id="main" className="container ik-order-page"><OrderDetail initialOrder={toCustomerOrderView(order, true)} sport={sport} supportPhone={settings.whatsapp} /></main>;
}
