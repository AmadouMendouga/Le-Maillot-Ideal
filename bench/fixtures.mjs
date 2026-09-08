// Jeux de données partagés par les benchmarks. On repart des vraies données du
// site (js/data.js, js/site-config.js) et des vrais gabarits HTML plutôt que
// d'inventer des fixtures : c'est la seule façon de mesurer une charge
// représentative de ce que fait réellement `npm run generate:products`.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function loadGlobals(...relativePaths) {
  const context = vm.createContext({ window: {} });
  for (const relativePath of relativePaths) {
    vm.runInContext(read(relativePath), context, { filename: relativePath });
  }
  return context.window;
}

export const { PRODUCTS, LEAGUES, SITE, GALLERY, TESTIMONIALS } = loadGlobals(
  "js/data.js",
  "js/site-config.js",
);

export const templates = {
  product: read("product.html"),
  shop: read("shop.html"),
  phototheque: read("phototheque.html"),
  index: read("index.html"),
  merci: read("merci.html"),
  confidentialite: read("confidentialite.html"),
  notFound: read("404.html"),
};

// Le site est publié en mode « données non vérifiées » : les branches
// « catalogue vérifié » (prix barrés, JSON-LD Offer, tableau de livraison
// réel, galerie et avis affichés) ne seraient jamais mesurées sans ce second
// jeu de réglages.
export const VERIFIED_SITE = {
  ...SITE,
  catalogDataVerified: true,
  commercialTermsVerified: true,
  showGallery: true,
  showTestimonials: true,
  showDemoNotice: false,
  instagram: "https://instagram.com/lemaillotideal",
  facebook: "https://facebook.com/lemaillotideal",
  tiktok: "https://tiktok.com/@lemaillotideal",
};

export const TESTIMONIALS_SAMPLE = Array.from({ length: 8 }, (unused, index) => ({
  name: `Client ${index + 1}`,
  quote: "Maillot conforme à la photo, livraison rapide à Douala. Je recommande la boutique.",
  designation: "Douala",
  src: `images/testimonials/t${index + 1}.jpg`,
  photoUrl: `images/testimonials/t${index + 1}.jpg`,
}));

/** Panier « pire cas réaliste » : lignes en double, slugs inconnus, quantités hors bornes. */
export function buildRawCart(products, lines = 40) {
  const raw = [];
  for (let index = 0; index < lines; index += 1) {
    const product = products[index % products.length];
    const sizes = product.sizes || ["M"];
    raw.push({ slug: product.slug, size: sizes[index % sizes.length], qty: (index % 4) + 1 });
    raw.push({ slug: product.slug, size: sizes[index % sizes.length], qty: 2 });
    raw.push({ slug: `inconnu-${index}`, size: "M", qty: 1 });
    raw.push({ slug: product.slug, size: "TAILLE-INVALIDE", qty: 1 });
    raw.push({ slug: product.slug, size: sizes[0], qty: -3 });
  }
  return raw;
}

/** Trace GPS d'une course de livraison : points bruités, imprécis et hors bornes. */
export function buildTrackPoints(count = 600) {
  const start = Date.parse("2026-01-01T08:00:00.000Z");
  const points = [];
  for (let index = 0; index < count; index += 1) {
    points.push({
      lat: 4.0511 + index * 0.00035 + (index % 7) * 0.00002,
      lng: 9.7679 + index * 0.00021 - (index % 5) * 0.00003,
      at: new Date(start + index * 4000).toISOString(),
      accuracy: index % 23 === 0 ? 480 : 8 + (index % 30),
      speed: null,
      heading: null,
    });
  }
  // Quelques points aberrants, comme en produisent les navigateurs mobiles.
  points[10] = { ...points[10], lat: 191 };
  points[42] = { ...points[42], lng: Number.NaN };
  return points;
}
