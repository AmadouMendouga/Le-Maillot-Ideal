// Logique panier + facture WhatsApp — portée verbatim depuis js/main.js
// (fonctions FCFA, productStock, stockInfo, normalizeCart, cartDetails,
// cartTotal, buildWhatsappCartLink). Le format du message WhatsApp ne doit
// pas changer d'un caractère : c'est ce que le client reçoit tel quel.
import type { Product, SiteSettings } from "@/lib/types";

export const DEFAULT_WHATSAPP_NUMBER = "237655634265";
export const DEFAULT_FREE_SHIPPING_THRESHOLD = 15000;
const MAX_UNVERIFIED_QTY = 99;

export interface CartItem {
  slug: string;
  size: string;
  qty: number;
}

export interface CartDetailItem extends CartItem {
  product: Product;
}

export interface StockInfo {
  cls: "badge-stock-low" | "badge-stock-out" | "badge-stock-ok";
  label: string;
  icon: "info" | "error" | "hourglass" | "check-circle";
  available: boolean;
}

export function FCFA(n: number): string {
  const value = Number.isFinite(Number(n)) ? Number(n) : 0;
  return value.toLocaleString("fr-FR") + " FCFA";
}

export function whatsappNumber(settings: Pick<SiteSettings, "whatsapp">): string {
  const configured = String(settings.whatsapp || "").replace(/\D/g, "");
  return configured || DEFAULT_WHATSAPP_NUMBER;
}

export function freeShippingThreshold(
  settings: Pick<SiteSettings, "freeShippingThreshold">
): number {
  const configured = Number(settings.freeShippingThreshold);
  return Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_FREE_SHIPPING_THRESHOLD;
}

export function productStock(
  product: Pick<Product, "stock"> | undefined,
  catalogDataVerified: boolean
): number {
  if (!catalogDataVerified) return MAX_UNVERIFIED_QTY;
  return product && Number.isFinite(Number(product.stock))
    ? Math.max(0, Math.floor(Number(product.stock)))
    : 0;
}

export function stockInfo(
  product: Pick<Product, "stock"> | undefined,
  catalogDataVerified: boolean
): StockInfo {
  if (!catalogDataVerified) {
    return { cls: "badge-stock-low", label: "Disponibilité à confirmer", icon: "info", available: true };
  }
  const s = product && Number.isFinite(Number(product.stock))
    ? Math.max(0, Math.floor(Number(product.stock)))
    : 0;
  if (s === 0) return { cls: "badge-stock-out", label: "Rupture de stock", icon: "error", available: false };
  if (s <= 5) return { cls: "badge-stock-low", label: `Plus que ${s} en stock`, icon: "hourglass", available: true };
  return { cls: "badge-stock-ok", label: "En stock", icon: "check-circle", available: true };
}

/**
 * Revalide intégralement un panier lu depuis le localStorage : rejette les
 * slugs inconnus, les tailles absentes du catalogue, les quantités invalides,
 * et plafonne au stock restant. Le prix n'est jamais fait confiance depuis le
 * localStorage — toujours relu depuis `products`.
 */
export function normalizeCart(
  raw: unknown,
  products: Product[],
  catalogDataVerified: boolean
): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const productBySlug = new Map(products.map((p) => [p.slug, p]));
  const normalized: CartItem[] = [];
  const usedBySlug: Record<string, number> = Object.create(null);

  for (const item of raw) {
    if (!item || typeof item !== "object" || typeof (item as CartItem).slug !== "string") continue;
    const slug = (item as CartItem).slug.trim();
    const product = productBySlug.get(slug);
    if (!product) continue;

    const size = typeof (item as CartItem).size === "string" ? (item as CartItem).size.trim() : "";
    const sizes = Array.isArray(product.sizes) ? product.sizes.map(String) : [];
    if (!size || !sizes.includes(size)) continue;

    const requestedQty = Math.floor(Number((item as CartItem).qty));
    if (!Number.isFinite(requestedQty) || requestedQty < 1) continue;

    const remaining = productStock(product, catalogDataVerified) - (usedBySlug[slug] || 0);
    if (remaining < 1) continue;
    const qty = Math.min(requestedQty, remaining);
    const existing = normalized.find((entry) => entry.slug === slug && entry.size === size);
    if (existing) existing.qty += qty;
    else normalized.push({ slug, size, qty });
    usedBySlug[slug] = (usedBySlug[slug] || 0) + qty;
  }

  return normalized;
}

export function cartDetails(cart: CartItem[], products: Product[]): CartDetailItem[] {
  const productBySlug = new Map(products.map((p) => [p.slug, p]));
  return cart
    .map((item) => ({ ...item, product: productBySlug.get(item.slug) }))
    .filter((item): item is CartDetailItem => !!item.product);
}

export function cartTotal(details: CartDetailItem[]): number {
  return details.reduce((sum, item) => sum + Number(item.product.price || 0) * item.qty, 0);
}

/** Format du message identique au caractère près à js/main.js#buildWhatsappCartLink. */
export function buildWhatsappCartLink(
  cart: CartItem[],
  products: Product[],
  settings: Pick<SiteSettings, "whatsapp" | "catalogDataVerified" | "commercialTermsVerified" | "businessName">
): string {
  const details = cartDetails(cart, products);
  let msg = `*${settings.businessName}* — nouvelle commande\n\n`;
  for (const item of details) {
    msg += `• ${item.qty} x ${item.product.name} (taille ${item.size}) — ${FCFA(
      Number(item.product.price || 0) * item.qty
    )}\n`;
  }
  msg += `\n*${settings.catalogDataVerified ? "Total" : "Total indicatif"} : ${FCFA(cartTotal(details))}*\n`;
  if (!settings.catalogDataVerified) msg += "Prix/stock indicatifs, à confirmer sur WhatsApp.\n";
  msg += settings.commercialTermsVerified
    ? "Paiement et livraison selon les modalités applicables à votre zone.\n\n"
    : "Modalités de paiement et de livraison à confirmer sur WhatsApp.\n\n";
  msg += "Merci de me confirmer la disponibilité et le délai de livraison.";
  return `https://wa.me/${whatsappNumber(settings)}?text=${encodeURIComponent(msg)}`;
}
