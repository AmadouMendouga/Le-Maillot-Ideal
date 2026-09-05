"use client";

// Partage de position en direct pendant la livraison — gardé par
// locationToken (lib/actions/orders.ts), pas par une session, même principe
// que le dépôt d'avis. Ne démarre jamais tout seul : la demande de
// permission navigateur part uniquement d'un geste explicite (bouton), et
// un bouton « Arrêter » est toujours visible une fois le partage actif.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";
import {
  updateLiveLocationAction,
  stopLocationSharingAction,
  getSharedLocationViewAction,
  markOrderDeliveredByCourierAction,
  type SharedTrack,
  type CourierDeliveryDetails,
} from "@/lib/actions/orders";
import { DeliveryMap } from "@/components/delivery/DeliveryMap";
import { showToast } from "@/components/Toast";

// Le navigateur peut rappeler watchPosition très souvent (chaque seconde en
// haute précision) — on ne remonte au serveur qu'au maximum toutes les 10s,
// largement suffisant pour suivre un livreur/client en déplacement.
const MIN_INTERVAL_MS = 10000;

// Même cadence que le tiroir admin (OrdersAdmin.tsx, LocationMapDrawer) —
// assez réactif pour suivre un trajet, sans bombarder Firestore.
const MAP_POLL_MS = 6000;

type Status = "idle" | "sharing" | "stopped" | "denied" | "unavailable" | "unsupported";

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `il y a ${hours} h`;
}

function trackStatusLine(label: string, track: SharedTrack) {
  if (!track.current) return null;
  return (
    <p className="sub">
      <strong>{label}</strong> — {track.sharing ? "partage actif" : "partage arrêté"} · dernière position{" "}
      {timeAgo(track.current.updatedAt)}
    </p>
  );
}

const EMPTY_TRACK: SharedTrack = { points: [], current: null, sharing: false };

const STEPS = ["Confirmée", "En route", "Livrée"] as const;

// Repère visuel de progression (retour client du 06/09/2026, inspiré des
// apps de suivi de colis) — dérivé d'état déjà disponible, pas d'un champ
// dédié : "en route" = le livreur partage sa position, "livrée" = cette
// session vient de la marquer comme telle (voir `delivered` plus bas).
function DeliveryStepper({ step }: { step: 0 | 1 | 2 }) {
  return (
    <div className="dlv-stepper" role="status" aria-label={`Étape ${step + 1} sur 3 : ${STEPS[step]}`}>
      {STEPS.map((label, i) => (
        <div key={label} className="dlv-stepper-item">
          <div className={"dlv-step" + (i <= step ? " done" : "") + (i === step ? " current" : "")}>
            <span className="dot" aria-hidden="true" />
            <span className="label">{label}</span>
          </div>
          {i < STEPS.length - 1 ? <span className={"dlv-step-line" + (i < step ? " done" : "")} aria-hidden="true" /> : null}
        </div>
      ))}
    </div>
  );
}

// Légende + lignes de statut par piste, affichées dans le panneau flottant
// sous les infos principales — même contenu qu'avant, juste replié dans le
// panneau plutôt que dans sa propre carte (voir dlv-sheet plus bas).
function TrackLegend({ view }: { view: { customer: SharedTrack; courier: SharedTrack } | null }) {
  if (!view || (!view.customer.current && !view.courier.current)) {
    return <p className="form-note">La carte s&apos;affichera dès qu&apos;une position sera partagée.</p>;
  }
  return (
    <div className="dlv-sheet-status">
      <div style={{ display: "flex", gap: 14, fontSize: ".78rem", color: "var(--on-surface-variant)", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ff6b00", display: "inline-block" }} />
          Client
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
          Livreur
        </span>
        {view.customer.current && view.courier.current ? (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 2, background: "#1e3a8a", display: "inline-block" }} />
            Itinéraire suggéré
          </span>
        ) : null}
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        {trackStatusLine("Client", view.customer)}
        {trackStatusLine("Livreur", view.courier)}
      </div>
    </div>
  );
}

export function LocationSharingForm({
  token,
  customerName,
  initialSharing,
  role,
  delivery,
  deliveryCode,
}: {
  token: string;
  customerName: string;
  initialSharing: boolean;
  /** "customer" : aide à localiser l'adresse de livraison. "courier" : celui qui livre (Djimi ou une aide ponctuelle) partage sa position en route. */
  role: "customer" | "courier";
  /** Détails de la commande, présents uniquement côté livreur (voir getOrderForLocationAction). */
  delivery?: CourierDeliveryDetails;
  /** Code à 4 chiffres, présent uniquement côté client — à donner au livreur pour qu'il clôture la livraison. */
  deliveryCode?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [lastUpdateAt, setLastUpdateAt] = useState<Date | null>(null);
  const [sharedView, setSharedView] = useState<{ customer: SharedTrack; courier: SharedTrack } | null>(null);
  const [delivering, setDelivering] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Sondage indépendant du statut de CE navigateur : le client voit la
  // position du livreur même s'il n'a pas encore cliqué "Partager ma
  // position" ici, et inversement.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const result = await getSharedLocationViewAction(token);
      if (!cancelled && result.ok) setSharedView({ customer: result.customer, courier: result.courier });
    }
    poll();
    const id = setInterval(poll, MAP_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  function handlePosition(pos: GeolocationPosition) {
    setStatus("sharing");
    const now = Date.now();
    if (now - lastSentRef.current < MIN_INTERVAL_MS) return;
    lastSentRef.current = now;
    updateLiveLocationAction(token, pos.coords.latitude, pos.coords.longitude)
      .then((result) => {
        if (result.ok) setLastUpdateAt(new Date());
      })
      .catch(() => {
        // silencieux — la prochaine position (dans MIN_INTERVAL_MS) réessaiera
      });
  }

  function handleError(err: GeolocationPositionError) {
    if (err.code === err.PERMISSION_DENIED) setStatus("denied");
    else setStatus("unavailable");
  }

  function startSharing() {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    });
  }

  async function markDelivered() {
    setCodeError("");
    if (codeInput.trim().length !== 4) {
      setCodeError("Saisissez les 4 chiffres donnés par le client.");
      return;
    }
    setDelivering(true);
    try {
      const result = await markOrderDeliveredByCourierAction(token, codeInput.trim());
      if (!result.ok) {
        setCodeError(result.error);
        return;
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setDelivered(true);
    } catch {
      showToast("Échec de l'enregistrement. Vérifiez votre connexion et réessayez.", "error", true);
    } finally {
      setDelivering(false);
    }
  }

  async function stopSharing() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus("stopped");
    try {
      await stopLocationSharingAction(token);
    } catch {
      // best effort — l'arrêt côté navigateur est ce qui compte réellement
    }
  }

  const customerTrack = sharedView?.customer ?? EMPTY_TRACK;
  const courierTrack = sharedView?.courier ?? EMPTY_TRACK;
  const step: 0 | 1 | 2 = delivered ? 2 : courierTrack.sharing ? 1 : 0;

  let sheet: ReactNode;
  if (delivered) {
    sheet = (
      <div className="review-thanks">
        <Icon name="check-circle" size="xl" />
        <h3>Livraison terminée !</h3>
        <p>Merci d&apos;avoir livré la commande de {customerName}. Le partage de position est arrêté.</p>
      </div>
    );
  } else if (status === "stopped") {
    sheet = (
      <div className="review-thanks">
        <Icon name="check-circle" size="xl" />
        <h3>Partage arrêté</h3>
        <p>{role === "courier" ? "Merci, votre position n'est plus transmise." : `Merci ${customerName}, votre position n'est plus transmise.`}</p>
      </div>
    );
  } else if (status === "sharing") {
    sheet = (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--secondary)",
              boxShadow: "0 0 0 4px color-mix(in srgb, var(--secondary) 25%, transparent)",
              flexShrink: 0,
            }}
          />
          <h3 style={{ margin: 0 }}>Partage actif</h3>
        </div>
        <p className="form-note">
          {lastUpdateAt ? `Dernière position envoyée à ${lastUpdateAt.toLocaleTimeString("fr-FR")}.` : "Localisation en cours…"}
        </p>
        <button type="button" className="btn btn-tonal btn-lg btn-block" onClick={stopSharing}>
          <Icon name="close" size="sm" />
          Arrêter le partage
        </button>
      </>
    );
  } else if (status === "denied") {
    sheet = (
      <>
        <h3>Position refusée</h3>
        <p>
          Votre navigateur a bloqué l&apos;accès à votre position. Autorisez la localisation pour ce site dans les
          réglages de votre navigateur, puis rechargez la page.
        </p>
      </>
    );
  } else if (status === "unavailable" || status === "unsupported") {
    sheet = (
      <>
        <h3>Position indisponible</h3>
        <p>Impossible d&apos;obtenir votre position pour le moment. Réessayez, ou contactez-nous sur WhatsApp.</p>
      </>
    );
  } else {
    sheet = (
      <>
        {role === "courier" ? (
          <>
            <h3>Bonjour 👋</h3>
            <p>
              Merci de livrer la commande de {customerName} ! Partagez votre position pendant le trajet pour qu&apos;IKIGAI
              Sport puisse suivre la livraison en direct. Elle n&apos;est visible que par eux, sert uniquement à
              cette livraison, et vous pouvez arrêter à tout moment.
            </p>
          </>
        ) : (
          <>
            <h3>Bonjour {customerName} 👋</h3>
            <p>
              Partagez votre position pour aider à localiser votre lieu de livraison. Elle n&apos;est visible que par
              IKIGAI Sport, sert uniquement à cette livraison, et vous pouvez arrêter à tout moment.
            </p>
          </>
        )}
        {initialSharing ? (
          <p className="form-note">Un partage était déjà en cours sur un autre onglet — vous pouvez le reprendre ici.</p>
        ) : null}
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={startSharing}>
          <Icon name="location" size="sm" />
          Partager ma position
        </button>
      </>
    );
  }

  return (
    <div className="dlv-screen">
      <DeliveryMap
        customer={customerTrack}
        courier={courierTrack}
        fullScreen
        darkMap={role === "courier"}
        showRouteStats={role === "courier"}
      />
      <div className="dlv-sheet">
        <DeliveryStepper step={step} />
        {sheet}

        {role === "courier" && delivery && !delivered ? (
          <div style={{ margin: "16px 0", paddingTop: 16, borderTop: "1px solid var(--outline-variant)" }}>
            <p style={{ fontWeight: 700, marginBottom: 2 }}>{customerName}</p>
            {delivery.address ? (
              <p className="sub" style={{ margin: 0 }}>
                {delivery.address}
              </p>
            ) : null}
            <p className="sub" style={{ margin: "6px 0 14px" }}>
              {delivery.orderSummary}
            </p>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <a
                className="btn btn-whatsapp"
                style={{ flex: 1 }}
                href={`https://wa.me/${delivery.customerPhone}`}
                target="_blank"
                rel="noopener"
              >
                <Icon name="whatsapp" size="sm" />
                WhatsApp
              </a>
              <a className="btn btn-tonal" style={{ flex: 1 }} href={`tel:+${delivery.customerPhone}`}>
                <Icon name="phone" size="sm" />
                Appeler
              </a>
            </div>

            <div className="form-row" style={{ marginBottom: 8 }}>
              <label htmlFor="dlvCode">Code du client (4 chiffres)</label>
              <input
                id="dlvCode"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                placeholder="0000"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4));
                  setCodeError("");
                }}
                style={{ fontSize: "1.3rem", letterSpacing: "0.3em", textAlign: "center" }}
              />
            </div>
            {codeError ? (
              <p className="form-note" style={{ color: "var(--error)" }}>
                {codeError}
              </p>
            ) : null}
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={markDelivered} disabled={delivering}>
              <Icon name="check-circle" size="sm" />
              {delivering ? "Enregistrement…" : "Confirmer la livraison"}
            </button>
          </div>
        ) : null}

        {role === "customer" && deliveryCode && !delivered && status !== "stopped" ? (
          <div className="dlv-code-box">
            <p>Votre code de livraison</p>
            <strong>{deliveryCode}</strong>
            <p className="sub">Donnez-le au livreur à la réception de votre commande.</p>
          </div>
        ) : null}

        <TrackLegend view={sharedView} />
      </div>
    </div>
  );
}
