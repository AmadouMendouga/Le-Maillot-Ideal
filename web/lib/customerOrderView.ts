import type { Order, OrderStatus, PaymentStatus } from "@/lib/types";
import { normalizeOrderStatus, TERMINAL_ORDER_STATUSES, TRACKING_ORDER_STATUSES } from "@/lib/orderWorkflow";
import { readStatusHistory, type OrderStatusEvent } from "@/lib/orderStatusHistory";

export interface CustomerOrderView {
  id: string;
  customerName: string;
  summary: string;
  address: string | null;
  total: number | null;
  status: OrderStatus;
  createdAt: string;
  statusUpdatedAt: string | null;
  deliveredAt: string | null;
  deliverySlot: string | null;
  trackingStartedAt: string | null;
  courierArrivedAt: string | null;
  history: OrderStatusEvent[];
  paymentStatus: PaymentStatus;
  deliveryCode: string | null;
  reviewHref: string | null;
}

/** Explicit projection: no courier capability, GPS history, payment references or internal incident notes. */
export function toCustomerOrderView(order: Order, detail = false): CustomerOrderView {
  const status = normalizeOrderStatus(order.status);
  return {
    id: order.id, customerName: order.customerName, summary: order.orderSummary,
    address: detail ? order.address || null : null,
    total: typeof order.total === "number" && Number.isFinite(order.total) ? order.total : null,
    status, createdAt: order.createdAt,
    statusUpdatedAt: order.statusUpdatedAt || null, deliveredAt: order.deliveredAt || null,
    deliverySlot: order.deliverySlot || null,
    trackingStartedAt: order.trackingStartedAt || null, courierArrivedAt: order.courierArrivedAt || null,
    history: readStatusHistory(order), paymentStatus: order.paymentStatus,
    deliveryCode: detail && TRACKING_ORDER_STATUSES.has(status) && /^\d{4}$/.test(order.deliveryCode || "") ? order.deliveryCode! : null,
    reviewHref: detail && status === "livree" && !order.reviewSubmitted && order.reviewToken ? `/avis/${encodeURIComponent(order.reviewToken)}` : null,
  };
}

export type OrderGroup = "active" | "scheduled" | "history";
export function customerOrderGroup(order: CustomerOrderView): OrderGroup {
  if (TERMINAL_ORDER_STATUSES.has(order.status)) return "history";
  // Slots are agreed free text, not parseable future dates. Never invent a delivery date.
  if (order.deliverySlot && !TRACKING_ORDER_STATUSES.has(order.status)) return "scheduled";
  return "active";
}

export function customerOrderMessage(order: Pick<CustomerOrderView, "status" | "deliverySlot">) {
  const messages: Record<OrderStatus, string> = {
    recue: "Votre commande est reçue. Nous vérifions sa disponibilité et les modalités de paiement.",
    confirmee: "Votre commande est confirmée. Sa préparation va commencer.",
    preparation: "Nous préparons vos articles avec soin.",
    prete: "Vos articles sont prêts. La remise au livreur est la prochaine étape.",
    livreur_assigne: "Votre livreur est affecté. Il n’a pas encore pris la route.",
    en_route: "Votre livreur a pris la route. Vous pouvez maintenant suivre la livraison.",
    arrivee: "Le livreur est arrivé. Présentez votre code uniquement lors de la remise des articles.",
    livree: "Votre commande a bien été livrée. Merci pour votre confiance !",
    reportee: "La livraison est reportée. Nous vous contacterons pour convenir de la suite.",
    annulee: "Cette commande est annulée. Contactez-nous pour toute question sur votre paiement.",
  };
  return messages[order.status];
}

const stages = [
  { status: "recue", title: "Commande reçue", description: "Votre demande est enregistrée." },
  { status: "preparation", title: "En préparation", description: "Nous préparons vos articles." },
  { status: "prete", title: "Prête à livrer", description: "Vos articles attendent le départ du livreur." },
  { status: "en_route", title: "Livreur en route", description: "Le suivi GPS devient disponible." },
  { status: "arrivee", title: "Livreur arrivé", description: "La remise se confirme avec votre code." },
  { status: "livree", title: "Livrée", description: "Profitez de vos nouveaux équipements." },
] as const;
function stageIndex(status: OrderStatus) {
  if (status === "confirmee") return 0;
  if (status === "livreur_assigne") return 2;
  return stages.findIndex((stage) => stage.status === status);
}
export function customerOrderTimeline(order: CustomerOrderView) {
  const paused = order.status === "reportee" || order.status === "annulee";
  const previous = [...order.history].reverse().find((event) => stageIndex(event.status) >= 0)?.status;
  const current = stageIndex(paused ? previous || "recue" : order.status);
  return stages.map((stage, index) => {
    const recorded = [...order.history].reverse().find((event) => event.status === stage.status)?.at;
    const fallback = index === 0 ? order.createdAt : index === 3 ? order.trackingStartedAt : index === 4 ? order.courierArrivedAt : index === 5 ? order.deliveredAt : null;
    const at = index === 0 ? order.createdAt : recorded || fallback || (order.status === stage.status && !paused ? order.statusUpdatedAt : null);
    return { ...stage, at: at && Number.isFinite(Date.parse(at)) ? at : null,
      complete: index < current || order.status === "livree", current: !paused && index === current && order.status !== "livree",
    };
  });
}
