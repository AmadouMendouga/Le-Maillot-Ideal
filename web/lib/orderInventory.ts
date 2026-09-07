import "server-only";
import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { quoteOrderItems, validateOrderItems, type OrderQuote } from "@/lib/orderValidation";
import type { Product } from "@/lib/types";

export type InventoryQuote = OrderQuote & {
  products: Map<string, Product>;
  refs: Map<string, DocumentReference>;
};

export async function loadInventoryQuote(
  tx: Transaction,
  rawItems: unknown,
  options?: { validateSizes?: boolean; enforceStock?: boolean }
): Promise<{ ok: true; quote: InventoryQuote } | { ok: false; error: string }> {
  const validated = validateOrderItems(rawItems);
  if (!validated.ok) return validated;

  const slugs = [...new Set(validated.items.map((item) => item.slug))];
  const refs = new Map(slugs.map((slug) => [slug, adminDb.collection("products").doc(slug)]));
  const snaps = await Promise.all(slugs.map((slug) => tx.get(refs.get(slug)!)));
  const products = new Map<string, Product>();
  snaps.forEach((snap, index) => {
    if (snap.exists) products.set(slugs[index], { slug: slugs[index], ...(snap.data() as Omit<Product, "slug">) });
  });

  const result = quoteOrderItems(validated.items, products, options);
  if (!result.ok) return result;
  return { ok: true, quote: { ...result.quote, products, refs } };
}

export function decrementQuotedStock(tx: Transaction, quote: InventoryQuote): void {
  for (const [slug, qty] of quote.quantities) {
    tx.update(quote.refs.get(slug)!, { stock: quote.products.get(slug)!.stock - qty });
  }
}

export function incrementQuotedStock(tx: Transaction, quote: InventoryQuote): void {
  for (const [slug, qty] of quote.quantities) {
    tx.update(quote.refs.get(slug)!, { stock: quote.products.get(slug)!.stock + qty });
  }
}
