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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- calque MapLibre réel (binding Leaflet), importé dynamiquement
  const glLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- objets Leaflet réels, importés dynamiquement
  type TrackLayers = { line: any; marker: any | null };
  const tracksRef = useRef<{ customer: TrackLayers; courier: TrackLayers } | null>(null);

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
        zoomControl: true,
        attributionControl: false,
        maxBounds: [
          [180, -Infinity],
          [-180, Infinity],
        ],
        maxBoundsViscosity: 1,
        minZoom: 1,
      }).setView([start?.lat ?? 4.0511, start?.lng ?? 9.7679], 14);
      glLayerRef.current = maplibreGL({ style: styleUrlForTheme(isDarkTheme()) }).addTo(map);

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
    // le tiroir est ouvert : MapLibre sait changer de style en place (pas
    // besoin de recréer le calque).
    const observer = new MutationObserver(() => {
      glLayerRef.current?.getMaplibreMap()?.setStyle(styleUrlForTheme(isDarkTheme()));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        glLayerRef.current = null;
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
      // Passe par l'API native de MapLibre (getMaplibreMap().fitBounds), pas
      // par celle de Leaflet : map.fitBounds() plantait ("Cannot read
      // properties of null" puis "Invalid LatLng object: (NaN, NaN)" une fois
      // le premier plantage corrigé) — le pont Leaflet↔MapLibre ne calcule
      // visiblement pas les limites correctement pour ce calque. Les
      // marqueurs/tracés restent en Leaflet (L.marker/L.polyline), seule la
      // caméra passe par MapLibre. Attention à l'ordre : MapLibre attend
      // [lng, lat], Leaflet [lat, lng].
      const glMap = glLayerRef.current?.getMaplibreMap();
      if (!glMap) return;

      const allLatLngs: [number, number][] = [
        ...tracks.customer.line.getLatLngs().map((p: { lat: number; lng: number }) => [p.lat, p.lng] as [number, number]),
        ...tracks.courier.line.getLatLngs().map((p: { lat: number; lng: number }) => [p.lat, p.lng] as [number, number]),
        ...lasts,
      ];

      if (allLatLngs.length > 1) {
        let west = Infinity;
        let south = Infinity;
        let east = -Infinity;
        let north = -Infinity;
        for (const [lat, lng] of allLatLngs) {
          if (lat < south) south = lat;
          if (lat > north) north = lat;
          if (lng < west) west = lng;
          if (lng > east) east = lng;
        }
        glMap.fitBounds(
          [
            [west, south],
            [east, north],
          ],
          { padding: 40, duration: 300 }
        );
      } else {
        glMap.easeTo({ center: [lasts[0][1], lasts[0][0]], zoom: Math.max(glMap.getZoom(), 15), duration: 300 });
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
