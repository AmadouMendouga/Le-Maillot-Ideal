"use client";

// Carte intégrée du trajet de livraison — Leaflet + fonds OpenStreetMap
// (gratuit, sans clé API ni facturation, cohérent avec le choix Cloudinary
// plutôt que Firebase Storage fait ailleurs dans ce projet). Chargé
// dynamiquement dans useEffect : Leaflet touche `window`/`document` au
// chargement, un import statique casserait le rendu serveur du composant.
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { LocationPoint } from "@/lib/actions/orders";

export function DeliveryMap({
  points,
  current,
}: {
  points: LocationPoint[];
  current: { lat: number; lng: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type Leaflet réel, importé dynamiquement (pas de dépendance de type au niveau module)
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layersRef = useRef<{ line: any; marker: any } | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(
        [current?.lat ?? 4.0511, current?.lng ?? 9.7679],
        14
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const line = L.polyline([], { color: "#6259F5", weight: 4, opacity: 0.85 }).addTo(map);
      const marker = L.circleMarker([current?.lat ?? 4.0511, current?.lng ?? 9.7679], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: "#075E54",
        fillOpacity: 1,
      }).addTo(map);

      mapRef.current = map;
      layersRef.current = { line, marker };
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layersRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialisation unique, la mise à jour se fait dans l'effet suivant
  }, []);

  useEffect(() => {
    const layers = layersRef.current;
    const map = mapRef.current;
    if (!layers || !map) return;

    const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);
    layers.line.setLatLngs(latLngs);

    const last = current || (points.length ? points[points.length - 1] : null);
    if (last) {
      layers.marker.setLatLng([last.lat, last.lng]);
      const bounds = latLngs.length > 1 ? layers.line.getBounds() : null;
      if (bounds && bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2));
      } else {
        map.setView([last.lat, last.lng], map.getZoom() < 13 ? 15 : map.getZoom());
      }
    }
  }, [points, current]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: 320, borderRadius: "var(--r-card)", overflow: "hidden" }}
    />
  );
}
