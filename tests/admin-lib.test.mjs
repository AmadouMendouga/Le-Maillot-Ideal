// Comportement de la logique pure de la nouvelle admin React
// (admin-src/src/lib/) — remplace l'ancien test "l'administration exporte
// les témoignages" qui vérifiait le texte source brut de js/admin.js,
// incompatible avec un bundle minifié/hashé. Voir le plan de réécriture de
// l'admin dans CLAUDE.md §12.
import assert from "node:assert/strict";
import test from "node:test";

import { productsAreValid, siteFieldError, crossFieldSiteErrors, syncDeliveryThreshold } from "../admin-src/src/lib/validation.js";
import { buildDataJs, buildConfigJs } from "../admin-src/src/lib/exportBuilders.js";
import { crc32, dataUrlToBytes, makeZip } from "../admin-src/src/lib/zip.js";

function sampleProduct(overrides) {
  return Object.assign({
    slug: "maillot-domicile-test",
    name: "Maillot Domicile Test",
    description: "Un maillot pour les tests.",
    price: 12000,
    priceOriginal: 15000,
    stock: 5,
    sizes: ["M", "L"],
  }, overrides);
}

test("productsAreValid rejette le stock négatif", () => {
  const bad = productsAreValid([sampleProduct({ stock: -1 })]);
  assert.ok(bad, "un produit à stock négatif doit être signalé");
  assert.equal(bad.slug, "maillot-domicile-test");
});

test("productsAreValid rejette un prix non entier", () => {
  const bad = productsAreValid([sampleProduct({ price: 12000.5 })]);
  assert.ok(bad);
});

test("productsAreValid rejette un prix barré inférieur au prix", () => {
  const bad = productsAreValid([sampleProduct({ priceOriginal: 10000, price: 12000 })]);
  assert.ok(bad);
});

test("productsAreValid rejette l'absence de taille", () => {
  const bad = productsAreValid([sampleProduct({ sizes: [] })]);
  assert.ok(bad);
});

test("productsAreValid accepte un produit correct", () => {
  assert.equal(productsAreValid([sampleProduct()]), null);
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

test("siteFieldError exige une URL http(s) valide pour les réseaux sociaux quand non vide", () => {
  assert.equal(siteFieldError("instagram", "", {}), "", "vide = accepté (lien retiré)");
  assert.equal(siteFieldError("instagram", "https://instagram.com/lemaillotideal", {}), "");
  assert.notEqual(siteFieldError("instagram", "instagram.com/lemaillotideal", {}), "");
});

test("crossFieldSiteErrors bloque showTestimonials sans avis complet", () => {
  const error = crossFieldSiteErrors({ site: { showTestimonials: true }, testimonials: [], gallery: [] });
  assert.equal(error.field, "showTestimonials");
});

test("crossFieldSiteErrors bloque showGallery sans photo", () => {
  const error = crossFieldSiteErrors({ site: { showGallery: true }, testimonials: [], gallery: [] });
  assert.equal(error.field, "showGallery");
});

test("crossFieldSiteErrors n'objecte rien quand le contenu est complet", () => {
  const error = crossFieldSiteErrors({
    site: { showTestimonials: true, showGallery: true },
    testimonials: [{ name: "A", quote: "Q", src: "images/testimonials/t1.jpg" }],
    gallery: [{ src: "images/gallery/gallery-01.jpg", thumb: "images/photos/photo-01.jpg" }],
  });
  assert.equal(error, null);
});

test("syncDeliveryThreshold met à jour le texte « Gratuit dès » avec le seuil numérique", () => {
  const site = { freeShippingThreshold: 50000, deliveryRows: [{ zone: "Douala", cost: "Gratuit dès 30 000 FCFA" }] };
  syncDeliveryThreshold(site);
  // Le séparateur de milliers de toLocaleString("fr-FR") n'est pas une espace
  // ASCII normale (espace insécable selon la version d'ICU) : on le
  // recalcule plutôt que de le recopier à la main dans l'attendu.
  assert.equal(site.deliveryRows[0].cost, "Gratuit dès " + (50000).toLocaleString("fr-FR") + " FCFA");
});

test("buildDataJs inclut les avis dans window.TESTIMONIALS", () => {
  const js = buildDataJs({
    products: [sampleProduct()],
    leagues: {},
    gallery: [],
    testimonials: [{ name: "Fatou", quote: "Très content", designation: "Douala", src: "images/testimonials/t1.jpg" }],
  });
  assert.match(js, /window\.PRODUCTS = /);
  assert.match(js, /window\.TESTIMONIALS = /);
  assert.match(js, /"Fatou"/);
});

test("buildConfigJs synchronise le seuil de livraison avant export", () => {
  const site = { freeShippingThreshold: 40000, deliveryRows: [{ zone: "Douala", cost: "Gratuit dès 1 FCFA" }] };
  const js = buildConfigJs(site);
  assert.match(js, /window\.SITE = /);
  assert.ok(js.includes("Gratuit dès " + (40000).toLocaleString("fr-FR") + " FCFA"));
});

test("crc32 est déterministe et sensible au contenu", () => {
  const a = crc32(new TextEncoder().encode("le maillot ideal"));
  const b = crc32(new TextEncoder().encode("le maillot ideal"));
  const c = crc32(new TextEncoder().encode("autre contenu"));
  assert.equal(a, b, "même contenu => même CRC");
  assert.notEqual(a, c, "contenu différent => CRC différent");
  assert.ok(Number.isInteger(a) && a >= 0 && a <= 0xffffffff);
});

test("dataUrlToBytes décode le payload base64 d'une data URL", () => {
  const bytes = dataUrlToBytes("data:text/plain;base64," + Buffer.from("abc").toString("base64"));
  assert.deepEqual(Array.from(bytes), [97, 98, 99]);
});

test("dataUrlToBytes rejette une chaîne sans virgule", () => {
  assert.throws(() => dataUrlToBytes("pas une data url"));
});

test("makeZip produit un fichier ZIP valide (signature locale + fin de répertoire central)", async () => {
  const bytes = new TextEncoder().encode("contenu de test");
  const blob = makeZip([{ name: "test.txt", bytes }]);
  const buf = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual(Array.from(buf.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04], "signature de fichier local ZIP");
  const eocdSignature = [0x50, 0x4b, 0x05, 0x06];
  assert.deepEqual(Array.from(buf.slice(-22, -18)), eocdSignature, "signature de fin de répertoire central");
});
