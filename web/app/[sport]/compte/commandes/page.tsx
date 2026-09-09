import Link from "next/link";
import { requireCustomerOrRedirect } from "@/lib/auth/dal";
import { getOrdersForCustomer } from "@/lib/data/orders";
import { toCustomerOrderView } from "@/lib/customerOrderView";
import { OrderHistory } from "@/components/account/OrderHistory";
import { Icon } from "@/components/icons/Icon";

export const metadata = { title: "Mes commandes — IKIGAI Sport", robots: { index: false, follow: false } };
export default async function CompteCommandesPage({ params }: PageProps<"/[sport]/compte/commandes">) {
  const { sport } = await params;
  const customer = await requireCustomerOrRedirect(sport);
  const orders = await getOrdersForCustomer(customer.uid);
  return <main id="main" className="container ik-orders-page"><header className="ik-account-page-title"><div><p className="ik-eyebrow">VOTRE ESPACE IKIGAI</p><h1>Mes commandes</h1><p className="ik-muted">De la préparation à la remise, suivez chaque étape ici.</p></div><Link href={`/${sport}/compte/profil`} className="ik-round-button" aria-label="Mon compte"><Icon name="person" /></Link></header><OrderHistory orders={orders.map((order) => toCustomerOrderView(order))} sport={sport} /></main>;
}
