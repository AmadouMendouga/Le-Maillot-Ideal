"use client";

// Carte intégrée du trajet de livraison — Leaflet + fonds OpenStreetMap
// (gratuit, sans clé API ni facturation, cohérent avec le choix Cloudinary
// plutôt que Firebase Storage fait ailleurs dans ce projet). Chargé
// dynamiquement dans useEffect : Leaflet touche `window`/`document` au
// chargement, un import statique casserait le rendu serveur du composant.
// Utilisé à la fois par l'admin (components/admin/OrdersAdmin.tsx) et par
// les pages publiques de partage de position (components/delivery/
// LocationSharingForm.tsx) — client ET livreur doivent pouvoir se voir
// mutuellement, pas seulement l'admin.
//
// Deux pistes distinctes (client et livreur, qui varie — Djimi lui-même ou
// une aide ponctuelle, CLAUDE.md) : chacune son marqueur en forme d'épingle
// avec un bonhomme (icône Tabler i-person réutilisée telle quelle) et sa
// couleur, plutôt qu'un point générique — inspiré des écrans de suivi
// Gozem/Yango/Bolt. Une piste sans donnée n'affiche simplement rien tant
// que personne n'a partagé sa position.
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LocationPoint } from "@/lib/actions/orders";

// OpenFreeMap : tuiles vectorielles gratuites, sans clé API, sans limite —
// contrairement à CARTO (testé : exige désormais une clé, "API KEY REQUIRED"
// en filigrane). Un vrai style sombre existe ("dark"), pas besoin du filtre
// CSS d'assombrissement qu'on utilisait pour les tuiles OSM classiques.
// "positron" (épuré) plutôt que "liberty" (coloré) : le fond ne doit pas
// concurrencer visuellement les tracés et marqueurs, qui sont l'info utile.
function styleUrlForTheme(dark: boolean): string {
  return `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`;
}

export interface DeliveryTrack {
  points: LocationPoint[];
  current: { lat: number; lng: number } | null;
  sharing: boolean;
}

const PERSON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">' +
  '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />' +
  '<path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>';

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

// Épingle (badge arrondi + pointe) plutôt qu'un simple cercle : "pourquoi ce
// ne sont pas des bonhommes" — le repère de position doit se reconnaître au
// premier coup d'œil, comme sur Bolt/Gozem/Yango, pas juste un point coloré.
function markerHtml(role: "customer" | "courier", sharing: boolean): string {
  return (
    `<div class="dlv-marker dlv-marker--${role}${sharing ? "" : " idle"}">` +
    '<span class="badge">' +
    PERSON_SVG +
    "</span>" +
    '<span class="tail"></span>' +
    '<span class="ring"></span>' +
    "</div>"
  );
}
const MARKER_ICON_SIZE: [number, number] = [32, 42];
const MARKER_ICON_ANCHOR: [number, number] = [16, 38];

// OSRM : service d'itinéraire routier gratuit, sans clé API (instance de
// démonstration publique — pas de garantie de disponibilité, voir le
// commentaire plus bas où l'appel est fait). Le but de la carte est
// justement d'aider le livreur à retrouver le client : les deux positions
// seules (ou leurs traces de déplacement passé) ne suffisent pas, il faut le
// chemin réel entre les deux, en suivant les rues.
interface RouteResult {
  coords: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

async function fetchRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<RouteResult | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return {
      coords: coords.map(([lng, lat]: [number, number]) => [lat, lng]),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } catch {
    return null; // best effort — une carte sans itinéraire routé reste utilisable (marqueurs + traces)
  }
}

// Distance approximative en mètres (formule équirectangulaire, largement
// suffisante à l'échelle d'une ville) — sert seulement à décider si la
// position a assez bougé pour justifier un nouvel appel à OSRM.
function approxMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const x = dLng * Math.cos(meanLat);
  return Math.sqrt(dLat * dLat + x * x) * R;
}

export function DeliveryMap({
  customer,
  courier,
  fullScreen = false,
  darkMap = false,
  showRouteStats = false,
}: {
  customer: DeliveryTrack;
  courier: DeliveryTrack;
  /** Suivi public (page /livraison/[token]) : la carte occupe tout l'écran plutôt
   * qu'une vignette de 400px — retour client du 06/09/2026, elle doit rester
   * visible en permanence pendant l'usage plutôt que de défiler hors champ. */
  fullScreen?: boolean;
  /** Écran livreur : fond sombre systématique (lisibilité en conduite), sans
   * dépendre du thème clair/sombre choisi côté client. */
  darkMap?: boolean;
  /** Écran livreur : bandeau distance/temps restant/heure d'arrivée en haut,
   * calculé depuis l'itinéraire OSRM déjà récupéré — remplace le petit badge
   * "En direct" plutôt que de l'empiler. */
  showRouteStats?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [routeStats, setRouteStats] = useState<{ distanceKm: number; minutes: number; arrival: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type Leaflet réel, importé dynamiquement (pas de dépendance de type au niveau module)
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- calque MapLibre réel (binding Leaflet), importé dynamiquement
  const glLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- objets Leaflet réels, importés dynamiquement
  type TrackLayers = { line: any; marker: any | null };
  const tracksRef = useRef<{ customer: TrackLayers; courier: TrackLayers } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- polyligne Leaflet réelle
  const routeLineRef = useRef<any>(null);
  // Évite de rappeler OSRM à chaque sondage (toutes les 6s) si personne n'a
  // vraiment bougé — voir le throttle plus bas.
  const routeStateRef = useRef<{ from: { lat: number; lng: number }; to: { lat: number; lng: number }; fetchedAt: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all([import("leaflet"), import("@maplibre/maplibre-gl-leaflet")]).then(([L, { maplibreGL }]) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const start = customer.current || courier.current;
      // attributionControl: false — le calque MapLibre ajoute la sienne
      // automatiquement (obligatoire pour OpenFreeMap), doublon sinon.
      // maxBounds/maxBoundsViscosity/minZoom : recommandés tels quels par
      // l'exemple officiel de @maplibre/maplibre-gl-leaflet ("restrict bounds
      // to avoid max latitude issues with MapLibre GL" / "prevent sync issues
      // at zoom 0") — sans ça, fitBounds() plantait ("Cannot read properties
      // of null (reading '0')"), reproduit et corrigé ici.
      const map = L.map(containerRef.current, {
        // Pas de boutons +/- en plein écran (public) : le pincement suffit sur
        // mobile et l'écran doit rester dégagé, façon Bolt/Gozem. Gardés pour
        // la vignette admin (OrdersAdmin), utilisée surtout à la souris.
        zoomControl: !fullScreen,
        attributionControl: false,
        maxBounds: [
          [180, -Infinity],
          [-180, Infinity],
        ],
        maxBoundsViscosity: 1,
        minZoom: 1,
      }).setView([start?.lat ?? 4.0511, start?.lng ?? 9.7679], 14);
      glLayerRef.current = maplibreGL({ style: styleUrlForTheme(darkMap || isDarkTheme()) }).addTo(map);

      // Couleurs Leaflet en dur (l'API attend une vraie chaîne, pas une
      // variable CSS) — mêmes valeurs que --tertiary (client) et --secondary
      // (livreur) dans app/lmi.css : chaque piste garde une seule couleur du
      // marqueur au tracé, pour rester lisible même quand les deux se croisent.
      mapRef.current = map;
      tracksRef.current = {
        customer: { line: L.polyline([], { color: "#ff6b00", weight: 4, opacity: 0.85 }).addTo(map), marker: null },
        courier: { line: L.polyline([], { color: "#16a34a", weight: 4, opacity: 0.85 }).addTo(map), marker: null },
      };
      // Itinéraire routier (OSRM) entre le livreur et le client — but même de
      // la carte : aider à se retrouver, pas juste montrer deux traces
      // séparées. Style neutre et pointillé pour ne pas se confondre avec les
      // deux traces de déplacement passé (pleines, colorées par personne).
      routeLineRef.current = L.polyline([], { color: "#1e3a8a", weight: 4, opacity: 0.75, dashArray: "2 10", lineCap: "round" }).addTo(
        map
      );
    });

    // Réagit si l'admin bascule clair/sombre (bouton de thème) pendant que
    // le tiroir est ouvert : MapLibre sait changer de style en place (pas
    // besoin de recréer le calque).
    const observer = new MutationObserver(() => {
      if (darkMap) return; // toujours sombre, indépendant du thème choisi côté client
      glLayerRef.current?.getMaplibreMap()?.setStyle(styleUrlForTheme(isDarkTheme()));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // En plein écran, le conteneur n'a plus une taille fixe : il occupe
    // l'espace restant dans une colonne flex, à côté du panneau du bas (voir
    // .dlv-screen) — sa hauteur varie donc avec le contenu de ce panneau.
    // Sans resynchroniser Leaflet/MapLibre à chaque changement, la carte
    // resterait mise en page pour son ancienne taille (tuiles décalées).
    // Le rappel est différé en rAF et ignore les appels déjà en attente :
    // invalidateSize()/resize() peuvent eux-mêmes faire varier légèrement la
    // taille observée (redimensionnement du canvas WebGL), et un rappel
    // synchrone rebouclerait sur lui-même — repéré le 06/09/2026 (page
    // plantée dès qu'une position réelle était partagée).
    let rafId: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        mapRef.current?.invalidateSize();
        glLayerRef.current?.getMaplibreMap()?.resize();
      });
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      cancelled = true;
      observer.disconnect();
      resizeObserver.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        glLayerRef.current = null;
        tracksRef.current = null;
        routeLineRef.current = null;
        routeStateRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialisation unique, la mise à jour se fait dans l'effet suivant
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const tracks = tracksRef.current;
    if (!map || !L || !tracks) return;

    const lasts: [number, number][] = [];

    for (const [role, track] of [
      ["customer", customer],
      ["courier", courier],
    ] as const) {
      const t = tracks[role];
      const latLngs = track.points.map((p) => [p.lat, p.lng] as [number, number]);
      t.line.setLatLngs(latLngs);

      const last = track.current || (track.points.length ? track.points[track.points.length - 1] : null);
      if (!last) continue; // rien partagé pour cette piste — pas de marqueur fantôme

      if (!t.marker) {
        t.marker = L.marker([last.lat, last.lng], {
          icon: L.divIcon({ className: "", html: markerHtml(role, track.sharing), iconSize: MARKER_ICON_SIZE, iconAnchor: MARKER_ICON_ANCHOR }),
        }).addTo(map);
      } else {
        t.marker.setLatLng([last.lat, last.lng]);
        t.marker.getElement()?.querySelector(".dlv-marker")?.classList.toggle("idle", !track.sharing);
      }
      lasts.push([last.lat, last.lng]);
    }

    // Itinéraire livreur → client, tant que les deux partagent une position.
    // Throttlé (30s + 25m de mouvement minimum) pour ne pas saturer
    // l'instance OSRM publique (gratuite, sans clé, mais pas garantie —
    // best effort : en cas d'échec, l'ancien itinéraire affiché ne bouge
    // pas plutôt que de disparaître).
    if (customer.current && courier.current && routeLineRef.current) {
      const from = courier.current;
      const to = customer.current;
      const prev = routeStateRef.current;
      const stale = !prev || Date.now() - prev.fetchedAt > 30000;
      const moved = !prev || approxMeters(prev.from, from) > 25 || approxMeters(prev.to, to) > 25;
      if (stale && moved) {
        routeStateRef.current = { from, to, fetchedAt: Date.now() };
        fetchRoute(from, to).then((result) => {
          if (!result) return;
          routeLineRef.current?.setLatLngs(result.coords);
          setRouteStats({
            distanceKm: result.distanceMeters / 1000,
            minutes: Math.round(result.durationSeconds / 60),
            arrival: new Date(Date.now() + result.durationSeconds * 1000).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        });
      }
    } else {
      routeLineRef.current?.setLatLngs([]);
      routeStateRef.current = null;
      setRouteStats(null);
    }

    if (lasts.length) {
      // Passe par les méthodes de LEAFLET (fitBounds/setView), pas par
      // l'API MapLibre (getMaplibreMap().fitBounds/easeTo) : le pont
      // @maplibre/maplibre-gl-leaflet ne synchronise que dans un sens
      // (Leaflet → MapLibre, voir _transformGL dans son code source) —
      // piloter la caméra MapLibre directement déplace le fond de carte
      // sans que Leaflet le sache, et les marqueurs/tracés (objets Leaflet)
      // restent positionnés sur l'ancienne vue : décalage visible entre les
      // tuiles et les marqueurs dès que les deux points sont un peu éloignés
      // (repéré le 06/09/2026 avec deux positions à ~2km d'écart). Piloter
      // Leaflet laisse le pont faire la synchronisation lui-même, dans le
      // sens pour lequel il est prévu.
      const allLatLngs: [number, number][] = [
        ...tracks.customer.line.getLatLngs().map((p: { lat: number; lng: number }) => [p.lat, p.lng] as [number, number]),
        ...tracks.courier.line.getLatLngs().map((p: { lat: number; lng: number }) => [p.lat, p.lng] as [number, number]),
        ...lasts,
      ];

      if (allLatLngs.length > 1) {
        map.fitBounds(allLatLngs, { padding: [40, 40], animate: true, duration: 0.3 });
      } else {
        map.setView(lasts[0], Math.max(map.getZoom(), 15), { animate: true, duration: 0.3 });
      }
    }
  }, [customer, courier]);

  const activeCount = (customer.sharing ? 1 : 0) + (courier.sharing ? 1 : 0);

  return (
    <div style={fullScreen ? { position: "relative", flex: "1 1 auto", minHeight: 0 } : { position: "relative" }}>
      <div
        ref={containerRef}
        role="img"
        aria-label="Carte de livraison — position du client, du livreur, et itinéraire suggéré entre les deux ; le détail (statut, dernière position, nombre de points) est repris en texte juste en dessous"
        style={
          fullScreen
            ? { width: "100%", height: "100%" }
            : { width: "100%", height: 400, borderRadius: "var(--r-card)", overflow: "hidden" }
        }
      />
      {showRouteStats && routeStats ? (
        <div className="dlv-route-stats">
          <div>
            <strong>{routeStats.minutes} min</strong>
            <span>Restant</span>
          </div>
          <div className="sep" />
          <div>
            <strong>{routeStats.distanceKm < 10 ? routeStats.distanceKm.toFixed(1) : Math.round(routeStats.distanceKm)} km</strong>
            <span>Distance</span>
          </div>
          <div className="sep" />
          <div>
            <strong>{routeStats.arrival}</strong>
            <span>Arrivée</span>
          </div>
        </div>
      ) : activeCount > 0 ? (
        <div className="dlv-live-badge" aria-hidden="true">
          <span className="rec-dot" />
          En direct
        </div>
      ) : null}
    </div>
  );
}
