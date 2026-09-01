"use client";

// Carte intégrée du trajet de livraison — Leaflet + fonds OpenStreetMap
// (gratuit, sans clé API ni facturation, cohérent avec le choix Cloudinary
// plutôt que Firebase Storage fait ailleurs dans ce projet). Chargé
// dynamiquement dans useEffect : Leaflet touche `window`/`document` au
// chargement, un import statique casserait le rendu serveur du composant.
//
// Deux pistes distinctes (client et livreur, qui varie — Djimi lui-même ou
// une aide ponctuelle, CLAUDE.md) : chacune son marqueur "bonhomme" (icône
// Tabler i-person réutilisée telle quelle) et sa couleur, plutôt qu'un point
// générique — inspiré des écrans de suivi Gozem/Yango. Une piste sans donnée
// n'affiche simplement rien tant que personne n'a partagé sa position.
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { LocationPoint } from "@/lib/actions/orders";

export interface DeliveryTrack {
  points: LocationPoint[];
  current: { lat: number; lng: number } | null;
  sharing: boolean;
}

const PERSON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">' +
  '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />' +
  '<path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>';

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function markerHtml(role: "customer" | "courier", sharing: boolean): string {
  return (
    `<div class="dlv-marker dlv-marker--${role}${sharing ? "" : " idle"}">` +
    '<span class="ring"></span><span class="badge">' +
    PERSON_SVG +
    "</span></div>"
  );
}

export function DeliveryMap({ customer, courier }: { customer: DeliveryTrack; courier: DeliveryTrack }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type Leaflet réel, importé dynamiquement (pas de dépendance de type au niveau module)
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- objets Leaflet réels, importés dynamiquement
  type TrackLayers = { line: any; marker: any | null };
  const tracksRef = useRef<{ customer: TrackLayers; courier: TrackLayers } | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const start = customer.current || courier.current;
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(
        [start?.lat ?? 4.0511, start?.lng ?? 9.7679],
        14
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      // Pas de fond de carte sombre gratuit et fiable sans clé API (CARTO
      // exige désormais une clé — testé, "API KEY REQUIRED" en filigrane) :
      // on assombrit les tuiles claires d'OpenStreetMap par filtre CSS
      // plutôt que de dépendre d'un service tiers, voir .dlv-map-dark dans
      // admin.css.
      containerRef.current.classList.toggle("dlv-map-dark", isDarkTheme());

      // Couleurs Leaflet en dur (l'API attend une vraie chaîne, pas une
      // variable CSS) — mêmes valeurs que --tertiary (client) et --secondary
      // (livreur) dans app/lmi.css : chaque piste garde une seule couleur du
      // marqueur au tracé, pour rester lisible même quand les deux se croisent.
      mapRef.current = map;
      tracksRef.current = {
        customer: { line: L.polyline([], { color: "#ff6b00", weight: 4, opacity: 0.85 }).addTo(map), marker: null },
        courier: { line: L.polyline([], { color: "#16a34a", weight: 4, opacity: 0.85 }).addTo(map), marker: null },
      };
    });

    // Réagit si l'admin bascule clair/sombre (bouton de thème) pendant que
    // le tiroir est ouvert — juste le filtre CSS, les tuiles ne changent pas.
    const observer = new MutationObserver(() => {
      containerRef.current?.classList.toggle("dlv-map-dark", isDarkTheme());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tracksRef.current = null;
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
          icon: L.divIcon({ className: "", html: markerHtml(role, track.sharing), iconSize: [28, 28], iconAnchor: [14, 14] }),
        }).addTo(map);
      } else {
        t.marker.setLatLng([last.lat, last.lng]);
        t.marker.getElement()?.querySelector(".dlv-marker")?.classList.toggle("idle", !track.sharing);
      }
      lasts.push([last.lat, last.lng]);
    }

    if (lasts.length) {
      const allLatLngs = [...tracks.customer.line.getLatLngs(), ...tracks.courier.line.getLatLngs(), ...lasts];
      if (allLatLngs.length > 1) {
        const bounds = L.latLngBounds(allLatLngs);
        map.fitBounds(bounds.pad(0.25));
      } else {
        map.setView(lasts[0], map.getZoom() < 13 ? 15 : map.getZoom());
      }
    }
  }, [customer, courier]);

  const activeCount = (customer.sharing ? 1 : 0) + (courier.sharing ? 1 : 0);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={containerRef}
        role="img"
        aria-label="Carte de livraison — position du client et du livreur ; le détail (statut, dernière position, nombre de points) est repris en texte juste en dessous"
        style={{ width: "100%", height: 400, borderRadius: "var(--r-card)", overflow: "hidden" }}
      />
      {activeCount > 0 ? (
        <div className="dlv-live-badge" aria-hidden="true">
          <span className="rec-dot" />
          En direct
        </div>
      ) : null}
    </div>
  );
}
