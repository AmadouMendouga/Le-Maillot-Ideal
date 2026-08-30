// Petits utilitaires d'affichage partagés, portés depuis js/main.js.
export function safeColor(value: string | undefined | null): string {
  const color = String(value || "");
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#6259f5";
}
