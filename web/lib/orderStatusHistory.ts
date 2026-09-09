import type { Order, OrderStatus } from "@/lib/types";
import { normalizeOrderStatus, ORDER_STATUS_LABELS } from "@/lib/orderWorkflow";

export interface OrderStatusEvent { status: OrderStatus; at: string }

/** Only recorded timestamps are shown. Old orders do not get invented preparation dates. */
export function readStatusHistory(order: Pick<Order, "statusHistory">): OrderStatusEvent[] {
  return (Array.isArray(order.statusHistory) ? order.statusHistory : [])
    .filter((event) => event && Object.hasOwn(ORDER_STATUS_LABELS, event.status) && Number.isFinite(Date.parse(event.at)))
    .slice(-60);
}

/** Called inside the transaction that changes status, including courier scan / PIN confirmation. */
export function orderStatusPatch(order: Order, status: OrderStatus, at: string): Partial<Order> {
  const history = readStatusHistory(order);
  const previous = normalizeOrderStatus(order.status);
  if (!history.length && order.statusUpdatedAt && Number.isFinite(Date.parse(order.statusUpdatedAt))) {
    history.push({ status: previous, at: order.statusUpdatedAt });
  }
  if (history.at(-1)?.status !== status) history.push({ status, at });
  return { status, statusUpdatedAt: at, statusHistory: history.slice(-60) };
}
