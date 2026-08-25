// Porté depuis js/admin.js (FCFA).
export function formatFCFA(amount) {
  return Number(amount || 0).toLocaleString("fr-FR") + " FCFA";
}
