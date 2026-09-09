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
import { aggregateItemQuantities, quoteOrderItems, validateOrderItems } from "../lib/orderValidation.ts";
import { cleanTrackPoints, distanceMeters, hasUsableAccuracy, routeLocationIssue, shouldAppendTrackPoint } from "../lib/location.ts";
import { publicProductDescription } from "../lib/product.ts";
import { canGenerateTrackingLink, publicProgressStep } from "../lib/orderWorkflow.ts";
import { normalizeFavoriteSlugs, toggleFavoriteSlug } from "../lib/favorites.ts";

test("les favoris ignorent une sauvegarde invalide et dédupliquent les produits", () => {
  assert.deepEqual(normalizeFavoriteSlugs({ slug: "maillot" }), []);
  assert.deepEqual(normalizeFavoriteSlugs(["maillot", "maillot", 42, null, "", "a/b", " ", "judogi"]), ["maillot", "judogi"]);
});

test("retirer un favori préserve les produits des autres univers", () => {
  const saved = ["maillot-football", "judogi", "sneaker"];
  assert.deepEqual(toggleFavoriteSlug(saved, "judogi"), ["maillot-football", "sneaker"]);
  assert.deepEqual(toggleFavoriteSlug(saved, "basketball"), [...saved, "basketball"]);
  assert.deepEqual(saved, ["maillot-football", "judogi", "sneaker"]);
});

test("une sauvegarde de favoris trop volumineuse reste bornée", () => {
  assert.equal(normalizeFavoriteSlugs(Array.from({ length: 1000 }, (_, i) => `produit-${i}`)).length, 500);
  assert.deepEqual(toggleFavoriteSlug(["maillot"], "x".repeat(181)), ["maillot"]);
});

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
  whatsapp: "12345678",
  catalogDataVerified: true,
  commercialTermsVerified: true,
  businessName: "IKIGAI Sport",
};

test("la description publique remplace l'ancienne marque City Sport", () => {
  const product = sampleProduct({ description: "Une paire confortable. Disponible chez City Sport." });
  assert.equal(
    publicProductDescription(product, baseSettings),
    "Une paire confortable. Disponible chez IKIGAI Sport."
  );
});

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
  assert.equal(whatsappNumber({ whatsapp: "+12 345 678" }), "12345678");
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
  assert.equal(link, `https://wa.me/12345678?text=${encodeURIComponent(expectedMessage)}`);
});

test("buildWhatsappCartLink ajoute les mentions « indicatif/à confirmer » tant que rien n'est vérifié", () => {
  const products = [sampleProduct({ price: 12000 })];
  const link = buildWhatsappCartLink([{ slug: "maillot-domicile-test", size: "M", qty: 1 }], products, {
    whatsapp: "12345678",
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
  assert.equal(siteFieldError("whatsapp", "12345678", {}), "");
  assert.notEqual(siteFieldError("whatsapp", "+12345678", {}), "");
  assert.notEqual(siteFieldError("whatsapp", "123", {}), "");
});

test("siteFieldError exige que whatsappDisplay encode les mêmes chiffres que whatsapp", () => {
  const site = { whatsapp: "12345678" };
  assert.equal(siteFieldError("whatsappDisplay", "+12 345 678", site), "");
  assert.notEqual(siteFieldError("whatsappDisplay", "+87 654 321", site), "");
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

// --- validation serveur des commandes --------------------------------------

test("validateOrderItems refuse les quantités négatives, fractionnaires et trop élevées", () => {
  for (const qty of [-1, 0, 1.5, 100, "2"]) {
    assert.equal(validateOrderItems([{ slug: "maillot-domicile-test", size: "M", qty }]).ok, false);
  }
});

test("validateOrderItems refuse une taille vide et un slug non canonique", () => {
  assert.equal(validateOrderItems([{ slug: "../orders", size: "M", qty: 1 }]).ok, false);
  assert.equal(validateOrderItems([{ slug: "maillot-domicile-test", size: "", qty: 1 }]).ok, false);
});

test("validateOrderItems fusionne les lignes identiques sans garder de champs injectés", () => {
  const result = validateOrderItems([
    { slug: "maillot-domicile-test", size: "M", qty: 1, price: 1 },
    { slug: "maillot-domicile-test", size: "M", qty: 2 },
  ]);
  assert.deepEqual(result, { ok: true, items: [{ slug: "maillot-domicile-test", size: "M", qty: 3 }] });
});

test("aggregateItemQuantities cumule toutes les tailles du même produit", () => {
  const quantities = aggregateItemQuantities([
    { slug: "maillot-domicile-test", size: "M", qty: 2 },
    { slug: "maillot-domicile-test", size: "L", qty: 3 },
  ]);
  assert.equal(quantities.get("maillot-domicile-test"), 5);
});

test("quoteOrderItems recalcule le total et le résumé depuis le catalogue", () => {
  const product = sampleProduct({ price: 12000, stock: 10 });
  const result = quoteOrderItems([{ slug: product.slug, size: "M", qty: 2 }], new Map([[product.slug, product]]));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.quote.total, 24000);
    assert.equal(result.quote.summary, "2x Maillot Domicile Test (M)");
  }
});

test("quoteOrderItems refuse une taille absente du produit", () => {
  const product = sampleProduct();
  assert.equal(quoteOrderItems([{ slug: product.slug, size: "XXL", qty: 1 }], new Map([[product.slug, product]])).ok, false);
});

test("quoteOrderItems contrôle le stock cumulé entre plusieurs tailles", () => {
  const product = sampleProduct({ stock: 4 });
  const result = quoteOrderItems(
    [
      { slug: product.slug, size: "M", qty: 2 },
      { slug: product.slug, size: "L", qty: 3 },
    ],
    new Map([[product.slug, product]])
  );
  assert.equal(result.ok, false);
});

// --- stabilisation du suivi GPS --------------------------------------------

test("le filtre GPS refuse une précision trop faible", () => {
  assert.equal(hasUsableAccuracy(25), true);
  assert.equal(hasUsableAccuracy(150), false);
});

test("le filtre GPS ignore le bruit stationnaire mais garde un vrai déplacement", () => {
  const first = { lat: 4.0511, lng: 9.7679, at: "2026-09-07T12:00:00.000Z", accuracy: 20 };
  const jitter = { lat: 4.05115, lng: 9.76793, at: "2026-09-07T12:00:10.000Z", accuracy: 24 };
  const moved = { lat: 4.052, lng: 9.7688, at: "2026-09-07T12:00:30.000Z", accuracy: 12 };
  assert.equal(shouldAppendTrackPoint(first, jitter), false);
  assert.equal(shouldAppendTrackPoint(first, moved), true);
  assert.ok(distanceMeters(first, moved) > 100);
});

test("cleanTrackPoints retire les sauts impossibles et plafonne l'historique", () => {
  const points = [
    { lat: 4.0511, lng: 9.7679, at: "2026-09-07T12:00:00.000Z", accuracy: 10 },
    { lat: 5.0511, lng: 10.7679, at: "2026-09-07T12:00:10.000Z", accuracy: 10 },
    { lat: 4.052, lng: 9.7688, at: "2026-09-07T12:00:30.000Z", accuracy: 10 },
  ];
  assert.deepEqual(cleanTrackPoints(points, 2), [points[0], points[2]]);
});

test("l'itinéraire refuse deux positions sur des continents différents ou périmées", () => {
  const now = Date.parse("2026-09-08T05:00:00.000Z");
  const douala = { lat: 4.0511, lng: 9.7679, updatedAt: "2026-09-08T04:59:30.000Z" };
  const bonamoussadi = { lat: 4.09, lng: 9.74, updatedAt: "2026-09-08T04:59:40.000Z" };
  const america = { lat: 40.7128, lng: -74.006, updatedAt: "2026-09-08T04:59:40.000Z" };
  const old = { ...bonamoussadi, updatedAt: "2026-09-08T04:30:00.000Z" };
  assert.equal(routeLocationIssue(douala, bonamoussadi, now), null);
  assert.equal(routeLocationIssue(douala, america, now), "positions_trop_eloignees");
  assert.equal(routeLocationIssue(douala, old, now), "position_perimee");
});

test("le lien client n'est disponible qu'au départ, le lien livreur dès que la commande est prête", () => {
  assert.equal(canGenerateTrackingLink("confirmee", "customer"), false);
  assert.equal(canGenerateTrackingLink("prete", "courier"), true);
  assert.equal(canGenerateTrackingLink("prete", "customer"), false);
  assert.equal(canGenerateTrackingLink("en_route", "customer"), true);
  assert.equal(publicProgressStep("arrivee"), 3);
});

test("le lien client reste valide une fois la commande livrée, pas celui du livreur", () => {
  assert.equal(canGenerateTrackingLink("livree", "customer"), true);
  assert.equal(canGenerateTrackingLink("livree", "courier"), false);
});

// Navigation computed from actual OSRM geometry, never from a straight-line ETA.
const { parseNavigationRoute, navigationProgress, navigationSpeed, navigationHeading } = await import("../lib/navigation.ts");
const navigationNow = Date.parse("2026-09-08T12:00:00Z");
const navigationFix = (extra = {}) => ({ lat: 4, lng: 9, updatedAt: new Date(navigationNow).toISOString(), accuracy: 5, ...extra });
const routePayload = () => ({ code: "Ok", routes: [{ distance: 2200, duration: 400, geometry: { coordinates: [[9, 4], [9.01, 4], [9.01, 4.01]] }, legs: [{ steps: [
  { name: "Rue du départ", maneuver: { type: "depart", modifier: "straight", location: [9, 4] } },
  { name: "Rue du client", maneuver: { type: "turn", modifier: "left", location: [9.01, 4] } },
  { name: "Rue du client", maneuver: { type: "arrive", location: [9.01, 4.01] } },
] }] }] });

test("navigation : convertit les coordonnées OSRM et calcule le prochain virage à partir du GPS", () => {
  const route = parseNavigationRoute(routePayload());
  assert.deepEqual(route.coords[0], [4, 9]);
  const first = navigationProgress(route, navigationFix(), navigationNow);
  assert.equal(first.kind, "ready");
  assert.equal(first.next.instruction, "Tournez à gauche");
  assert.equal(first.next.road, "Rue du client");
  assert.ok(first.next.distanceMeters > 1100 && first.next.distanceMeters < 1120);
  const afterTurn = navigationProgress(route, navigationFix({ lat: 4.001, lng: 9.01 }), navigationNow);
  assert.equal(afterTurn.next.modifier, "arrive");
  assert.ok(afterTurn.remainingMeters < first.remainingMeters);
  assert.ok(afterTurn.remainingSeconds < first.remainingSeconds);
});

test("navigation : refuse les réponses invalides sans dessiner un faux itinéraire", () => {
  assert.equal(parseNavigationRoute({ code: "NoRoute" }), null);
  for (const invalid of [Infinity, -1, "2200"]) {
    const payload = routePayload(); payload.routes[0].distance = invalid;
    assert.equal(parseNavigationRoute(payload), null);
  }
  for (const coordinates of [[], [[9, 4]], [[9, 4], [NaN, 5]], [[9, 4], [9, 100]]]) {
    const payload = routePayload(); payload.routes[0].geometry.coordinates = coordinates;
    assert.equal(parseNavigationRoute(payload), null);
  }
});

test("navigation : masque le guidage hors trajet, avec un GPS ancien ou imprécis", () => {
  const route = parseNavigationRoute(routePayload());
  assert.equal(navigationProgress(route, navigationFix({ lat: 5 }), navigationNow).kind, "off-route");
  assert.equal(navigationProgress(route, navigationFix(), navigationNow + 31_000).kind, "waiting");
  assert.equal(navigationProgress(route, navigationFix({ accuracy: 90 }), navigationNow).kind, "waiting");
  assert.equal(navigationProgress(route, null, navigationNow).kind, "waiting");
  assert.equal(navigationProgress(route, navigationFix({ updatedAt: "invalid" }), navigationNow).kind, "waiting");
});

test("navigation : n'invente ni vitesse ni orientation et conserve une vraie vitesse nulle", () => {
  assert.equal(navigationSpeed(navigationFix(), navigationNow), null);
  assert.equal(navigationSpeed(navigationFix({ speed: 0 }), navigationNow), 0);
  assert.equal(navigationSpeed(navigationFix({ speed: 10 }), navigationNow), 36);
  assert.equal(navigationSpeed(navigationFix({ speed: -1 }), navigationNow), null);
  assert.equal(navigationSpeed(navigationFix({ speed: 20 }), navigationNow + 31_000), null);
  assert.equal(navigationHeading(navigationFix({ heading: 90 }), navigationNow), 90);
  assert.equal(navigationHeading(navigationFix({ heading: 360 }), navigationNow), null);
  assert.equal(navigationHeading(navigationFix(), navigationNow), null);
});

test("navigation : une intersection ambiguë ne déclenche pas de consigne erronée", () => {
  const payload = routePayload();
  payload.routes[0].geometry.coordinates = [[9, 4], [9.01, 4], [9.01, 4.01], [9, 4.01], [9, 4]];
  const route = parseNavigationRoute(payload);
  assert.equal(navigationProgress(route, navigationFix(), navigationNow).kind, "uncertain");
});

test("navigation : une route sans étapes reste affichable sans inventer de virages", () => {
  const payload = routePayload(); delete payload.routes[0].legs;
  const progress = navigationProgress(parseNavigationRoute(payload), navigationFix(), navigationNow);
  assert.equal(progress.kind, "ready");
  assert.equal(progress.next, null);
});
