"use client";

// Partage de position en direct pendant la livraison — gardé par
// locationToken (lib/actions/orders.ts), pas par une session, même principe
// que le dépôt d'avis. Ne démarre jamais tout seul : la demande de
// permission navigateur part uniquement d'un geste explicite (bouton), et
// un bouton « Arrêter » est toujours visible une fois le partage actif.
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons/Icon";
import { updateLiveLocationAction, stopLocationSharingAction } from "@/lib/actions/orders";

// Le navigateur peut rappeler watchPosition très souvent (chaque seconde en
// haute précision) — on ne remonte au serveur qu'au maximum toutes les 10s,
// largement suffisant pour suivre un livreur/client en déplacement.
const MIN_INTERVAL_MS = 10000;

type Status = "idle" | "sharing" | "stopped" | "denied" | "unavailable" | "unsupported";

export function LocationSharingForm({
  token,
  customerName,
  initialSharing,
}: {
  token: string;
  customerName: string;
  initialSharing: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [lastUpdateAt, setLastUpdateAt] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

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

  if (status === "stopped") {
    return (
      <div className="contact-card review-thanks">
        <Icon name="check-circle" size="xl" />
        <h3>Partage arrêté</h3>
        <p>Merci {customerName}, votre position n&apos;est plus transmise.</p>
      </div>
    );
  }

  if (status === "sharing") {
    return (
      <div className="contact-card">
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
          {lastUpdateAt
            ? `Dernière position envoyée à ${lastUpdateAt.toLocaleTimeString("fr-FR")}.`
            : "Localisation en cours…"}
        </p>
        <p>Votre position sert uniquement à faciliter votre livraison. Elle n&apos;est pas conservée après.</p>
        <button type="button" className="btn btn-tonal btn-lg btn-block" onClick={stopSharing}>
          <Icon name="close" size="sm" />
          Arrêter le partage
        </button>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="contact-card">
        <h3>Position refusée</h3>
        <p>
          Votre navigateur a bloqué l&apos;accès à votre position. Autorisez la localisation pour ce site dans les
          réglages de votre navigateur, puis rechargez la page.
        </p>
      </div>
    );
  }

  if (status === "unavailable" || status === "unsupported") {
    return (
      <div className="contact-card">
        <h3>Position indisponible</h3>
        <p>Impossible d&apos;obtenir votre position pour le moment. Réessayez, ou contactez-nous sur WhatsApp.</p>
      </div>
    );
  }

  return (
    <div className="contact-card">
      <h3>Bonjour {customerName} 👋</h3>
      <p>
        Partagez votre position pour aider à localiser votre lieu de livraison. Elle n&apos;est visible que par Le
        Maillot Idéal, sert uniquement à cette livraison, et vous pouvez arrêter à tout moment.
      </p>
      {initialSharing ? (
        <p className="form-note">Un partage était déjà en cours sur un autre onglet — vous pouvez le reprendre ici.</p>
      ) : null}
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={startSharing}>
        <Icon name="location" size="sm" />
        Partager ma position
      </button>
    </div>
  );
}
