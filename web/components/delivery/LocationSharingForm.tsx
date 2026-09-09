"use client";

// Partage de position en direct pendant la livraison — gardé par
// locationToken (lib/actions/orders.ts), pas par une session, même principe
// que le dépôt d'avis. Ne démarre jamais tout seul : la demande de
// permission navigateur part uniquement d'un geste explicite (bouton), et
// un bouton « Arrêter » est toujours visible une fois le partage actif.
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import { DeliverySuccess } from "@/components/account/DeliverySuccess";
import { Icon } from "@/components/icons/Icon";
import { ThemeToggle } from "@/components/nav/ThemeToggle";
import {
  updateLiveLocationAction,
  stopLocationSharingAction,
  getSharedLocationViewAction,
  markCourierArrivedAction,
  markOrderDeliveredByCourierAction,
  startDeliveryByCourierAction,
  type SharedTrack,
  type CourierDeliveryDetails,
} from "@/lib/actions/orders";
import { DeliveryMap } from "@/components/delivery/DeliveryMap";
import { showToast } from "@/components/Toast";
import { hasUsableAccuracy, routeLocationIssue, shouldAppendTrackPoint, type GeoSample } from "@/lib/location";
import { ORDER_STATUS_LABELS } from "@/lib/orderWorkflow";
import type { OrderStatus } from "@/lib/types";

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
  const ageSeconds = Math.max(0, Math.round((Date.now() - new Date(track.current.updatedAt).getTime()) / 1000));
  return (
    <p className="sub">
      <strong>{label}</strong> — {track.sharing ? "partage actif" : "partage arrêté"} · dernière position{" "}
      {timeAgo(track.current.updatedAt)}
      {ageSeconds > 45 && track.sharing ? " · signal interrompu" : ""}
      {track.current.accuracy ? ` · précision ±${Math.round(track.current.accuracy)} m` : ""}
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
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#1e2440", display: "inline-block" }} />
          Client
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
          Livreur
        </span>
        {view.customer.current && view.courier.current ? (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 2, background: "var(--on-surface)", display: "inline-block" }} />
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
  deliveryCodeQr,
  initialOrderStatus,
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
  /** QR encodant deliveryCode (data URL, généré côté serveur — voir lib/qr.ts), présent uniquement côté client. */
  deliveryCodeQr?: string;
  initialOrderStatus: OrderStatus;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [lastUpdateAt, setLastUpdateAt] = useState<Date | null>(null);
  const [sharedView, setSharedView] = useState<{ customer: SharedTrack; courier: SharedTrack } | null>(null);
  const [delivering, setDelivering] = useState(false);
  const [delivered, setDelivered] = useState(initialOrderStatus === "livree");
  const [reviewToken, setReviewToken] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(initialOrderStatus);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [scanError, setScanError] = useState("");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [locationWarning, setLocationWarning] = useState("");
  const [pollWarning, setPollWarning] = useState("");
  const [scanning, setScanning] = useState(false);
  const [panel, setPanel] = useState<"tracking" | "details" | "code">("tracking");
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const scanPendingRef = useRef(false);
  const scanRequestRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const lastAcceptedRef = useRef<GeoSample | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  function stopScan() {
    scanRequestRef.current += 1;
    scanPendingRef.current = false;
    if (scanRafRef.current !== null) cancelAnimationFrame(scanRafRef.current);
    scanRafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function startScan() {
    if (scanPendingRef.current || streamRef.current?.getTracks().some((track) => track.readyState === "live")) return;
    scanPendingRef.current = true;
    const requestId = ++scanRequestRef.current;
    setScanError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera-unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (requestId !== scanRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      scanPendingRef.current = false;
      streamRef.current = stream;
      setScanning(true);
      // <video> n'existe qu'une fois scanning=true (rendu conditionnel) —
      // le flux ne peut s'y attacher qu'après ce rendu.
      requestAnimationFrame(() => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      });
      // Décodage logiciel (jsQR) sur les trames de la caméra plutôt que l'API
      // native BarcodeDetector — celle-ci s'est révélée absente sur un vrai
      // téléphone testé le 07/09/2026 (Shape Detection API, disponible
      // seulement sur Chrome/Android avec Google Play Services, jamais sur
      // Safari/iOS). jsQR fonctionne partout où la caméra fonctionne.
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let lastScanAt = 0;
      const tick = (frameAt: number) => {
        const video = videoRef.current;
        if (!video || !ctx || video.readyState < 2 || frameAt - lastScanAt < 160) {
          scanRafRef.current = requestAnimationFrame(tick);
          return;
        }
        lastScanAt = frameAt;
        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "attemptBoth" });
        const value = result?.data.trim() ?? "";
        if (/^\d{4}$/.test(value)) {
          stopScan();
          setCodeInput(value);
          setCodeError("");
          showToast("Code scanné. Confirmez la remise de la commande.");
          return;
        }
        scanRafRef.current = requestAnimationFrame(tick);
      };
      scanRafRef.current = requestAnimationFrame(tick);
    } catch {
      if (requestId !== scanRequestRef.current) return;
      stopScan();
      setScanError("Caméra refusée ou indisponible. Saisissez le code manuellement.");
    }
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      wakeLockRef.current?.release().catch(() => {});
      stopScan();
    };
  }, []);

  // Sondage indépendant du statut de CE navigateur : le client voit la
  // position du livreur même s'il n'a pas encore cliqué "Partager ma
  // position" ici, et inversement.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let completed = false;
    let failures = 0;
    async function poll() {
      if (document.hidden) { timer = setTimeout(poll, MAP_POLL_MS); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 12000);
      try {
        const response = await fetch(`/api/delivery/${encodeURIComponent(token)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok && response.status !== 404) throw new Error("Actualisation impossible");
        const result = await response.json() as Awaited<ReturnType<typeof getSharedLocationViewAction>>;
        if (cancelled) return;
        if (!result.ok) {
          setPollWarning(result.error);
          return;
        }
        failures = 0;
        setPollWarning("");
        setSharedView({ customer: result.customer, courier: result.courier });
        setOrderStatus(result.status);
        if (result.delivered) {
          completed = true;
          setDelivered(true);
          stopScan();
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          wakeLockRef.current?.release().catch(() => {});
          wakeLockRef.current = null;
        }
        if (result.reviewToken) setReviewToken(result.reviewToken);
      } catch {
        failures++;
        if (!cancelled) setPollWarning("Actualisation interrompue. Vérifiez votre connexion ; le suivi réessaiera automatiquement.");
      } finally {
        clearTimeout(timeout);
        if (!cancelled && !completed) timer = setTimeout(poll, Math.min(60000, MAP_POLL_MS * Math.max(1, 2 ** failures)));
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [token]);

  function handlePosition(pos: GeolocationPosition) {
    setStatus("sharing");
    const now = Date.now();
    const accuracy = Math.round(pos.coords.accuracy);
    setGpsAccuracy(accuracy);
    if (!hasUsableAccuracy(accuracy)) {
      setLocationWarning("Signal GPS trop imprécis. Placez-vous près d'une fenêtre ou à l'extérieur.");
      return;
    }
    if (now - lastSentRef.current < MIN_INTERVAL_MS) return;
    const sample: GeoSample = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      at: new Date(now).toISOString(),
      accuracy,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
    };
    const append = shouldAppendTrackPoint(lastAcceptedRef.current, sample);
    const heartbeat = now - lastSentRef.current >= (role === "courier" ? 20000 : 60000);
    if (!append && !heartbeat) return;
    lastSentRef.current = now;
    updateLiveLocationAction(token, sample.lat, sample.lng, accuracy, sample.speed, sample.heading)
      .then((result) => {
        if (result.ok) {
          if (append) lastAcceptedRef.current = sample;
          setLastUpdateAt(new Date());
          setLocationWarning("");
        } else {
          setLocationWarning(result.error);
        }
      })
      .catch(() => {
        setLocationWarning("Position non envoyée. Vérifiez votre connexion ; une nouvelle tentative sera faite automatiquement.");
      });
  }

  function handleError(err: GeolocationPositionError) {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    if (err.code === err.PERMISSION_DENIED) setStatus("denied");
    else setStatus("unavailable");
  }

  async function startSharing() {
    if (startingRef.current) return;
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (watchIdRef.current !== null) return;
    startingRef.current = true;
    setStarting(true);
    setLocationWarning("");
    try {
      if (role === "courier" && orderStatus !== "en_route" && orderStatus !== "arrivee") {
        const started = await startDeliveryByCourierAction(token);
        if (!started.ok) {
          setLocationWarning(started.error);
          return;
        }
        setOrderStatus("en_route");
      }
      const wakeLockNavigator = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
      wakeLockRef.current = await wakeLockNavigator.wakeLock?.request("screen").catch(() => null) ?? null;
      watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      });
    } catch {
      setLocationWarning("Le partage n'a pas pu démarrer. Vérifiez votre connexion et réessayez.");
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  async function markDelivered(code: string = codeInput) {
    setCodeError("");
    if (code.trim().length !== 4) {
      setCodeError("Saisissez les 4 chiffres donnés par le client.");
      return;
    }
    setDelivering(true);
    try {
      const result = await markOrderDeliveredByCourierAction(token, code.trim());
      if (!result.ok) {
        setCodeError(result.error);
        return;
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      await wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      stopScan();
      setDelivered(true);
    } catch {
      showToast("Échec de l'enregistrement. Vérifiez votre connexion et réessayez.", "error", true);
    } finally {
      setDelivering(false);
    }
  }

  async function markArrived() {
    setDelivering(true);
    try {
      const result = await markCourierArrivedAction(token);
      if (!result.ok) return setCodeError(result.error);
      setOrderStatus("arrivee");
      setPanel("code");
      showToast("Arrivée signalée au client", "check-circle");
    } catch {
      setCodeError("L’arrivée n’a pas été enregistrée. Réessayez lorsque la connexion sera rétablie.");
    } finally {
      setDelivering(false);
    }
  }

  async function stopSharing() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    await wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    setStatus("stopped");
    try {
      await stopLocationSharingAction(token);
    } catch {
      // best effort — l'arrêt côté navigateur est ce qui compte réellement
    }
  }

  const customerTrack = sharedView?.customer ?? EMPTY_TRACK;
  const courierTrack = sharedView?.courier ?? EMPTY_TRACK;
  const step: 0 | 1 | 2 = delivered ? 2 : orderStatus === "en_route" || orderStatus === "arrivee" ? 1 : 0;

  let sheet: ReactNode;
  if (delivered) {
    sheet = (
      <div className="review-thanks">
        <Icon name="check-circle" size="xl" />
        <h3>Livraison terminée !</h3>
        <p>
          {role === "courier"
            ? `Merci d'avoir livré la commande de ${customerName}. Le partage de position est arrêté.`
            : "Votre commande a bien été livrée. Merci pour votre confiance !"}
        </p>
        {/* Proposé au client dès cet écran plutôt que d'attendre que l'admin
            pense à cliquer "Demander un avis" — le moment où l'enthousiasme
            est le plus fort. Le formulaire (avis + photo, modéré avant
            publication) existe déjà, /avis/[token] ; seul le déclenchement
            automatique ici est nouveau. */}
        {role === "customer" && reviewToken ? (
          <Link href={`/avis/${reviewToken}`} className="btn btn-primary btn-lg btn-block" style={{ marginTop: 16 }}>
            <Icon name="star" size="sm" />
            Donner mon avis (+ une photo)
          </Link>
        ) : null}
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
          {gpsAccuracy !== null ? ` Précision GPS : ±${gpsAccuracy} m.` : ""}
        </p>
        {locationWarning ? <p className="form-note" style={{ color: "var(--error)" }}>{locationWarning}</p> : null}
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
        {role === "courier" && (orderStatus === "en_route" || orderStatus === "arrivee") ? (
          <><h3>Reprendre le suivi</h3><p>La livraison est en cours. Partagez à nouveau votre position depuis cet appareil.</p></>
        ) : role === "courier" ? (
          <>
            <h3>Prêt pour la livraison</h3>
            <p>
              La commande de {customerName} est prête. Appuyez sur « Démarrer la course » au moment du départ :
              le suivi et la position du client ne seront activés qu&apos;à partir de cet instant.
            </p>
          </>
        ) : (
          <>
            <h3>Votre lieu de livraison</h3>
            <p>
              Partagez votre position pour aider à localiser votre lieu de livraison. Elle n&apos;est visible que par
              IKIGAI Sport, sert uniquement à cette livraison, et vous pouvez arrêter à tout moment.
            </p>
          </>
        )}
        {initialSharing ? (
          <p className="form-note">Un partage était déjà en cours sur un autre onglet — vous pouvez le reprendre ici.</p>
        ) : null}
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={startSharing} disabled={starting}>
          <Icon name="location" size="sm" />
          {starting ? "Démarrage…" : role === "courier" && orderStatus !== "en_route" && orderStatus !== "arrivee" ? "Démarrer la course" : "Partager ma position"}
        </button>
      </>
    );
  }

  const navigating = orderStatus === "en_route" || orderStatus === "arrivee";
  const canNavigate = navigating && customerTrack.current && courierTrack.current &&
    !routeLocationIssue(customerTrack.current, courierTrack.current);

  function openPanel(next: "tracking" | "details" | "code") {
    if (next !== "code") stopScan();
    setPanel(next);
  }

  const contactCard = role === "courier" && delivery ? (
    <div className="dlv-info-card">
      <div className="dlv-info-row">
        <span className="dlv-avatar" aria-hidden="true"><Icon name="person" /></span>
        <div className="dlv-info-text">
          <p className="name">{customerName}</p>
          <p className="sub">{delivery.address || "Lieu de livraison à préciser avec le client"}</p>
        </div>
        <div className="dlv-info-actions">
          <a className="dlv-icon-circle whatsapp" aria-label="Écrire au client sur WhatsApp"
            href={`https://wa.me/${delivery.customerPhone}`} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" />
          </a>
          <a className="dlv-icon-circle" aria-label="Appeler le client" href={`tel:+${delivery.customerPhone}`}>
            <Icon name="phone" />
          </a>
        </div>
      </div>
    </div>
  ) : null;

  if (delivered && role === "customer") return <div className="ik-app ik-delivery-complete-page"><DeliverySuccess reviewHref={reviewToken ? `/avis/${reviewToken}` : null} /></div>;

  return (
    <div className={"ik-app dlv-screen" + (role === "courier" ? " ik-courier-screen" : "")} data-panel={panel}>
      <header className="ik-tracking-header">
        <Link href="/" className="ik-round-button" aria-label="Revenir à l’accueil IKIGAI"><Icon name="arrow-back" /></Link>
        <div><span>IKIGAI SPORT</span><h1>{role === "courier" ? "Votre livraison" : "Suivre ma livraison"}</h1></div>
        {role === "courier" ? <button type="button" className="ik-round-button" aria-label="Détails de la livraison" onClick={() => openPanel("details")}><Icon name="info" /></button> : <ThemeToggle />}
      </header>
      <DeliveryMap customer={customerTrack} courier={courierTrack} fullScreen darkMap={role === "courier"} navigationMode={role === "courier" && navigating && !delivered && panel === "tracking"} routingEnabled={navigating && !delivered} showRouteStats={panel === "tracking"} viewportKey={panel} />
      <section className={"dlv-sheet" + (panel !== "tracking" ? " dlv-sheet--expanded" : "")} aria-label="Détails de la livraison">
        <div className="ik-sheet-handle" aria-hidden="true" />
        <div className="ik-tracking-tabs" role="group" aria-label="Affichage du suivi">
          <button type="button" aria-pressed={panel === "tracking"} onClick={() => openPanel("tracking")}>Itinéraire</button>
          <button type="button" aria-pressed={panel === "details"} onClick={() => openPanel("details")}>Détails</button>
          {!delivered && (role === "customer" ? Boolean(deliveryCode) : orderStatus === "arrivee") && (
            <button type="button" aria-pressed={panel === "code"} onClick={() => openPanel("code")}>Code de remise</button>
          )}
        </div>
        {status === "sharing" && !delivered ? (
          <div className="ik-sharing-control"><span>Partage de position actif</span>
            <button type="button" onClick={stopSharing}>Arrêter</button>
          </div>
        ) : navigating && !delivered ? (
          <div className="ik-sharing-control"><span>Votre position n’est pas partagée</span>
            <button type="button" onClick={startSharing} disabled={starting}>{starting ? "Démarrage…" : "Activer"}</button>
          </div>
        ) : null}
        <div className="ik-tracking-body">
          {delivered ? sheet : panel === "tracking" ? (
            <>
              <div className="ik-delivery-heading">
                <div><p className="ik-eyebrow">{role === "courier" ? "Votre course" : "Votre commande"}</p>
                  <h2>{ORDER_STATUS_LABELS[orderStatus]}</h2></div>
                <span className="ik-status-icon" aria-hidden="true"><Icon name={navigating ? "shipping" : "inventory"} /></span>
              </div>
              {role === "customer" ? <DeliveryStepper step={step} /> : null}
              {contactCard}
              {role === "customer" ? <p className="ik-muted">{orderStatus === "arrivee"
                ? "Le livreur est arrivé. Préparez votre code pour la remise en main propre."
                : navigating ? "Le livreur est en route. Les estimations apparaissent lorsque les deux positions sont disponibles."
                : "Le suivi commencera au départ du livreur."}</p> : null}
              {role === "courier" && !navigating ? <p className="ik-muted">Démarrez la course uniquement au moment de partir.</p> : null}
              {status === "sharing" && lastUpdateAt ? <p className="ik-gps-note"><span />Position envoyée à {lastUpdateAt.toLocaleTimeString("fr-FR")}</p> : null}
              {(status === "denied" || status === "unavailable" || status === "unsupported") ? <p className="ik-inline-warning">{status === "denied" ? "Localisation refusée. Retrouvez les instructions dans Détails." : "Position indisponible. Réessayez depuis Détails."}</p> : null}
            </>
          ) : panel === "details" ? (
            <>
              <div className="ik-delivery-heading"><h2>Détails de la livraison</h2><Icon name="shipping" /></div>
              {contactCard}
              {delivery ? <dl className="ik-delivery-facts">
                <div><dt>Commande</dt><dd>{delivery.orderSummary}</dd></div>
                <div><dt>Créneau</dt><dd>{delivery.deliverySlot || "À confirmer avec IKIGAI Sport"}</dd></div>
              </dl> : null}
              <div className="ik-location-settings">{sheet}
                {status === "stopped" || status === "unavailable" || status === "denied" ? (
                  <button type="button" className="btn btn-tonal btn-block" disabled={starting} onClick={startSharing}>
                    <Icon name="refresh" size="sm" />{starting ? "Démarrage…" : "Réessayer le partage"}
                  </button>
                ) : null}
              </div>
              <TrackLegend view={sharedView} />
            </>
          ) : role === "customer" && deliveryCode ? (
            <div className="ik-delivery-ticket">
              <p className="ik-eyebrow">IKIGAI SPORT</p><h2>Votre bon de livraison</h2>
              <p className="ik-muted">À présenter lors de la remise</p>
              {deliveryCodeQr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={deliveryCodeQr} alt="QR de votre code de remise" width={200} height={200} className="dlv-code-qr" />
              ) : null}
              <div className="ik-ticket-perforation" aria-hidden="true" />
              <dl className="ik-ticket-facts"><div><dt>Destinataire</dt><dd>{customerName}</dd></div><div><dt>Statut</dt><dd>{ORDER_STATUS_LABELS[orderStatus]}</dd></div></dl>
              <p className="ik-eyebrow">Code de remise</p><strong className="ik-ticket-code">{deliveryCode}</strong>
              <p className="ik-ticket-note"><Icon name="shield" size="sm" />Montrez ce code au livreur uniquement lorsque vous recevez la commande. Ne le donnez pas par téléphone.</p>
            </div>
          ) : orderStatus === "arrivee" ? (
            <div className="ik-code-form">
              <h2>Confirmer la remise</h2><p className="ik-muted">Scannez le QR du client ou saisissez son code.</p>
              {scanning ? (
                <div className="dlv-scan"><video ref={videoRef} muted playsInline />
                  <button type="button" className="btn btn-tonal btn-sm" onClick={stopScan}>Arrêter la caméra</button>
                </div>
              ) : (
                <button type="button" className="btn btn-tonal btn-block" onClick={startScan}><Icon name="qr-scanner" />Scanner le QR du client</button>
              )}
              {scanError ? <p className="ik-inline-warning" role="alert">{scanError}</p> : null}
              <div className="form-row">
                <label htmlFor="dlvCode">Code à 4 chiffres</label>
                <input id="dlvCode" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="0000"
                  aria-invalid={Boolean(codeError)} aria-describedby={codeError ? "dlvCodeError" : undefined}
                  value={codeInput} onChange={(e) => { setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4)); setCodeError(""); }} />
              </div>
            </div>
          ) : <p className="ik-muted">Le code sera demandé après l’arrivée du livreur.</p>}
          {locationWarning ? <p className="ik-inline-warning" role="status">{locationWarning}</p> : null}
          {pollWarning ? <p className="ik-inline-warning" role="status">{pollWarning}</p> : null}
          {codeError ? <p id="dlvCodeError" className="ik-inline-warning" role="alert">{codeError}</p> : null}
        </div>
        {!delivered && <div className="ik-tracking-action">
          {panel === "code" ? role === "courier" && orderStatus === "arrivee" ? (
            <button type="button" className="btn btn-primary btn-block" disabled={delivering || !/^\d{4}$/.test(codeInput)} onClick={() => markDelivered()}>
              <Icon name="check-circle" />{delivering ? "Enregistrement…" : "Confirmer la livraison"}
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-block" onClick={() => openPanel("tracking")}><Icon name="location" />Revenir à l’itinéraire</button>
          ) : panel === "details" ? (
            <button type="button" className="btn btn-tonal btn-block" onClick={() => openPanel("tracking")}>Revenir à l’itinéraire</button>
          ) : role === "courier" ? (
            <>
              {canNavigate && customerTrack.current ? (
                <a className="btn btn-tonal btn-block" href={`https://www.google.com/maps/dir/?api=1&destination=${customerTrack.current.lat},${customerTrack.current.lng}`} target="_blank" rel="noopener noreferrer">
                  <Icon name="location" />Ouvrir la navigation
                </a>
              ) : null}
              <button type="button" className="btn btn-primary btn-block" disabled={starting || delivering}
                onClick={() => orderStatus === "arrivee" ? openPanel("code") : orderStatus === "en_route" ? markArrived() : startSharing()}>
                <Icon name={orderStatus === "arrivee" ? "qr-scanner" : "shipping"} />
                {starting || delivering ? "Enregistrement…" : orderStatus === "arrivee" ? "Vérifier la remise" : orderStatus === "en_route" ? "Je suis arrivé" : "Démarrer la course"}
              </button>
            </>
          ) : status === "sharing" && deliveryCode ? (
            <button type="button" className="btn btn-primary btn-block" onClick={() => openPanel("code")}><Icon name="qr-scanner" />Voir mon code de remise</button>
          ) : (
            <button type="button" className="btn btn-primary btn-block" onClick={startSharing} disabled={starting}>
              <Icon name="location" />{starting ? "Démarrage…" : "Partager mon lieu de livraison"}
            </button>
          )}
        </div>}
      </section>
    </div>
  );
}
