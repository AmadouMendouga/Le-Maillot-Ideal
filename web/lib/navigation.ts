/** OSRM geometry uses [longitude, latitude]; Leaflet uses [latitude, longitude]. */
type Point = { lat: number; lng: number };
export type NavigationPosition = Point & { updatedAt?: string; accuracy?: number; speed?: number | null; heading?: number | null };
export type Maneuver = { offset: number; instruction: string; road: string; modifier: string };
export type NavigationRoute = {
  coords: [number, number][];
  offsets: number[];
  distanceMeters: number;
  durationSeconds: number;
  maneuvers: Maneuver[];
};
const METERS_PER_DEGREE = Math.PI * 6_371_000 / 180;
const MAX_FIX_AGE_MS = 30_000;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function coordinate(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const [lng, lat] = value;
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}
function length(a: [number, number], b: [number, number]) {
  return Math.hypot((b[0] - a[0]) * METERS_PER_DEGREE, (b[1] - a[1]) * METERS_PER_DEGREE * Math.cos((a[0] + b[0]) * Math.PI / 360));
}
function maneuverLabel(type: unknown, modifier: unknown, exit: unknown): string {
  if (type === "arrive") return "Rejoignez le point de livraison";
  if (type === "roundabout" || type === "rotary") return Number.isInteger(exit) && Number(exit) > 0 ? `Au rond-point, prenez la sortie ${exit}` : "Entrez dans le rond-point";
  if (type === "exit roundabout" || type === "exit rotary") return "Sortez du rond-point";
  if (modifier === "uturn") return "Faites demi-tour";
  if (modifier === "sharp right") return "Tournez franchement à droite";
  if (modifier === "sharp left") return "Tournez franchement à gauche";
  if (modifier === "slight right" || (type === "fork" && modifier === "right")) return "Serrez à droite";
  if (modifier === "slight left" || (type === "fork" && modifier === "left")) return "Serrez à gauche";
  if (modifier === "right") return "Tournez à droite";
  if (modifier === "left") return "Tournez à gauche";
  if (modifier === "straight") return "Continuez tout droit";
  return "Suivez l’itinéraire";
}

export function parseNavigationRoute(payload: unknown): NavigationRoute | null {
  const data = record(payload);
  if (data?.code !== "Ok" || !Array.isArray(data.routes)) return null;
  const raw = record(data.routes[0]);
  const geometry = record(raw?.geometry)?.coordinates;
  if (!raw || !Array.isArray(geometry) || geometry.length < 2 || geometry.length > 50_000) return null;
  if (typeof raw.distance !== "number" || !Number.isFinite(raw.distance) || raw.distance < 0 || typeof raw.duration !== "number" || !Number.isFinite(raw.duration) || raw.duration < 0) return null;
  const coords: [number, number][] = [];
  const offsets: number[] = [];
  for (const item of geometry) {
    const point = coordinate(item);
    if (!point) return null;
    offsets.push(coords.length ? offsets[coords.length - 1] + length(coords[coords.length - 1], point) : 0);
    coords.push(point);
  }
  const maneuvers: Maneuver[] = [];
  let previousIndex = 0;
  for (const leg of Array.isArray(raw.legs) ? raw.legs : []) {
    const steps = record(leg)?.steps;
    if (!Array.isArray(steps)) continue;
    for (const value of steps) {
      const step = record(value);
      const maneuver = record(step?.maneuver);
      const point = coordinate(maneuver?.location);
      if (!point || !maneuver || maneuver.type === "depart") continue;
      // A maneuver starts at a route vertex. Preserve ordering on loops.
      let nearestIndex = previousIndex;
      let nearestDistance = Infinity;
      for (let i = previousIndex; i < coords.length; i++) {
        const distance = length(point, coords[i]);
        if (distance < nearestDistance) { nearestIndex = i; nearestDistance = distance; }
        if (distance < 1) break;
      }
      if (nearestDistance > 30) continue;
      previousIndex = nearestIndex;
      maneuvers.push({ offset: offsets[nearestIndex], instruction: maneuverLabel(maneuver.type, maneuver.modifier, maneuver.exit), road: typeof step?.name === "string" ? step.name.slice(0, 160) : "", modifier: maneuver.type === "arrive" ? "arrive" : ["roundabout", "rotary", "exit roundabout", "exit rotary"].includes(String(maneuver.type)) ? "roundabout" : typeof maneuver.modifier === "string" ? maneuver.modifier : "straight" });
    }
  }
  return { coords, offsets, distanceMeters: raw.distance, durationSeconds: raw.duration, maneuvers };
}

export function hasFreshNavigationFix(position: NavigationPosition | null, now = Date.now()): position is NavigationPosition {
  if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lng) || Math.abs(position.lat) > 85 || Math.abs(position.lng) > 180) return false;
  const date = Date.parse(position.updatedAt ?? "");
  return Number.isFinite(date) && now - date >= -10_000 && now - date <= MAX_FIX_AGE_MS && (position.accuracy === undefined || Number.isFinite(position.accuracy) && position.accuracy >= 0 && position.accuracy <= 50);
}
export function navigationSpeed(position: NavigationPosition | null, now = Date.now()): number | null {
  if (!hasFreshNavigationFix(position, now) || typeof position.speed !== "number" || !Number.isFinite(position.speed) || position.speed < 0 || position.speed > 60) return null;
  return Math.round(position.speed * 3.6);
}
export function navigationHeading(position: NavigationPosition | null, now = Date.now()): number | null {
  return hasFreshNavigationFix(position, now) && typeof position.heading === "number" && Number.isFinite(position.heading) && position.heading >= 0 && position.heading < 360 ? position.heading : null;
}

export function navigationProgress(route: NavigationRoute, position: NavigationPosition | null, now = Date.now()) {
  if (!hasFreshNavigationFix(position, now)) return { kind: "waiting" as const };
  let closest = Infinity;
  let offset = 0;
  let ambiguous = false;
  for (let i = 1; i < route.coords.length; i++) {
    const a = route.coords[i - 1];
    const b = route.coords[i];
    const scaleX = METERS_PER_DEGREE * Math.cos(position.lat * Math.PI / 180);
    const x = (b[1] - a[1]) * scaleX;
    const y = (b[0] - a[0]) * METERS_PER_DEGREE;
    const px = (position.lng - a[1]) * scaleX;
    const py = (position.lat - a[0]) * METERS_PER_DEGREE;
    const t = x || y ? Math.max(0, Math.min(1, (px * x + py * y) / (x * x + y * y))) : 0;
    const distance = Math.hypot(px - t * x, py - t * y);
    const candidate = route.offsets[i - 1] + t * (route.offsets[i] - route.offsets[i - 1]);
    if (distance < closest - 5) { closest = distance; offset = candidate; ambiguous = false; }
    else if (distance < closest + 5 && Math.abs(candidate - offset) > 120) ambiguous = true;
  }
  if (closest > 60) return { kind: "off-route" as const };
  if (ambiguous) return { kind: "uncertain" as const };
  const total = route.offsets.at(-1) ?? 0;
  const remainingRatio = total ? Math.max(0, Math.min(1, (total - offset) / total)) : 0;
  const next = route.maneuvers.find((maneuver) => maneuver.offset > offset + 8) ?? route.maneuvers.findLast((maneuver) => maneuver.modifier === "arrive");
  return { kind: "ready" as const, remainingMeters: route.distanceMeters * remainingRatio, remainingSeconds: route.durationSeconds * remainingRatio,
    next: next ? { ...next, distanceMeters: Math.max(0, next.offset - offset) } : null };
}

export function navigationDistance(meters: number): string {
  return meters < 1000 ? `${Math.max(0, Math.round(meters / 10) * 10)} m` : `${(meters / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}
