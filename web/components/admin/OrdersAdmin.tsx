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
import {
  createOrderAction,
  markOrderDeliveredAction,
  updateOrderAddressAction,
  getOrCreateLocationTokenAction,
  getOrderLocationAction,
} from "@/lib/actions/orders";
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

function locationRequestLink(order: Order, siteUrl: string, token: string): string {
  const url = `${siteUrl.replace(/\/$/, "")}/livraison/${token}`;
  const msg =
    `Bonjour ${order.customerName} 👋 pour faciliter votre livraison, pourriez-vous partager votre position ici : ${url}\n\n` +
    "Ça ne prend que quelques secondes, merci !";
  return `https://wa.me/${order.customerPhone}?text=${encodeURIComponent(msg)}`;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `il y a ${hours} h`;
}

function LocationCell({ order, settings }: { order: Order; settings: SiteSettings }) {
  const [token, setToken] = useState(order.locationToken);
  const [location, setLocation] = useState(order.liveLocation);
  const [sharing, setSharing] = useState(order.locationSharing);
  const [loading, setLoading] = useState(false);

  async function requestLocation() {
    setLoading(true);
    try {
      let t = token;
      if (!t) {
        const result = await getOrCreateLocationTokenAction(order.id);
        if (!result.ok) {
          alert(result.error);
          return;
        }
        t = result.token;
        setToken(t);
      }
      window.open(locationRequestLink(order, settings.siteUrl, t), "_blank", "noopener");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);
    try {
      const result = await getOrderLocationAction(order.id);
      if (result.ok) {
        setLocation(result.liveLocation);
        setSharing(result.locationSharing);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!location) {
    return (
      <button type="button" className="btn btn-tonal btn-sm" disabled={loading} onClick={requestLocation}>
        <Icon name="location" size="sm" />
        {token ? "Renvoyer" : "Demander"}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            flexShrink: 0,
            background: sharing ? "var(--secondary)" : "var(--on-surface-variant)",
          }}
        />
        <a
          href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="sub"
          style={{ color: "var(--primary)", fontWeight: 600 }}
        >
          Ouvrir dans Maps
        </a>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="sub">{sharing ? "Partage actif" : "Arrêté"} · {timeAgo(location.updatedAt)}</span>
        <button type="button" className="icon-btn" aria-label="Actualiser la position" disabled={loading} onClick={refresh}>
          <Icon name="refresh" size="sm" />
        </button>
      </div>
    </div>
  );
}

function AddressCell({ order }: { order: Order }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(order.address || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const result = await updateOrderAddressAction(order.id, value);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Adresse / zone"
          style={{ minWidth: 160 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <button type="button" className="icon-btn" aria-label="Enregistrer l'adresse" disabled={saving} onClick={save}>
          <Icon name="check-circle" size="sm" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="icon-btn"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "auto", padding: "4px 8px" }}
      onClick={() => setEditing(true)}
    >
      <Icon name="location" size="sm" />
      <span className="sub" style={{ maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {order.address || "Non renseignée"}
      </span>
    </button>
  );
}

function NewOrderForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderSummary, setOrderSummary] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await createOrderAction({ customerName, customerPhone, orderSummary, address });
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
      <div className="adm-field">
        <label>Adresse / zone de livraison (facultatif)</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Ex. Bonamoussadi, derrière la pharmacie…"
        />
        <p className="hint" style={{ fontSize: ".78rem", color: "var(--on-surface-variant)", margin: "4px 0 0" }}>
          Pas encore connue ? Laissez vide, vous pourrez la renseigner plus tard depuis le tableau.
        </p>
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
              <th style={{ width: 180 }}>Adresse / zone</th>
              <th style={{ width: 170 }}>Position en direct</th>
              <th style={{ width: 120 }}>État</th>
              <th style={{ width: 260 }}></th>
            </tr>
          </thead>
          <tbody>
            {initialOrders.length === 0 ? (
              <tr>
                <td colSpan={6}>
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
                  <td>
                    <AddressCell order={order} />
                  </td>
                  <td>
                    <LocationCell order={order} settings={settings} />
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
