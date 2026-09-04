// Premier import de produits hors football pour IKIGAI Sport — équipement Judo,
// Nippon Kempo et Kendo depuis KuSakura (accord de distribution/revendeur formel,
// marque centenaire agréée IJF/Kodokan) et vêtements lifestyle judoka MEIJU FIT.
// Patron : seed-firestore.mjs (upload Cloudinary direct depuis une URL distante,
// pas besoin de téléchargement local — cloudinary.uploader.upload accepte une
// URL http(s) directement).
//
// Noms, descriptions et prix sourcés directement depuis les fiches produit
// officielles (kusakurashop.fr, meiju-fit.com) le 04/09/2026 — aucune donnée
// inventée. Conversion EUR → FCFA au taux fixe 1€ = 655,957 FCFA (même
// convention que l'import TLQ/NanaBros), arrondie à la centaine la plus proche.
//
// Usage : node scripts/import-kusakura-meijufit.mjs
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url) });

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const EUR_TO_FCFA = 655.957;
function toFcfa(eur) {
  return Math.round((eur * EUR_TO_FCFA) / 100) * 100;
}

const WEARABLE_SIZES = ["S", "M", "L", "XL", "2XL"];
const BELT_SIZES = ["S", "M", "L", "XL"];
const ONE_SIZE = ["Taille unique"];

const SPORT_COLORS = { judo: "#1e3a8a", "nippon-kempo": "#7c2d12", kendo: "#374151" };
const SPORT_LABELS = { judo: "Judo", "nippon-kempo": "Nippon Kempo", kendo: "Kendo" };

const PRODUCTS = [
  // --- Judo (KuSakura) ---
  {
    slug: "judo-judogi-taisho-blanc-veste-kusakura",
    sport: "judo",
    name: "Judogi Compétition 'Taisho' Blanc — Veste",
    team: "KuSakura",
    priceEur: 201,
    sizes: WEARABLE_SIZES,
    description:
      "Veste de judogi KuSakura blanc, fabriquée au Japon et approuvée FIJ (normes 2022). Tissu coton/polyester 750 g/m², double couche Sashiko/Hishisashi. Conçue pour la compétition internationale, séchage rapide. Le pantalon assorti est vendu séparément.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/JOV_01_1000x1000_crop_center.progressive.jpg",
    stock: 5,
  },
  {
    slug: "judo-judogi-taisho-blanc-pantalon-kusakura",
    sport: "judo",
    name: "Judogi Compétition 'Taisho' Blanc — Pantalon",
    team: "KuSakura",
    priceEur: 99,
    sizes: WEARABLE_SIZES,
    description:
      "Pantalon de judogi KuSakura blanc, fabriqué au Japon et approuvé FIJ. Tissu double couche 100% coton. Assorti à la veste 'Taisho' Blanc, vendue séparément.",
    image:
      "http://www.kusakurashop.fr/cdn/shop/products/JOV_01_4d5d47da-b98e-4f38-b071-d95ac5a912a1_1000x1000_crop_center.progressive.jpg",
    stock: 5,
  },
  {
    slug: "judo-judogi-taisho-bleu-veste-kusakura",
    sport: "judo",
    name: "Judogi Compétition 'Taisho' Bleu — Veste",
    team: "KuSakura",
    priceEur: 201,
    sizes: WEARABLE_SIZES,
    description:
      "Veste de judogi KuSakura bleu, fabriquée au Japon et approuvée FIJ (normes 2022). Tissu coton/polyester 750 g/m², double couche Sashiko/Hishisashi. Conçue pour la compétition internationale. Le pantalon assorti est vendu séparément.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/JNV_01_1000x1000_crop_center.progressive.jpg",
    stock: 5,
  },
  {
    slug: "judo-judogi-taisho-bleu-pantalon-kusakura",
    sport: "judo",
    name: "Judogi Compétition 'Taisho' Bleu — Pantalon",
    team: "KuSakura",
    priceEur: 99,
    sizes: WEARABLE_SIZES,
    description:
      "Pantalon de judogi KuSakura bleu, fabriqué au Japon et approuvé FIJ. Tissu double couche 100% coton. Assorti à la veste 'Taisho' Bleu, vendue séparément.",
    image:
      "http://www.kusakurashop.fr/cdn/shop/products/JNV_01_e7a1f2d9-9a80-4bbb-a0cb-41c3becbeca0_1000x1000_crop_center.progressive.jpg",
    stock: 5,
  },
  {
    slug: "judo-ceinture-noire-kuroobi-kusakura",
    sport: "judo",
    name: "Ceinture Noire Kuroobi Compétition",
    team: "KuSakura",
    priceEur: 39,
    sizes: BELT_SIZES,
    description:
      "Ceinture noire de compétition KuSakura, fabriquée au Japon et approuvée FIJ (normes 2022). Coton premium, 13 lignes de surpiquage.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/JOVB_-_Taisho_01_1000x1000_crop_center.progressive.jpg",
    stock: 8,
  },
  // --- Judo (MEIJU FIT — vêtements lifestyle judoka) ---
  {
    slug: "judo-haut-compression-competition-meijufit",
    sport: "judo",
    name: "Haut de Compression MEIJU — Compétition",
    team: "MEIJU FIT",
    priceEur: 25.99,
    sizes: WEARABLE_SIZES,
    description:
      "Haut de compression MEIJU FIT, léger et respirant, sensation seconde peau. Logos discrets, pensé pour se porter sous le judogi en compétition officielle.",
    image: "http://meiju-fit.com/cdn/shop/files/6F65092E-9B7C-42E1-8662-4EBC8E954D9E.png",
    stock: 10,
  },
  {
    slug: "judo-haut-compression-essential-meijufit",
    sport: "judo",
    name: "Haut de Compression MEIJU Essential",
    team: "MEIJU FIT",
    priceEur: 25.99,
    sizes: WEARABLE_SIZES,
    description:
      "Haut de compression MEIJU FIT Essential, léger et respirant, seconde peau qui suit chaque mouvement. Adapté aux entraînements les plus exigeants.",
    image: "http://meiju-fit.com/cdn/shop/files/tshirtdecomp.jpg",
    stock: 10,
  },
  {
    slug: "judo-tshirt-supporter-meijufit",
    sport: "judo",
    name: "T-shirt Supporter MEIJU FIT",
    team: "MEIJU FIT",
    priceEur: 29.99,
    sizes: WEARABLE_SIZES,
    description:
      "T-shirt Supporter MEIJU FIT, dossard officiel de la TEAM MEIJU — logo à l'avant, grand design dans le dos inspiré des dossards de compétition.",
    image: "http://meiju-fit.com/cdn/shop/files/image_2026-08-30_152243886.png",
    stock: 0, // "Bientôt disponible" chez MEIJU FIT au moment de l'import
  },
  // --- Kendo (KuSakura) ---
  {
    slug: "kendo-tsuba-cuir-tsubadome-kusakura",
    sport: "kendo",
    name: "Tsuba en Cuir & Tsubadome pour Shinai",
    team: "KuSakura",
    priceEur: 17,
    sizes: ONE_SIZE,
    description:
      "Tsuba (garde) extra rigide en cuir épais pour shinai, avec tsubadome. Protège les mains et absorbe les chocs les plus forts. Fabriquée en Chine sous contrôle qualité KuSakura.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/Leather-Tsuba-Shinai-01_1000x1000_crop_center.progressive.jpg",
    stock: 12,
  },
  {
    slug: "kendo-tsuba-plastique-tsubadome-kusakura",
    sport: "kendo",
    name: "Tsuba & Tsubadome Plastique pour Shinai",
    team: "KuSakura",
    priceEur: 1,
    sizes: ONE_SIZE,
    description: "Tsuba (garde) en plastique solide pour shinai, avec tsubadome (bague en caoutchouc) en option.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/Plastic-Tsuba-Shinai_02_1000x1000_crop_center.progressive.jpg",
    stock: 20,
  },
  // --- Nippon Kempo (KuSakura) ---
  {
    slug: "nippon-kempo-mata-ate-kusakura",
    sport: "nippon-kempo",
    name: "Coquille de Protection Mata Ate",
    team: "KuSakura",
    priceEur: 51,
    sizes: ONE_SIZE,
    description:
      "Coquille rigide KuSakura protégeant la zone génitale, matelassage périphérique pour un maximum de confort à l'impact. Fabriquée au Japon.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/MataAte_01_1000x1000_crop_center.progressive.jpg",
    stock: 8,
  },
  {
    slug: "nippon-kempo-do-uchi-plastron-flexible-kusakura",
    sport: "nippon-kempo",
    name: "Plastron Flexible Do Uchi",
    team: "KuSakura",
    priceEur: 47,
    sizes: ONE_SIZE,
    description: "Plastron Do Uchi KuSakura, fabriqué au Japon, durable et confortable. Indispensable à tout pratiquant de Nippon Kempo.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/Breastplate-02_1000x1000_crop_center.progressive.jpg",
    stock: 8,
  },
  {
    slug: "nippon-kempo-lanieres-kusakura",
    sport: "nippon-kempo",
    name: "Lanières pour Casque et Plastron",
    team: "KuSakura",
    priceEur: 7,
    sizes: ONE_SIZE,
    description:
      "Lanières KuSakura en coton, fabriquées au Japon, vendues par paire en trois longueurs (210, 120 et 76 cm). Compatibles avec la gamme d'équipement Nippon Kempo KuSakura.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/rh11-cords-kenpo-01_1000x1000_crop_center.progressive.jpg",
    stock: 15,
  },
  {
    slug: "nippon-kempo-gants-kusakura",
    sport: "nippon-kempo",
    name: "Paire de Gants de Nippon Kempo",
    team: "KuSakura",
    priceEur: 204,
    sizes: ONE_SIZE,
    description: "Paire de gants Nippon Kempo KuSakura, fabriquée au Japon, modèle haut de gamme alliant durabilité et confort de port.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/Kempo-gloves-01_1000x1000_crop_center.progressive.jpg",
    stock: 4,
  },
  {
    slug: "nippon-kempo-kempogi-veste-kusakura",
    sport: "nippon-kempo",
    name: "Kempogi — Veste",
    team: "KuSakura",
    priceEur: 51,
    sizes: WEARABLE_SIZES,
    description:
      "Veste Kempogi KuSakura, coton type #10 tissé en Sashiko. Modèle standard haut de gamme, assez lourd, pour les pratiquants de Nippon Kempo. Le pantalon assorti est vendu séparément.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/Kempo-Gi-02_3bd3daaa-764b-4ee5-84d4-7db09d58802f_1000x1000_crop_center.progressive.jpg",
    stock: 5,
  },
  {
    slug: "nippon-kempo-kempogi-pantalon-kusakura",
    sport: "nippon-kempo",
    name: "Kempogi — Pantalon",
    team: "KuSakura",
    priceEur: 38,
    sizes: WEARABLE_SIZES,
    description:
      "Pantalon Kempogi KuSakura, tissage Sashiko en coton type #10. Assorti à la veste Kempogi, vendue séparément.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/pants-kenpo-02_1000x1000_crop_center.progressive.jpg",
    stock: 5,
  },
  {
    slug: "nippon-kempo-casque-kusakura",
    sport: "nippon-kempo",
    name: "Casque Traditionnel de Nippon Kempo",
    team: "KuSakura",
    priceEur: 299,
    sizes: ONE_SIZE,
    description:
      "Casque traditionnel KuSakura avec rembourrage intérieur en coton et masque de protection en acier. Fabriqué au Japon.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/Kempo-men-01_1000x1000_crop_center.progressive.jpg",
    stock: 3,
  },
  {
    slug: "nippon-kempo-do-standard-kusakura",
    sport: "nippon-kempo",
    name: "Plastron Standard Do",
    team: "KuSakura",
    priceEur: 259,
    sizes: ONE_SIZE,
    description:
      "Plastron Do standard KuSakura, fabriqué au Japon, résistant et durable — nécessite le port d'un plastron souple (Do Uchi) lors de la pratique.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/Kenpo-breastplast-01_1000x1000_crop_center.progressive.jpg",
    stock: 3,
  },
  {
    slug: "nippon-kempo-do-superieur-ittaigata-kusakura",
    sport: "nippon-kempo",
    name: "Plastron Supérieur Do 'Ittaigata'",
    team: "KuSakura",
    priceEur: 272,
    sizes: ONE_SIZE,
    description:
      "Plastron Do 'Ittaigata' KuSakura, modèle supérieur avec plastron souple détachable intégré. Fabriqué au Japon.",
    image: "http://www.kusakurashop.fr/cdn/shop/products/Kempo-do-08_1000x1000_crop_center.progressive.jpg",
    stock: 3,
  },
];

async function main() {
  console.log(`${PRODUCTS.length} produits à importer...`);
  for (const p of PRODUCTS) {
    const price = toFcfa(p.priceEur);
    const upload = await cloudinary.uploader.upload(p.image, {
      folder: `le-maillot-ideal/products/${p.slug}`,
      public_id: "main",
      overwrite: true,
    });

    await db
      .collection("products")
      .doc(p.slug)
      .set({
        name: p.name,
        team: p.team,
        kit: null,
        sport: p.sport,
        sportLabel: SPORT_LABELS[p.sport],
        league: null,
        leagueLabel: null,
        color: SPORT_COLORS[p.sport],
        season: "2026/2027",
        priceOriginal: price,
        price,
        discountPct: 0,
        isNew: true,
        stock: p.stock,
        rating: null,
        reviews: 0,
        sizes: p.sizes,
        kidsAvailable: false,
        description: p.description,
        images: { square: upload.secure_url, wide: upload.secure_url, svgFallback: "" },
        reelUrl: null,
        updatedAt: new Date().toISOString(),
        updatedBy: "import-kusakura-meijufit-script",
      });
    console.log(`✓ ${p.name} (${p.slug}) — ${price.toLocaleString("fr-FR")} FCFA`);
  }
  console.log("\nImport terminé.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
