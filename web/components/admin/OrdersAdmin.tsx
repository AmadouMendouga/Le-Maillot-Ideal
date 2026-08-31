"use client";

// Onglet Commandes — addendum au plan de migration (suivi de commandes +
// collecte d'avis post-achat). Contrairement à ProductsAdmin/GalleryAdmin, pas
// de onSnapshot ici : orders est fermée en lecture côté client (firestore.rules),
// donc la liste vient uniquement du Server Component parent et se rafraîchit
// via router.refresh() après chaque action.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/admin/Drawer";
import { Icon } from "@/components/icons/Icon";
import { StatefulButton } from "@/components/StatefulButton";
import { showToast } from "@/components/Toast";
import { createOrderAction, markOrderDeliveredAction } from "@/lib/actions/orders";
import type { Order, SiteSettings } from "@/lib/types";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

function reviewRequestLink(order: Order, siteUrl: string): string {
  const url = `${siteUrl.replace(/\/$/, "")}/avis/${order.reviewToken}`;
  const msg =
    `Bonjour ${order.customerName} 👋 merci pour votre commande chez Le Maillot Idéal !\n\n` +
    `Pourriez-vous nous laisser un avis en quelques secondes ? ${url}\n\n` +
    "Merci beaucoup !";
  return `https://wa.me/${order.customerPhone}?text=${encodeURIComponent(msg)}`;
}

function NewOrderForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderSummary, setOrderSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await createOrderAction({ customerName, customerPhone, orderSummary });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast("Commande enregistrée", "check-circle");
      router.refresh();
      onClose();
    } catch {
      setError("Échec de l'enregistrement. Vérifiez votre connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {error ? (
        <div className="adm-warn">
          <Icon name="error" />
          <div>{error}</div>
        </div>
      ) : null}
      <div className="adm-field">
        <label>Nom du client</label>
        <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
      </div>
      <div className="adm-field">
        <label>Numéro WhatsApp</label>
        <input
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="237655634265"
          inputMode="tel"
        />
      </div>
      <div className="adm-field">
        <label>Résumé de la commande</label>
        <textarea
          value={orderSummary}
          onChange={(e) => setOrderSummary(e.target.value)}
          placeholder="2x PSG domicile L, 1x OM domicile M"
        />
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving}>
        <Icon name="check-circle" size="sm" />
        {saving ? "Enregistrement…" : "Enregistrer la commande"}
      </button>
    </>
  );
}

export function OrdersAdmin({ initialOrders, settings }: { initialOrders: Order[]; settings: SiteSettings }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formNonce, setFormNonce] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openNewOrder() {
    setFormNonce((n) => n + 1);
    setDrawerOpen(true);
  }

  async function markDelivered(order: Order) {
    setBusyId(order.id);
    try {
      const result = await markOrderDeliveredAction(order.id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      showToast("Commande marquée livrée", "check-circle");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="adm-warn">
        <Icon name="info" />
        <div>
          Enregistrez ici une commande une fois confirmée sur WhatsApp. Une fois marquée « Livrée », un lien de dépôt
          d&apos;avis à usage unique est généré — envoyez-le au client pour recueillir un vrai retour, jamais inventé
          (CLAUDE.md §2).
        </div>
      </div>
      <div className="adm-toolbar">
        <button type="button" className="btn btn-tonal btn-sm" onClick={openNewOrder}>
          <Icon name="add" size="sm" />
          Nouvelle commande
        </button>
        <span className="adm-count">
          {initialOrders.length} commande{initialOrders.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Commande</th>
              <th style={{ width: 120 }}>État</th>
              <th style={{ width: 260 }}></th>
            </tr>
          </thead>
          <tbody>
            {initialOrders.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="adm-empty">
                    <Icon name="shipping" />
                    <div>Aucune commande enregistrée pour le moment.</div>
                  </div>
                </td>
              </tr>
            ) : (
              initialOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <div className="name">{order.customerName}</div>
                    <div className="sub">{order.customerPhone}</div>
                  </td>
                  <td>
                    <div className="sub">{order.orderSummary}</div>
                  </td>
                  <td>{statusBadge(order)}</td>
                  <td>
                    <div className="adm-row-actions">
                      {order.status === "confirmee" ? (
                        <button
                          type="button"
                          className="btn btn-tonal btn-sm"
                          disabled={busyId === order.id}
                          onClick={() => markDelivered(order)}
                        >
                          <Icon name="check-circle" size="sm" />
                          Marquer livrée
                        </button>
                      ) : order.reviewSubmitted ? (
                        <span className="badge badge-new">
                          <Icon name="star" size="sm" />
                          Avis reçu
                        </span>
                      ) : order.reviewToken ? (
                        <StatefulButton
                          className="btn btn-whatsapp btn-sm"
                          href={reviewRequestLink(order, settings.siteUrl)}
                          target="_blank"
                          rel="noopener"
                          onRun={() => wait(600)}
                        >
                          <Icon name="whatsapp" size="sm" />
                          Demander un avis
                        </StatefulButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Nouvelle commande" titleIcon="shipping">
        <NewOrderForm key={formNonce} onClose={() => setDrawerOpen(false)} />
      </Drawer>
    </section>
  );
}
