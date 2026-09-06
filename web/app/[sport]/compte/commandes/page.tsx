import Link from "next/link";
import { requireCustomerOrRedirect } from "@/lib/auth/dal";
import { getOrdersForCustomer } from "@/lib/data/orders";
import { OrderHistory } from "@/components/account/OrderHistory";
import { AccountHeader } from "@/components/account/AccountHeader";
import { Icon } from "@/components/icons/Icon";

export default async function CompteCommandesPage({ params }: PageProps<"/[sport]/compte/commandes">) {
  const { sport } = await params;
  const customer = await requireCustomerOrRedirect(sport);
  const orders = await getOrdersForCustomer(customer.uid);

  return (
    <main>
      <div className="page-hero">
        <div className="container">
          <h1>
            <Icon name="shipping" size="xl" />
            Mes commandes
          </h1>
          <p>Retrouvez ici l&apos;historique de vos commandes.</p>
        </div>
      </div>
      <div className="section">
        <div className="container" style={{ maxWidth: 640 }}>
          <AccountHeader email={customer.email} />
          <OrderHistory orders={orders} />
          {/* Retour client du 06/09/2026 : la page ne menait nulle part
              d'autre que la déconnexion — un compte n'est pas un cul-de-sac,
              on y revient depuis la boutique. */}
          <Link href={`/${sport}/boutique`} className="btn btn-primary btn-lg btn-block" style={{ marginTop: 24 }}>
            <Icon name="storefront" size="sm" />
            Continuer mes achats
          </Link>
        </div>
      </div>
    </main>
  );
}
