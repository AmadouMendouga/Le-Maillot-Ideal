import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/auth/dal";
import { getAllOrders } from "@/lib/data/orders";
import { getAllProducts } from "@/lib/data/products";
import { ORDER_STATUS_LABELS, normalizeOrderStatus } from "@/lib/orderWorkflow";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/names";

export const metadata = { title: "Vue d’ensemble — Administration IKIGAI" };

export default async function AdminOverviewPage() {
  await requireAdminOrRedirect();
  const [orders, products] = await Promise.all([getAllOrders(), getAllProducts()]);
  const pending = orders.filter((o) => ["recue", "confirmee", "preparation", "prete"].includes(normalizeOrderStatus(o.status)));
  const delivering = orders.filter((o) => ["livreur_assigne", "en_route", "arrivee"].includes(normalizeOrderStatus(o.status)));
  const review = orders.filter((o) => o.paymentStatus === "review" || o.inventoryIssue);
  const lowStock = products.filter((p) => p.stock <= 5).sort((a, b) => a.stock - b.stock);
  const metrics: { label: string; value: number; note: string; href: string; icon: IconName }[] = [
    { label: "À préparer", value: pending.length, note: "De la réception à la remise au livreur", href: "/admin/commandes?view=pending", icon: "inventory" },
    { label: "Livraisons en cours", value: delivering.length, note: "Affectées, en route ou arrivées", href: "/admin/commandes?view=delivery", icon: "shipping" },
    { label: "Stocks à surveiller", value: lowStock.length, note: "Produits avec 5 unités ou moins", href: "/admin?stock=low", icon: "hourglass" },
    { label: "Paiements à vérifier", value: review.length, note: "Paiement ou réservation de stock à contrôler", href: "/admin/commandes?view=review", icon: "payment" },
  ];
  return (
    <section className="adm-overview">
      <div className="adm-page-heading">
        <div><p className="ik-eyebrow">IKIGAI Sport · Administration</p><h1>Bonjour, voici votre activité.</h1><p>Les commandes et le stock, au même endroit.</p></div>
        <Link className="btn btn-primary" href="/admin/commandes"><Icon name="shipping" size="sm" />Gérer les commandes</Link>
      </div>
      <div className="adm-metrics">
        {metrics.map((metric) => <Link className="adm-metric" href={metric.href} key={metric.label}>
          <div><span className="adm-metric-icon"><Icon name={metric.icon} /></span><Icon name="arrow-forward" size="sm" /></div>
          <strong>{metric.value}</strong><h2>{metric.label}</h2><p>{metric.note}</p>
        </Link>)}
      </div>
      <div className="adm-overview-grid">
        <section className="adm-card">
          <div className="adm-card-heading"><h2>Dernières commandes</h2><Link href="/admin/commandes">Tout voir <Icon name="arrow-forward" size="sm" /></Link></div>
          {orders.length ? <ul className="adm-activity-list">{orders.slice(0, 6).map((order) => <li key={order.id}>
            <span className="ik-avatar" aria-hidden="true">{order.customerName.trim().slice(0, 1).toUpperCase() || "C"}</span>
            <div><strong>{order.customerName}</strong><p>{order.orderSummary}</p><small>{new Date(order.createdAt).toLocaleDateString("fr-FR", { timeZone: "Africa/Douala", day: "numeric", month: "short" })}</small></div>
            <span className="adm-status-pill" data-active={["en_route", "arrivee"].includes(normalizeOrderStatus(order.status))}>{ORDER_STATUS_LABELS[normalizeOrderStatus(order.status)]}</span>
          </li>)}</ul> : <p className="adm-empty-note">Aucune commande pour le moment. Les prochaines apparaîtront ici.</p>}
        </section>
        <section className="adm-card">
          <div className="adm-card-heading"><h2>Priorité stock</h2><Link href="/admin?stock=low">Gérer <Icon name="arrow-forward" size="sm" /></Link></div>
          {lowStock.length ? <ul className="adm-stock-list">{lowStock.slice(0, 5).map((product) => <li key={product.slug}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.images.square} alt="" loading="lazy" />
            <div><strong>{product.name}</strong><span>{product.sportLabel}</span></div><b data-empty={product.stock <= 0}>{product.stock <= 0 ? "Rupture" : `${product.stock} restants`}</b>
          </li>)}</ul> : <p className="adm-empty-note">Aucun produit avec un stock inférieur ou égal à 5.</p>}
          <Link href="/admin" className="btn btn-tonal btn-block"><Icon name="inventory" size="sm" />Ouvrir le catalogue</Link>
        </section>
      </div>
      <div className="adm-info"><Icon name="info" /><p>Le suivi GPS du client s’active au départ du livreur. Pensez à confirmer le créneau et l’adresse avant de lancer la livraison.</p></div>
    </section>
  );
}
