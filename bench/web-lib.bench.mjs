// Logique pure du site Next.js (web/lib/*.ts) : panier, validation des
// commandes côté serveur, nettoyage des traces GPS de livraison. Les modules
// TypeScript sont importés directement, comme le font déjà les tests
// (`node --experimental-strip-types --test`), sans étape de build.
import { Bench } from "tinybench";
import { withCodSpeed } from "@codspeed/tinybench-plugin";

import {
  FCFA,
  buildWhatsappCartLink,
  cartDetails,
  cartTotal,
  normalizeCart,
  stockInfo,
} from "../web/lib/cart.ts";
import { crossFieldSiteErrors, productPatchError, siteFieldError } from "../web/lib/validation.ts";
import { aggregateItemQuantities, quoteOrderItems, validateOrderItems } from "../web/lib/orderValidation.ts";
import { cleanTrackPoints, distanceMeters, shouldAppendTrackPoint } from "../web/lib/location.ts";
import { canGenerateTrackingLink, normalizeOrderStatus, publicProgressStep } from "../web/lib/orderWorkflow.ts";
import { absUrl, publicProductDescription } from "../web/lib/product.ts";
import { normalizeFavoriteSlugs, toggleFavoriteSlug } from "../web/lib/favorites.ts";
import { hexToRgbTriplet, safeColor } from "../web/lib/format.ts";
import {
  GALLERY,
  PRODUCTS,
  SITE,
  TESTIMONIALS_SAMPLE,
  VERIFIED_SITE,
  buildRawCart,
  buildTrackPoints,
} from "./fixtures.mjs";

const sellableProducts = PRODUCTS.filter(
  (product) => Number.isInteger(product.price) && product.price > 0 && Number.isInteger(product.stock) && product.stock > 3,
);

const rawCart = buildRawCart(PRODUCTS);
const normalizedCart = normalizeCart(rawCart, PRODUCTS, true);
const details = cartDetails(normalizedCart, PRODUCTS);

const orderItems = sellableProducts.slice(0, 50).map((product, index) => ({
  slug: product.slug,
  size: (product.sizes || ["M"])[index % (product.sizes || ["M"]).length],
  qty: (index % 3) + 1,
}));
const productsBySlug = new Map(sellableProducts.map((product) => [product.slug, product]));

const trackPoints = buildTrackPoints();
const orderStatuses = [
  "recue", "confirmee", "preparation", "prete", "livreur_assigne",
  "en_route", "arrivee", "livree", "reportee", "annulee", "inconnu",
];
const favoriteSlugs = PRODUCTS.slice(0, 60).map((product) => product.slug);
const productPatches = sellableProducts.map((product) => ({
  name: product.name,
  team: product.team,
  kit: product.kit,
  barcode: product.barcode ?? "",
  price: product.price,
  priceOriginal: product.priceOriginal,
  stock: product.stock,
  season: product.season,
  description: product.description,
  sizes: product.sizes,
  kidsAvailable: !!product.kidsAvailable,
  isNew: !!product.isNew,
}));
const colors = PRODUCTS.map((product) => product.color);

const bench = withCodSpeed(new Bench({ time: 200 }));

bench
  .add("normalizeCart - panier localStorage à revalider (200 lignes)", () => {
    normalizeCart(rawCart, PRODUCTS, true);
  })
  .add("cartDetails + cartTotal - panier normalisé", () => {
    cartTotal(cartDetails(normalizedCart, PRODUCTS));
  })
  .add("buildWhatsappCartLink - message de commande complet", () => {
    buildWhatsappCartLink(normalizedCart, PRODUCTS, VERIFIED_SITE);
  })
  .add("stockInfo + FCFA - rendu des badges du catalogue", () => {
    for (const product of PRODUCTS) {
      stockInfo(product, true);
      FCFA(product.price);
    }
  })
  .add("validateOrderItems - frontière serveur, 50 lignes", () => {
    validateOrderItems(orderItems);
  })
  .add("quoteOrderItems - devis avec contrôle des stocks", () => {
    quoteOrderItems(orderItems, productsBySlug);
  })
  .add("aggregateItemQuantities - regroupement par produit", () => {
    aggregateItemQuantities(orderItems);
  })
  .add("productPatchError - validation admin du catalogue", () => {
    for (const patch of productPatches) productPatchError(patch);
  })
  .add("siteFieldError + crossFieldSiteErrors - réglages du site", () => {
    siteFieldError("whatsapp", SITE.whatsapp, SITE);
    siteFieldError("whatsappDisplay", SITE.whatsappDisplay, SITE);
    siteFieldError("instagram", "https://instagram.com/lemaillotideal", SITE);
    crossFieldSiteErrors({
      site: { showGallery: true, showTestimonials: true },
      testimonials: TESTIMONIALS_SAMPLE,
      gallery: GALLERY,
    });
  })
  .add("cleanTrackPoints - trace GPS de livraison (600 points)", () => {
    cleanTrackPoints(trackPoints);
  })
  .add("distanceMeters + shouldAppendTrackPoint - filtrage point à point", () => {
    for (let index = 1; index < trackPoints.length; index += 1) {
      distanceMeters(trackPoints[index - 1], trackPoints[index]);
      shouldAppendTrackPoint(trackPoints[index - 1], trackPoints[index]);
    }
  })
  .add("orderWorkflow - statuts, accès livreur et étape publique", () => {
    for (const status of orderStatuses) {
      const normalized = normalizeOrderStatus(status);
      canGenerateTrackingLink(normalized, "customer");
      canGenerateTrackingLink(normalized, "courier");
      publicProgressStep(normalized);
    }
  })
  .add("publicProductDescription + absUrl - 76 fiches produit", () => {
    for (const product of PRODUCTS) {
      publicProductDescription(product, VERIFIED_SITE);
      absUrl(SITE.siteUrl, `produits/${product.slug}`);
    }
  })
  .add("favoris - normalisation et bascule", () => {
    const normalized = normalizeFavoriteSlugs(favoriteSlugs);
    toggleFavoriteSlug(normalized, "maillot-domicile-psg");
  })
  .add("format - couleurs des championnats", () => {
    for (const color of colors) {
      safeColor(color);
      hexToRgbTriplet(color);
    }
  });

await bench.run();
console.table(bench.table());
console.log(`panier normalisé : ${normalizedCart.length} lignes, ${details.length} détails`);
