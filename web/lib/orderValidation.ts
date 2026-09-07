import type { OrderItem, Product } from "@/lib/types";

export const MAX_ORDER_LINES = 50;
export const MAX_QUANTITY_PER_LINE = 99;

export type OrderItemsValidation =
  | { ok: true; items: OrderItem[] }
  | { ok: false; error: string };

/** Validation d'une frontière serveur : les types TypeScript ne protègent pas les appels réseau. */
export function validateOrderItems(input: unknown): OrderItemsValidation {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: "Panier vide." };
  if (input.length > MAX_ORDER_LINES) return { ok: false, error: "Ce panier contient trop de lignes." };

  const merged = new Map<string, OrderItem>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "Article invalide." };
    const item = raw as Partial<OrderItem>;
    const slug = typeof item.slug === "string" ? item.slug.trim() : "";
    const size = typeof item.size === "string" ? item.size.trim() : "";
    const qty = item.qty;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !size || size.length > 40) {
      return { ok: false, error: "Article ou taille invalide." };
    }
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY_PER_LINE) {
      return { ok: false, error: "Quantité invalide." };
    }

    const key = `${slug}\u0000${size}`;
    const previous = merged.get(key);
    const nextQty = (previous?.qty ?? 0) + qty;
    if (nextQty > MAX_QUANTITY_PER_LINE) return { ok: false, error: "Quantité trop élevée." };
    merged.set(key, { slug, size, qty: nextQty });
  }
  return { ok: true, items: [...merged.values()] };
}

export function aggregateItemQuantities(items: OrderItem[]): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const item of items) quantities.set(item.slug, (quantities.get(item.slug) ?? 0) + item.qty);
  return quantities;
}

export type OrderQuote = {
  items: OrderItem[];
  total: number;
  summary: string;
  quantities: Map<string, number>;
};

export function quoteOrderItems(
  items: OrderItem[],
  products: Map<string, Product>,
  options: { validateSizes?: boolean; enforceStock?: boolean } = {}
): { ok: true; quote: OrderQuote } | { ok: false; error: string } {
  const { validateSizes = true, enforceStock = true } = options;
  const quantities = aggregateItemQuantities(items);
  let total = 0;
  const summary: string[] = [];

  for (const item of items) {
    const product = products.get(item.slug);
    if (!product) return { ok: false, error: "Un article du panier n'existe plus." };
    if (validateSizes && (!Array.isArray(product.sizes) || !product.sizes.map(String).includes(item.size))) {
      return { ok: false, error: `La taille ${item.size} n'est pas disponible pour ${product.name}.` };
    }
    if (!Number.isInteger(product.price) || product.price <= 0 || !Number.isInteger(product.stock) || product.stock < 0) {
      return { ok: false, error: `Les données de ${product.name} sont invalides.` };
    }
    total += product.price * item.qty;
    if (!Number.isSafeInteger(total)) return { ok: false, error: "Montant de commande invalide." };
    summary.push(`${item.qty}x ${product.name} (${item.size})`);
  }

  if (enforceStock) {
    for (const [slug, qty] of quantities) {
      const product = products.get(slug)!;
      if (product.stock < qty) {
        return { ok: false, error: `Stock insuffisant pour ${product.name} (${product.stock} restant(s)).` };
      }
    }
  }
  return { ok: true, quote: { items, total, summary: summary.join(", "), quantities } };
}
