export interface GeoSample {
  lat: number;
  lng: number;
  at: string;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
}

export const MAX_LOCATION_ACCURACY_METERS = 100;
export const MAX_TRACK_POINTS = 200;

export function distanceMeters(a: Pick<GeoSample, "lat" | "lng">, b: Pick<GeoSample, "lat" | "lng">): number {
  const earthRadius = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const x = dLng * Math.cos(meanLat);
  return Math.sqrt(dLat * dLat + x * x) * earthRadius;
}

export function hasUsableAccuracy(accuracy: number | undefined): boolean {
  return accuracy === undefined || (Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= MAX_LOCATION_ACCURACY_METERS);
}

export function shouldAppendTrackPoint(previous: GeoSample | null, next: GeoSample): boolean {
  if (!previous) return true;
  const elapsedSeconds = Math.max(0, (Date.parse(next.at) - Date.parse(previous.at)) / 1000);
  const distance = distanceMeters(previous, next);
  const accuracy = Math.max(previous.accuracy ?? 20, next.accuracy ?? 20);
  const noiseFloor = Math.max(12, Math.min(50, accuracy * 0.6));

  if (distance < noiseFloor) return false;
  if (elapsedSeconds > 0 && elapsedSeconds < 60 && distance / elapsedSeconds > 60) return false;
  return true;
}

export function cleanTrackPoints<T extends GeoSample>(points: T[], maximum = MAX_TRACK_POINTS): T[] {
  const cleaned: T[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) continue;
    if (!hasUsableAccuracy(point.accuracy)) continue;
    if (shouldAppendTrackPoint(cleaned.at(-1) ?? null, point)) cleaned.push(point);
  }
  return cleaned.slice(-maximum);
}
