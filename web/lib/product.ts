// Petits utilitaires de fiche produit, portés depuis js/main.js.
import type { Product, SiteSettings } from "@/lib/types";

function normalizeLegacyBranding(text: string): string {
  return text.replace(/Disponible chez City Sport\.?/gi, "Disponible chez IKIGAI Sport.");
}

/** Description publique dégradée tant que le catalogue n'est pas vérifié. */
export function publicProductDescription(
  product: Pick<Product, "name" | "season" | "description">,
  settings: Pick<SiteSettings, "catalogDataVerified">
): string {
  if (settings.catalogDataVerified && product.description) return normalizeLegacyBranding(product.description);
  const season = product.season ? `, saison ${product.season}` : "";
  return `${product.name}${season}. Caractéristiques, prix, tailles et disponibilité à confirmer sur WhatsApp.`;
}

export function absUrl(siteUrl: string, path: string): string {
  const base = siteUrl.replace(/\/?$/, "/");
  return base + path.replace(/^\//, "");
}
