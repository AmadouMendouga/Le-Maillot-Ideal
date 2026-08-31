// Historique de commandes d'un client (addendum 2) — lecture seule, aucune
// action possible ici (seul l'admin fait évoluer le statut d'une commande).
import { Icon } from "@/components/icons/Icon";
import { FCFA } from "@/lib/cart";
import type { Order } from "@/lib/types";

function statusBadge(order: Order) {
  if (order.status === "livree") {
    return (
      <span className="badge badge-stock-ok">
        <Icon name="check-circle" size="sm" />
        Livrée
      </span>
    );
  }
  return (
    <span className="badge badge-stock-low">
      <Icon name="hourglass" size="sm" />
      Confirmée
    </span>
  );
}

export function OrderHistory({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="adm-empty">
        <Icon name="shipping" />
        <div>Vous n&apos;avez pas encore de commande. Elle apparaîtra ici après votre premier achat.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {orders.map((order) => (
        <div key={order.id} className="contact-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {new Date(order.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p className="sub" style={{ margin: "4px 0 0" }}>
                {order.orderSummary}
              </p>
            </div>
            {statusBadge(order)}
          </div>
          {typeof order.total === "number" ? (
            <p style={{ margin: "10px 0 0", fontWeight: 700 }}>{FCFA(order.total)}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
