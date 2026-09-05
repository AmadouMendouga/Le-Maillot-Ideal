// Petits utilitaires d'affichage partagés, portés depuis js/main.js.
export function safeColor(value: string | undefined | null): string {
  const color = String(value || "");
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#6259f5";
}

/** "#1b2a4a" -> "27 42 74", pour l'injecter dans un rgb(var(--x) / a). Retourne null si invalide. */
export function hexToRgbTriplet(hex: string | undefined | null): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
