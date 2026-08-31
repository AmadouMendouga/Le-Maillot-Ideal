import { requireCustomerOrRedirect } from "@/lib/auth/dal";
import { getOrdersForCustomer } from "@/lib/data/orders";
import { OrderHistory } from "@/components/account/OrderHistory";
import { AccountHeader } from "@/components/account/AccountHeader";
import { Icon } from "@/components/icons/Icon";

export default async function CompteCommandesPage() {
  const customer = await requireCustomerOrRedirect();
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
        </div>
      </div>
    </main>
  );
}
