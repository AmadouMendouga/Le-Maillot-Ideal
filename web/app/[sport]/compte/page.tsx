import Link from "next/link";
import { requireCustomerOrRedirect } from "@/lib/auth/dal";
import { getCustomerProfile } from "@/lib/data/customer";
import { getOrdersForCustomer } from "@/lib/data/orders";
import { getAllProducts } from "@/lib/data/products";
import { getAllSports } from "@/lib/data/sports";
import { getSiteSettings } from "@/lib/data/settings";
import { canGenerateTrackingLink, normalizeOrderStatus, ORDER_STATUS_LABELS, TERMINAL_ORDER_STATUSES } from "@/lib/orderWorkflow";
import { AccountHeader } from "@/components/account/AccountHeader";
import { AccountSearch } from "@/components/account/AccountSearch";
import { ProductCard } from "@/components/products/ProductCard";
import { HeartIcon } from "@/components/products/HeartIcon";
import { Icon } from "@/components/icons/Icon";

export const metadata = { title: "Mon espace — IKIGAI Sport", robots: { index: false, follow: false } };

export default async function ComptePage({ params }: PageProps<"/[sport]/compte">) {
  const { sport } = await params;
  const session = await requireCustomerOrRedirect(sport);
  const [profile, orders, products, sports, settings] = await Promise.all([
    getCustomerProfile(), getOrdersForCustomer(session.uid), getAllProducts(), getAllSports(), getSiteSettings(),
  ]);
  const activeOrders = orders.filter((order) => !TERMINAL_ORDER_STATUSES.has(normalizeOrderStatus(order.status)));
  const currentOrder = activeOrders[0];
  const highlights = products.filter((product) => product.sport === sport).slice(0, 4);
  // eslint-disable-next-line react-hooks/purity -- horodatage vérifié dans un Server Component dynamique authentifié
  const now = Date.now();
  const canTrack = currentOrder && currentOrder.locationToken && canGenerateTrackingLink(normalizeOrderStatus(currentOrder.status), "customer")
    && (!currentOrder.locationTokenExpiresAt || Date.parse(currentOrder.locationTokenExpiresAt) > now);
  return <main id="main" className="container ik-account-home">
    <AccountHeader email={profile.email} name={profile.name} />
    <h1>Votre univers sportif.</h1><p className="ik-muted">Vos envies, vos commandes et votre prochaine séance.</p>
    <AccountSearch sport={sport} />
    <nav className="ik-sport-shortcuts" aria-label="Explorer les sports">{sports.map((item) => <Link key={item.key} href={`/${item.key}/compte`} aria-current={item.key === sport ? "page" : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <span>{item.logo ? <img src={item.logo} alt="" /> : <Icon name="soccer" />}</span><strong>{item.label}</strong>
    </Link>)}</nav>
    <div className="ik-account-banner">
      <div><p className="ik-eyebrow">{currentOrder ? "Votre dernière commande en cours" : "Bienvenue chez IKIGAI"}</p>
        <h2>{currentOrder ? ORDER_STATUS_LABELS[normalizeOrderStatus(currentOrder.status)] : "Prêt pour votre prochain sport ?"}</h2>
        <p>{currentOrder ? currentOrder.orderSummary : "Retrouvez les équipements de votre discipline et gardez vos coups de cœur."}</p>
        {currentOrder?.deliverySlot ? <p className="ik-account-slot"><Icon name="schedule" size="sm" />{currentOrder.deliverySlot}</p> : null}
        <Link href={canTrack ? `/livraison/${currentOrder.locationToken}` : currentOrder ? `/${sport}/compte/commandes` : `/${sport}/boutique`} className="btn btn-primary">
          {canTrack ? "Suivre la livraison" : currentOrder ? "Voir ma commande" : "Explorer les articles"}<Icon name="arrow-forward" size="sm" />
        </Link>
      </div>
      <span className="ik-account-banner-icon" aria-hidden="true"><Icon name={currentOrder ? "shipping" : "soccer"} /></span>
    </div>
    <nav className="ik-account-shortcuts" aria-label="Accès rapides">
      <Link href={`/${sport}/compte/commandes`}><Icon name="inventory" /><span><strong>Mes commandes</strong><small>{activeOrders.length ? `${activeOrders.length} en cours` : "Consulter mon historique"}</small></span><Icon name="chevron-right" size="sm" /></Link>
      <Link href={`/${sport}/favoris`}><HeartIcon /><span><strong>Mes favoris</strong><small>Enregistrés sur cet appareil</small></span><Icon name="chevron-right" size="sm" /></Link>
    </nav>
    {highlights.length ? <section className="ik-account-products"><div className="ik-account-section-head"><h2>À découvrir</h2><Link href={`/${sport}/boutique`}>Tout voir <Icon name="arrow-forward" size="sm" /></Link></div>
      <div className="product-grid">{highlights.map((product) => <ProductCard key={product.slug} product={product} settings={settings} />)}</div>
    </section> : null}
  </main>;
}
