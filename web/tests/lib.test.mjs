// Tests de logique pure (aucun DOM, aucun réseau) pour lib/cart.ts et
// lib/validation.ts — équivalent, pour le nouveau site Next.js, de
// tests/admin-lib.test.mjs à la racine du dépôt (voir le plan de migration §7).
// Lancé via `node --experimental-strip-types --test tests/lib.test.mjs`
// (Node exécute directement le TypeScript, sans étape de build séparée).
import assert from "node:assert/strict";
import test from "node:test";

import {
  FCFA,
  whatsappNumber,
  freeShippingThreshold,
  productStock,
  stockInfo,
  normalizeCart,
  cartDetails,
  cartTotal,
  buildWhatsappCartLink,
  DEFAULT_WHATSAPP_NUMBER,
  DEFAULT_FREE_SHIPPING_THRESHOLD,
} from "../lib/cart.ts";
import {
  isHttpUrl,
  siteFieldError,
  crossFieldSiteErrors,
  syncDeliveryThreshold,
  productPatchError,
} from "../lib/validation.ts";

function sampleProduct(overrides = {}) {
  return {
    slug: "maillot-domicile-test",
    name: "Maillot Domicile Test",
    team: "Test",
    kit: "Domicile",
    league: "test",
    leagueLabel: "Championnat test",
    color: "#075e54",
    season: "2026/2027",
    priceOriginal: 15000,
    price: 12000,
    discountPct: 20,
    isNew: false,
    stock: 5,
    rating: null,
    reviews: 0,
    sizes: ["S", "M", "L"],
    kidsAvailable: false,
    description: "Un maillot pour les tests.",
    images: { square: "https://res.cloudinary.com/test/square.jpg", wide: "", svgFallback: "" },
    updatedAt: "",
    updatedBy: "",
    ...overrides,
  };
}

const baseSettings = {
  whatsapp: "237655634265",
  catalogDataVerified: true,
  commercialTermsVerified: true,
  businessName: "IKIGAI Sport",
};

// --- FCFA ---------------------------------------------------------------

test("FCFA formate un nombre avec l'espace insécable fine du séparateur de milliers", () => {
  assert.equal(FCFA(17000), "17 000 FCFA");
  assert.equal(FCFA(100), "100 FCFA");
});

test("FCFA retombe sur 0 pour une valeur non finie", () => {
  assert.equal(FCFA(Number.NaN), "0 FCFA");
  assert.equal(FCFA(undefined), "0 FCFA");
});

// --- whatsappNumber / freeShippingThreshold ------------------------------

test("whatsappNumber ne garde que les chiffres du numéro configuré", () => {
  assert.equal(whatsappNumber({ whatsapp: "+237 655 634 265" }), "237655634265");
});

test("whatsappNumber retombe sur le numéro par défaut si vide", () => {
  assert.equal(whatsappNumber({ whatsapp: "" }), DEFAULT_WHATSAPP_NUMBER);
});

test("freeShippingThreshold retombe sur la valeur par défaut si négative ou absente", () => {
  assert.equal(freeShippingThreshold({ freeShippingThreshold: 20000 }), 20000);
  assert.equal(freeShippingThreshold({ freeShippingThreshold: -1 }), DEFAULT_FREE_SHIPPING_THRESHOLD);
  assert.equal(freeShippingThreshold({}), DEFAULT_FREE_SHIPPING_THRESHOLD);
});

// --- productStock / stockInfo --------------------------------------------

test("productStock ignore le stock réel tant que le catalogue n'est pas vérifié", () => {
  assert.equal(productStock(sampleProduct({ stock: 0 }), false), 99);
});

test("productStock relit le vrai stock une fois le catalogue vérifié", () => {
  assert.equal(productStock(sampleProduct({ stock: 7 }), true), 7);
  assert.equal(productStock(sampleProduct({ stock: -3 }), true), 0, "un stock négatif est plafonné à 0");
});

test("stockInfo affiche « à confirmer » tant que le catalogue n'est pas vérifié, quel que soit le stock", () => {
  const info = stockInfo(sampleProduct({ stock: 0 }), false);
  assert.equal(info.label, "Disponibilité à confirmer");
  assert.equal(info.available, true);
});

test("stockInfo distingue rupture / stock bas / en stock une fois vérifié", () => {
  assert.equal(stockInfo(sampleProduct({ stock: 0 }), true).cls, "badge-stock-out");
  assert.equal(stockInfo(sampleProduct({ stock: 0 }), true).available, false);
  assert.equal(stockInfo(sampleProduct({ stock: 3 }), true).label, "Plus que 3 en stock");
  assert.equal(stockInfo(sampleProduct({ stock: 40 }), true).label, "En stock");
});

// --- normalizeCart --------------------------------------------------------

test("normalizeCart rejette une entrée dont le slug n'existe pas au catalogue", () => {
  const products = [sampleProduct()];
  const result = normalizeCart([{ slug: "inconnu", size: "M", qty: 1 }], products, false);
  assert.deepEqual(result, []);
});

test("normalizeCart rejette une taille absente du produit", () => {
  const products = [sampleProduct({ sizes: ["S", "M"] })];
  const result = normalizeCart([{ slug: "maillot-domicile-test", size: "XXL", qty: 1 }], products, false);
  assert.deepEqual(result, []);
});

test("normalizeCart rejette une quantité non finie ou nulle", () => {
  const products = [sampleProduct()];
  assert.deepEqual(normalizeCart([{ slug: "maillot-domicile-test", size: "M", qty: 0 }], products, false), []);
  assert.deepEqual(
    normalizeCart([{ slug: "maillot-domicile-test", size: "M", qty: "beaucoup" }], products, false),
    []
  );
});

test("normalizeCart ignore les champs inattendus (prix/nom injectés) et ne garde que slug/size/qty", () => {
  const products = [sampleProduct()];
  const result = normalizeCart(
    [{ slug: "maillot-domicile-test", size: "M", qty: 1, price: 1, name: "PRIX ALTÉRÉ" }],
    products,
    false
  );
  assert.deepEqual(result, [{ slug: "maillot-domicile-test", size: "M", qty: 1 }]);
});

test("normalizeCart fusionne deux lignes identiques (même slug, même taille)", () => {
  const products = [sampleProduct()];
  const result = normalizeCart(
    [
      { slug: "maillot-domicile-test", size: "M", qty: 2 },
      { slug: "maillot-domicile-test", size: "M", qty: 3 },
    ],
    products,
    false
  );
  assert.deepEqual(result, [{ slug: "maillot-domicile-test", size: "M", qty: 5 }]);
});

test("normalizeCart plafonne la quantité au stock restant une fois le catalogue vérifié", () => {
  const products = [sampleProduct({ stock: 4 })];
  const result = normalizeCart([{ slug: "maillot-domicile-test", size: "M", qty: 10 }], products, true);
  assert.deepEqual(result, [{ slug: "maillot-domicile-test", size: "M", qty: 4 }]);
});

test("normalizeCart rejette une entrée sans stock restant (déjà épuisé par une ligne précédente)", () => {
  const products = [sampleProduct({ stock: 2 })];
  const result = normalizeCart(
    [
      { slug: "maillot-domicile-test", size: "M", qty: 2 },
      { slug: "maillot-domicile-test", size: "L", qty: 1 },
    ],
    products,
    true
  );
  assert.deepEqual(result, [{ slug: "maillot-domicile-test", size: "M", qty: 2 }]);
});

test("normalizeCart renvoie un tableau vide pour une entrée qui n'est pas un tableau", () => {
  assert.deepEqual(normalizeCart("{", [sampleProduct()], false), []);
  assert.deepEqual(normalizeCart(null, [sampleProduct()], false), []);
});

// --- cartDetails / cartTotal ----------------------------------------------

test("cartDetails joint chaque ligne au produit réel et ignore les slugs disparus du catalogue", () => {
  const products = [sampleProduct()];
  const details = cartDetails(
    [
      { slug: "maillot-domicile-test", size: "M", qty: 2 },
      { slug: "disparu", size: "M", qty: 1 },
    ],
    products
  );
  assert.equal(details.length, 1);
  assert.equal(details[0].product.name, "Maillot Domicile Test");
});

test("cartTotal additionne prix réel × quantité pour chaque ligne", () => {
  const products = [sampleProduct({ price: 10000 }), sampleProduct({ slug: "autre", price: 5000 })];
  const details = cartDetails(
    [
      { slug: "maillot-domicile-test", size: "M", qty: 2 },
      { slug: "autre", size: "L", qty: 1 },
    ],
    products
  );
  assert.equal(cartTotal(details), 25000);
});

// --- buildWhatsappCartLink --------------------------------------------------

test("buildWhatsappCartLink produit le message exact attendu par WhatsApp (catalogue vérifié)", () => {
  const products = [sampleProduct({ price: 12000 })];
  const link = buildWhatsappCartLink([{ slug: "maillot-domicile-test", size: "M", qty: 2 }], products, baseSettings);
  const expectedMessage =
    "*IKIGAI Sport* — nouvelle commande\n\n" +
    "• 2 x Maillot Domicile Test (taille M) — 24 000 FCFA\n" +
    "\n*Total : 24 000 FCFA*\n" +
    "Paiement et livraison selon les modalités applicables à votre zone.\n\n" +
    "Merci de me confirmer la disponibilité et le délai de livraison.";
  assert.equal(link, `https://wa.me/237655634265?text=${encodeURIComponent(expectedMessage)}`);
});

test("buildWhatsappCartLink ajoute les mentions « indicatif/à confirmer » tant que rien n'est vérifié", () => {
  const products = [sampleProduct({ price: 12000 })];
  const link = buildWhatsappCartLink([{ slug: "maillot-domicile-test", size: "M", qty: 1 }], products, {
    whatsapp: "237655634265",
    catalogDataVerified: false,
    commercialTermsVerified: false,
    businessName: "IKIGAI Sport",
  });
  const decoded = decodeURIComponent(link);
  assert.match(decoded, /Total indicatif/);
  assert.match(decoded, /Prix\/stock indicatifs, à confirmer sur WhatsApp\./);
  assert.match(decoded, /Modalités de paiement et de livraison à confirmer sur WhatsApp\./);
});

// --- isHttpUrl / siteFieldError ---------------------------------------------

test("isHttpUrl accepte uniquement des URL http(s) valides", () => {
  assert.equal(isHttpUrl("https://instagram.com/lemaillotideal"), true);
  assert.equal(isHttpUrl("http://example.com"), true);
  assert.equal(isHttpUrl("ftp://example.com"), false);
  assert.equal(isHttpUrl("pas une url"), false);
});

test("siteFieldError valide le numéro WhatsApp (8 à 15 chiffres, sans +)", () => {
  assert.equal(siteFieldError("whatsapp", "237655634265", {}), "");
  assert.notEqual(siteFieldError("whatsapp", "+237655634265", {}), "");
  assert.notEqual(siteFieldError("whatsapp", "123", {}), "");
});

test("siteFieldError exige que whatsappDisplay encode les mêmes chiffres que whatsapp", () => {
  const site = { whatsapp: "237655634265" };
  assert.equal(siteFieldError("whatsappDisplay", "+237 655 634 265", site), "");
  assert.notEqual(siteFieldError("whatsappDisplay", "+237 000 000 000", site), "");
});

test("siteFieldError valide les URL de réseaux sociaux, vide autorisé", () => {
  assert.equal(siteFieldError("instagram", "", {}), "", "un champ social vide n'est pas une erreur");
  assert.equal(siteFieldError("instagram", "https://instagram.com/x", {}), "");
  assert.notEqual(siteFieldError("instagram", "instagram.com/x", {}), "");
});

// --- crossFieldSiteErrors ----------------------------------------------------

test("crossFieldSiteErrors refuse d'afficher des témoignages sans avis publié", () => {
  const error = crossFieldSiteErrors({ site: { showTestimonials: true }, testimonials: [], gallery: [] });
  assert.ok(error);
  assert.equal(error.field, "showTestimonials");
});

test("crossFieldSiteErrors refuse un avis incomplet", () => {
  const error = crossFieldSiteErrors({
    site: { showTestimonials: true },
    testimonials: [{ name: "Cliente", quote: "", photoUrl: "https://x" }],
    gallery: [],
  });
  assert.ok(error);
});

test("crossFieldSiteErrors accepte un avis complet", () => {
  const error = crossFieldSiteErrors({
    site: { showTestimonials: true },
    testimonials: [{ name: "Cliente", quote: "Très satisfaite", photoUrl: "https://x" }],
    gallery: [],
  });
  assert.equal(error, null);
});

test("crossFieldSiteErrors refuse d'afficher une photothèque vide", () => {
  const error = crossFieldSiteErrors({ site: { showGallery: true }, testimonials: [], gallery: [] });
  assert.ok(error);
  assert.equal(error.field, "showGallery");
});

test("crossFieldSiteErrors n'exige rien tant que les bascules sont désactivées", () => {
  const error = crossFieldSiteErrors({ site: { showGallery: false, showTestimonials: false }, testimonials: [], gallery: [] });
  assert.equal(error, null);
});

// --- syncDeliveryThreshold ----------------------------------------------------

test("syncDeliveryThreshold met à jour uniquement les lignes « Gratuit dès… »", () => {
  const site = {
    freeShippingThreshold: 20000,
    deliveryRows: [
      { zone: "Douala", delay: "24h", cost: "Gratuit dès 15 000 FCFA", payment: "Espèces" },
      { zone: "Hors zone", delay: "3 jours", cost: "2 000 FCFA", payment: "Espèces" },
    ],
  };
  syncDeliveryThreshold(site);
  assert.equal(site.deliveryRows[0].cost, "Gratuit dès 20 000 FCFA");
  assert.equal(site.deliveryRows[1].cost, "2 000 FCFA", "une ligne sans seuil ne doit pas être modifiée");
});

test("syncDeliveryThreshold ne fait rien pour un seuil invalide", () => {
  const site = { freeShippingThreshold: -5, deliveryRows: [{ zone: "Douala", cost: "Gratuit dès 15 000 FCFA" }] };
  syncDeliveryThreshold(site);
  assert.equal(site.deliveryRows[0].cost, "Gratuit dès 15 000 FCFA");
});

// --- productPatchError ----------------------------------------------------

function samplePatch(overrides = {}) {
  return {
    name: "Maillot Domicile Test",
    team: "Test",
    kit: "Domicile",
    price: 12000,
    priceOriginal: 15000,
    stock: 5,
    season: "2026/2027",
    description: "Un maillot pour les tests.",
    sizes: ["M", "L"],
    kidsAvailable: false,
    isNew: false,
    ...overrides,
  };
}

test("productPatchError rejette un prix de vente nul ou négatif", () => {
  assert.ok(productPatchError(samplePatch({ price: 0 })));
  assert.ok(productPatchError(samplePatch({ price: -100 })));
});

test("productPatchError rejette un prix barré inférieur au prix de vente", () => {
  assert.ok(productPatchError(samplePatch({ priceOriginal: 10000, price: 12000 })));
});

test("productPatchError rejette un stock négatif", () => {
  assert.ok(productPatchError(samplePatch({ stock: -1 })));
});

test("productPatchError rejette un nom ou une description vides", () => {
  assert.ok(productPatchError(samplePatch({ name: "   " })));
  assert.ok(productPatchError(samplePatch({ description: "" })));
});

test("productPatchError rejette l'absence de taille", () => {
  assert.ok(productPatchError(samplePatch({ sizes: [] })));
});

test("productPatchError accepte un produit correct", () => {
  assert.equal(productPatchError(samplePatch()), null);
});
