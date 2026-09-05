"use client";

// Onglet Commandes — addendum au plan de migration (suivi de commandes +
// collecte d'avis post-achat). Contrairement à ProductsAdmin/GalleryAdmin, pas
// de onSnapshot ici : orders est fermée en lecture côté client (firestore.rules),
// donc la liste vient uniquement du Server Component parent et se rafraîchit
// via router.refresh() après chaque action.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/admin/Drawer";
import { DeliveryMap } from "@/components/delivery/DeliveryMap";
import { Icon } from "@/components/icons/Icon";
import { StatefulButton } from "@/components/StatefulButton";
import { showToast } from "@/components/Toast";
import {
  createOrderAction,
  markOrderDeliveredAction,
  updateOrderAddressAction,
  getOrCreateLocationTokenAction,
  getOrderLocationAction,
  getOrderLocationHistoryAction,
  type LocationPoint,
} from "@/lib/actions/orders";
import { assignCourierToOrderAction, setCourierActiveAction } from "@/lib/actions/couriers";
import type { Courier, Order, OrderItem, Product, SiteSettings } from "@/lib/types";

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

function reviewRequestLink(order: Order, siteUrl: string, businessName: string): string {
  const url = `${siteUrl.replace(/\/$/, "")}/avis/${order.reviewToken}`;
  const msg =
    `Bonjour ${order.customerName} 👋 merci pour votre commande chez ${businessName} !\n\n` +
    `Pourriez-vous nous laisser un avis en quelques secondes ? ${url}\n\n` +
    "Merci beaucoup !";
  return `https://wa.me/${order.customerPhone}?text=${encodeURIComponent(msg)}`;
}

function customerLocationRequestLink(order: Order, siteUrl: string, token: string): string {
  const url = `${siteUrl.replace(/\/$/, "")}/livraison/${token}`;
  const msg =
    `Bonjour ${order.customerName} 👋 pour faciliter votre livraison, pourriez-vous partager votre position ici : ${url}\n\n` +
    "Ça ne prend que quelques secondes, merci !";
  return `https://wa.me/${order.customerPhone}?text=${encodeURIComponent(msg)}`;
}

// Qui livre varie (Djimi ou une aide ponctuelle, CLAUDE.md) — pas de numéro
// fixe à qui envoyer automatiquement, contrairement au client. On copie donc
// le lien brut pour que l'admin l'envoie lui-même à qui livre cette fois.
function courierLocationUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/livraison/${token}`;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `il y a ${hours} h`;
}

// Rafraîchit la carte toutes les 6s, uniquement pendant que le tiroir est
// ouvert — pas de sondage en arrière-plan pour chaque commande de la liste.
const MAP_POLL_MS = 6000;

function LocationMapDrawer({
  order,
  open,
  onClose,
}: {
  order: Order;
  open: boolean;
  onClose: () => void;
}) {
  const [customerTrack, setCustomerTrack] = useState({
    points: [] as LocationPoint[],
    current: order.liveLocation,
    sharing: order.locationSharing,
  });
  const [courierTrack, setCourierTrack] = useState({
    points: [] as LocationPoint[],
    current: order.courierLiveLocation,
    sharing: order.courierLocationSharing,
  });

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    async function poll() {
      const [c, l] = await Promise.all([
        getOrderLocationHistoryAction(order.id, "customer"),
        getOrderLocationHistoryAction(order.id, "courier"),
      ]);
      if (cancelled) return;
      if (c.ok) setCustomerTrack({ points: c.points, current: c.liveLocation, sharing: c.locationSharing });
      if (l.ok) setCourierTrack({ points: l.points, current: l.liveLocation, sharing: l.locationSharing });
    }
    poll();
    const id = setInterval(poll, MAP_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, order.id]);

  function statusLine(label: string, track: typeof customerTrack) {
    if (!track.current) return null;
    return (
      <p className="sub">
        <strong>{label}</strong> — {track.sharing ? "partage actif" : "partage arrêté"} · dernière position{" "}
        {timeAgo(track.current.updatedAt)}
        {track.points.length ? ` · ${track.points.length} point${track.points.length > 1 ? "s" : ""}` : ""}
      </p>
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title={`Trajet — ${order.customerName}`} titleIcon="location">
      <DeliveryMap customer={customerTrack} courier={courierTrack} />
      <div style={{ marginTop: 12, display: "flex", gap: 14, fontSize: ".78rem", color: "var(--on-surface-variant)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ff6b00", display: "inline-block" }} />
          Client
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
          Livreur
        </span>
        {customerTrack.current && courierTrack.current ? (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 2, background: "#1e3a8a", display: "inline-block" }} />
            Itinéraire suggéré
          </span>
        ) : null}
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {statusLine("Client", customerTrack)}
        {statusLine("Livreur", courierTrack)}
        {!customerTrack.current && !courierTrack.current ? (
          <p className="sub">Aucune position partagée pour le moment.</p>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {customerTrack.current ? (
            <a
              className="btn btn-tonal btn-sm"
              href={`https://www.google.com/maps?q=${customerTrack.current.lat},${customerTrack.current.lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="location" size="sm" />
              Client dans Maps
            </a>
          ) : null}
          {courierTrack.current ? (
            <a
              className="btn btn-tonal btn-sm"
              href={`https://www.google.com/maps?q=${courierTrack.current.lat},${courierTrack.current.lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="location" size="sm" />
              Livreur dans Maps
            </a>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}

function RoleLocationRow({
  order,
  settings,
  role,
  label,
  token,
  setToken,
  location,
  sharing,
  couriers,
  assignedCourierId,
  onAssignCourier,
}: {
  order: Order;
  settings: SiteSettings;
  role: "customer" | "courier";
  label: string;
  token: string | null;
  setToken: (t: string) => void;
  location: Order["liveLocation"];
  sharing: boolean;
  /** Uniquement pour role === "courier" : livreurs enregistrés parmi lesquels choisir. */
  couriers?: Courier[];
  assignedCourierId?: string | null;
  onAssignCourier?: (courierId: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  async function requestCustomer() {
    setLoading(true);
    // Ouvert tout de suite, dans le même tick que le clic (geste utilisateur) :
    // si l'ouverture attend la fin de getOrCreateLocationTokenAction ci-dessous,
    // le navigateur la traite comme un pop-up non sollicité et la bloque
    // silencieusement — d'où le « premier clic ne fait rien, le deuxième
    // marche » (le jeton est alors déjà en cache, plus d'attente avant
    // l'ouverture). Pas de `noopener` ici : on doit garder la référence pour
    // naviguer l'onglet une fois le jeton prêt ; wa.me est un domaine de
    // confiance, le compromis est sûr.
    const newTab = window.open("about:blank", "_blank");
    try {
      let t = token;
      if (!t) {
        const result = await getOrCreateLocationTokenAction(order.id, "customer");
        if (!result.ok) {
          newTab?.close();
          alert(result.error);
          return;
        }
        t = result.token;
        setToken(t);
      }
      const url = customerLocationRequestLink(order, settings.siteUrl, t);
      if (newTab) newTab.location.href = url;
      else window.open(url, "_blank");
    } finally {
      setLoading(false);
    }
  }

  async function requestCourier() {
    setLoading(true);
    try {
      let t = token;
      if (!t) {
        const result = await getOrCreateLocationTokenAction(order.id, "courier");
        if (!result.ok) {
          alert(result.error);
          return;
        }
        t = result.token;
        setToken(t);
      }
      await navigator.clipboard.writeText(courierLocationUrl(settings.siteUrl, t));
      showToast("Lien copié — envoyez-le à qui livre cette commande", "check-circle");
    } catch {
      alert("Impossible de copier le lien. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value || null;
    setAssigning(true);
    try {
      const result = await assignCourierToOrderAction(order.id, id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      onAssignCourier?.(id);
      if (id) showToast("Livreur assigné — il verra la livraison sur son lien personnel", "check-circle");
    } finally {
      setAssigning(false);
    }
  }

  // Choix d'un livreur enregistré : liste au-dessus du lien ponctuel, qui
  // reste la solution de secours (aide occasionnelle, aucun livreur
  // enregistré disponible — voir Courier dans lib/types.ts).
  const courierPicker =
    role === "courier" && couriers ? (
      <select
        aria-label="Assigner un livreur enregistré"
        value={assignedCourierId || ""}
        onChange={handleAssignChange}
        disabled={assigning}
        style={{ fontSize: ".76rem", padding: "3px 6px", maxWidth: 150 }}
      >
        <option value="">Lien ponctuel (manuel)</option>
        {couriers
          .filter((c) => c.active || c.id === assignedCourierId)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </select>
    ) : null;

  if (!location) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="sub" style={{ minWidth: 44 }}>
            {label}
          </span>
          <button
            type="button"
            className="btn btn-tonal btn-sm"
            disabled={loading}
            onClick={role === "customer" ? requestCustomer : requestCourier}
          >
            <Icon name="location" size="sm" />
            {token ? "Renvoyer" : "Demander"}
          </button>
        </div>
        {courierPicker}
      </div>
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
        <span className="sub">
          {label} · {sharing ? "actif" : "arrêté"} · {timeAgo(location.updatedAt)}
        </span>
      </div>
      {courierPicker}
    </div>
  );
}

function LocationCell({ order, settings, couriers }: { order: Order; settings: SiteSettings; couriers: Courier[] }) {
  const [customerToken, setCustomerToken] = useState(order.locationToken);
  const [courierToken, setCourierToken] = useState(order.courierLocationToken);
  const [customerLocation, setCustomerLocation] = useState(order.liveLocation);
  const [customerSharing, setCustomerSharing] = useState(order.locationSharing);
  const [courierLocation, setCourierLocation] = useState(order.courierLiveLocation);
  const [courierSharing, setCourierSharing] = useState(order.courierLocationSharing);
  const [assignedCourierId, setAssignedCourierId] = useState(order.assignedCourierId || null);
  const [mapOpen, setMapOpen] = useState(false);

  // Rafraîchit les deux statuts en un coup (pas de bouton dédié par ligne —
  // un seul point d'entrée, moins de boutons à comprendre dans une cellule
  // de tableau déjà chargée).
  useEffect(() => {
    if (!customerLocation && !courierLocation) return;
    let cancelled = false;
    async function refresh() {
      const [c, l] = await Promise.all([
        getOrderLocationAction(order.id, "customer"),
        getOrderLocationAction(order.id, "courier"),
      ]);
      if (cancelled) return;
      if (c.ok) {
        setCustomerLocation(c.liveLocation);
        setCustomerSharing(c.locationSharing);
      }
      if (l.ok) {
        setCourierLocation(l.liveLocation);
        setCourierSharing(l.locationSharing);
      }
    }
    const id = setInterval(refresh, MAP_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne redémarre pas le minuteur à chaque tick, seulement quand une position apparaît pour la première fois
  }, [order.id, !customerLocation && !courierLocation]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <RoleLocationRow
        order={order}
        settings={settings}
        role="customer"
        label="Client"
        token={customerToken}
        setToken={setCustomerToken}
        location={customerLocation}
        sharing={customerSharing}
      />
      <RoleLocationRow
        order={order}
        settings={settings}
        role="courier"
        label="Livreur"
        token={courierToken}
        setToken={setCourierToken}
        location={courierLocation}
        sharing={courierSharing}
        couriers={couriers}
        assignedCourierId={assignedCourierId}
        onAssignCourier={setAssignedCourierId}
      />
      {customerLocation || courierLocation ? (
        <button
          type="button"
          className="sub"
          style={{
            color: "var(--primary)",
            fontWeight: 600,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
          onClick={() => setMapOpen(true)}
        >
          Voir le trajet
        </button>
      ) : null}
      <LocationMapDrawer order={order} open={mapOpen} onClose={() => setMapOpen(false)} />
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
          aria-label="Adresse ou zone de livraison"
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

function NewOrderForm({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderSummary, setOrderSummary] = useState("");
  const [address, setAddress] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [pickSlug, setPickSlug] = useState("");
  const [pickSize, setPickSize] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const pickedProduct = products.find((p) => p.slug === pickSlug);

  function addItem() {
    const qty = Number(pickQty);
    if (!pickSlug || !pickSize || !Number.isFinite(qty) || qty < 1) return;
    setItems((list) => [...list, { slug: pickSlug, size: pickSize, qty }]);
    setPickSlug("");
    setPickSize("");
    setPickQty("1");
  }
  function removeItem(index: number) {
    setItems((list) => list.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await createOrderAction({ customerName, customerPhone, orderSummary, address, items });
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
        <label>Articles vendus — met à jour le stock</label>
        {items.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {items.map((item, i) => {
              const p = products.find((x) => x.slug === item.slug);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "6px 10px",
                    background: "var(--surface-container-low)",
                    borderRadius: "var(--r-item)",
                  }}
                >
                  <span className="sub">
                    {item.qty}x {p?.name || item.slug} ({item.size})
                  </span>
                  <button type="button" className="icon-btn danger" aria-label="Retirer cet article" onClick={() => removeItem(i)}>
                    <Icon name="close" size="sm" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <select
            aria-label="Choisir un maillot"
            value={pickSlug}
            onChange={(e) => {
              setPickSlug(e.target.value);
              setPickSize("");
            }}
            style={{ flex: "1 1 160px" }}
          >
            <option value="">Choisir un maillot…</option>
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} ({p.stock} en stock)
              </option>
            ))}
          </select>
          <select
            aria-label="Taille"
            value={pickSize}
            onChange={(e) => setPickSize(e.target.value)}
            disabled={!pickedProduct}
            style={{ flex: "0 1 90px" }}
          >
            <option value="">Taille</option>
            {pickedProduct?.sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            aria-label="Quantité"
            value={pickQty}
            onChange={(e) => setPickQty(e.target.value)}
            style={{ flex: "0 1 64px" }}
          />
          <button type="button" className="btn btn-tonal btn-sm" onClick={addItem} disabled={!pickSlug || !pickSize}>
            <Icon name="add" size="sm" />
            Ajouter
          </button>
        </div>
        <p className="hint" style={{ fontSize: ".78rem", color: "var(--on-surface-variant)", margin: "6px 0 0" }}>
          Laissez vide si vous préférez juste décrire la commande sans toucher au stock.
        </p>
      </div>

      <div className="adm-field">
        <label>Adresse / zone de livraison</label>
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

// Liste des livreurs enregistrés (voir /livreur/inscription) — l'admin ne les
// crée pas ici, il partage juste le lien d'inscription ; il peut seulement
// désactiver un profil qui ne livre plus (un livreur désactivé disparaît du
// menu déroulant de RoleLocationRow, mais reste sélectionnable là où il est
// déjà assigné, pour ne pas casser une livraison en cours).
function CouriersDrawer({
  open,
  onClose,
  couriers,
  siteUrl,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  couriers: Courier[];
  siteUrl: string;
  onToggle: (id: string, active: boolean) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const registerUrl = `${siteUrl.replace(/\/$/, "")}/livreur/inscription`;

  async function toggle(courier: Courier) {
    setBusyId(courier.id);
    try {
      const result = await setCourierActiveAction(courier.id, !courier.active);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      onToggle(courier.id, !courier.active);
    } finally {
      setBusyId(null);
    }
  }

  async function copyRegisterLink() {
    try {
      await navigator.clipboard.writeText(registerUrl);
      showToast("Lien copié — partagez-le avec vos livreurs", "check-circle");
    } catch {
      alert("Impossible de copier le lien.");
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Livreurs enregistrés" titleIcon="shipping">
      <p className="sub" style={{ marginBottom: 14 }}>
        Un livreur s&apos;enregistre lui-même via ce lien, puis apparaît ci-dessous et dans la liste d&apos;assignation
        de chaque commande.
      </p>
      <button type="button" className="btn btn-tonal btn-block" style={{ marginBottom: 20 }} onClick={copyRegisterLink}>
        <Icon name="publish" size="sm" />
        Copier le lien d&apos;inscription
      </button>

      {couriers.length === 0 ? (
        <div className="adm-empty">
          <Icon name="shipping" />
          <div>Aucun livreur enregistré pour le moment.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {couriers.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 12px",
                background: "var(--surface-container-low)",
                borderRadius: "var(--r-item)",
              }}
            >
              <div>
                <div className="name">{c.name}</div>
                <div className="sub">{c.phone}</div>
              </div>
              <button type="button" className="btn btn-tonal btn-sm" disabled={busyId === c.id} onClick={() => toggle(c)}>
                {c.active ? "Désactiver" : "Réactiver"}
              </button>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}

export function OrdersAdmin({
  initialOrders,
  products,
  settings,
  initialCouriers,
}: {
  initialOrders: Order[];
  products: Product[];
  settings: SiteSettings;
  initialCouriers: Courier[];
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [couriersOpen, setCouriersOpen] = useState(false);
  const [couriers, setCouriers] = useState(initialCouriers);
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
        <button type="button" className="btn btn-tonal btn-sm" onClick={() => setCouriersOpen(true)}>
          <Icon name="shipping" size="sm" />
          Livreurs ({couriers.filter((c) => c.active).length})
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
                    <LocationCell order={order} settings={settings} couriers={couriers} />
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
                          href={reviewRequestLink(order, settings.siteUrl, settings.businessName)}
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
        <NewOrderForm key={formNonce} products={products} onClose={() => setDrawerOpen(false)} />
      </Drawer>

      <CouriersDrawer
        open={couriersOpen}
        onClose={() => setCouriersOpen(false)}
        couriers={couriers}
        siteUrl={settings.siteUrl}
        onToggle={(id, active) => setCouriers((list) => list.map((c) => (c.id === id ? { ...c, active } : c)))}
      />
    </section>
  );
}
