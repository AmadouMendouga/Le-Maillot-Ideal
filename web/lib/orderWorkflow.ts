import type { OrderStatus } from "@/lib/types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  recue: "Reçue",
  confirmee: "Confirmée",
  preparation: "En préparation",
  prete: "Prête à livrer",
  livreur_assigne: "Livreur affecté",
  en_route: "En route",
  arrivee: "Livreur arrivé",
  livree: "Livrée",
  reportee: "Reportée",
  annulee: "Annulée",
};

export const ORDER_STATUS_OPTIONS = (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((value) => ({
  value,
  label: ORDER_STATUS_LABELS[value],
}));

export const TERMINAL_ORDER_STATUSES = new Set<OrderStatus>(["livree", "annulee"]);
export const TRACKING_ORDER_STATUSES = new Set<OrderStatus>(["en_route", "arrivee"]);
export const COURIER_ACCESS_STATUSES = new Set<OrderStatus>(["prete", "livreur_assigne", "en_route", "arrivee"]);

export function normalizeOrderStatus(status: string | undefined): OrderStatus {
  return typeof status === "string" && Object.hasOwn(ORDER_STATUS_LABELS, status) ? (status as OrderStatus) : "confirmee";
}

// "livree" reste accessible côté client (pas côté livreur, qui n'a plus rien
// à y faire) : sans ça, le lien envoyé pendant la livraison affichait "lien
// indisponible" dès la clôture, alors que getSharedLocationViewAction gère
// déjà très bien cet état (écran de remerciement + proposition d'avis, voir
// LocationSharingForm.tsx) — seul ce chargement initial le refusait.
export function canGenerateTrackingLink(status: OrderStatus, role: "customer" | "courier"): boolean {
  return role === "customer" ? TRACKING_ORDER_STATUSES.has(status) || status === "livree" : COURIER_ACCESS_STATUSES.has(status);
}

export function canUpdateLiveLocation(status: OrderStatus): boolean {
  return TRACKING_ORDER_STATUSES.has(status);
}

export function publicProgressStep(status: OrderStatus): 0 | 1 | 2 | 3 | 4 {
  if (status === "livree") return 4;
  if (status === "arrivee") return 3;
  if (status === "en_route") return 2;
  if (status === "preparation" || status === "prete" || status === "livreur_assigne") return 1;
  return 0;
}
