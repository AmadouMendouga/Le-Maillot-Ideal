// Premier import de produits Basketball pour IKIGAI Sport, depuis
// Basket4Ballers (nouveau fournisseur, basket4ballers.com/fr/). Patron :
// import-kusakura-meijufit.mjs (upload Cloudinary direct depuis une URL
// distante). Sélection couvrant la ligne maison b4b (Volanti, Puma x b4b) et
// les marques qu'ils revendent en tant que revendeur agréé (Nike, Jordan,
// Reebok) — chaussures adultes/enfants, maillots NBA, sac.
//
// Noms, descriptions et prix sourcés directement depuis les fiches produit
// officielles (basket4ballers.com) le 04/09/2026 — aucune donnée inventée.
// Conversion EUR → FCFA au taux fixe 1€ = 655,957 FCFA (même convention que
// les imports précédents), arrondie à la centaine la plus proche. Pas de
// remise reprise du site source (prix affiché = prix plein, comme pour les
// imports précédents) — une promo ponctuelle chez le fournisseur ne doit pas
// se figer dans notre catalogue.
//
// Usage : node scripts/import-basket4ballers.mjs
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

const ADULT_SHOE_SIZES = ["40", "41", "42", "43", "44", "45"];
const KIDS_SHOE_SIZES = ["35.5", "36", "37", "38", "39"];
const JERSEY_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const ONE_SIZE = ["Taille unique"];

const SPORT = "basketball";
const SPORT_LABEL = "Basketball";
const SPORT_COLOR = "#9a3412";

const PRODUCTS = [
  {
    slug: "basketball-volanti-rocket-air-pink",
    name: "Volanti Rocket Air Pink",
    team: "Volanti (b4b)",
    priceEur: 159,
    sizes: ADULT_SHOE_SIZES,
    description:
      "Chaussure de basket Volanti Rocket Air, ultra légère et explosive, exclusivité Europe chez Basket4Ballers.",
    image: "https://cdn2.basket4ballers.com/334615-medium_default/rocket-air-basketball-shoes-pink-vt-090-601.jpg",
    stock: 6,
  },
  {
    slug: "basketball-nike-kobe-3-low-protro-fc-barcelona",
    name: "Nike Kobe 3 Low Protro x FC Barcelona",
    team: "Nike",
    priceEur: 190,
    sizes: ADULT_SHOE_SIZES,
    description: "Chaussure de basket Nike Kobe 3 Low Protro aux couleurs du FC Barcelone, collection Kobe x FCB.",
    image: "https://cdn1.basket4ballers.com/333710-medium_default/nike-kobe-3-low-protro-x-fc-barcelona.jpg",
    stock: 5,
  },
  {
    slug: "basketball-nike-sabrina-4-light-work",
    name: "Nike Sabrina 4 Light Work",
    team: "Nike",
    priceEur: 130,
    sizes: ADULT_SHOE_SIZES,
    description: "Chaussure de basket performance Nike Sabrina 4, signature de la star WNBA Sabrina Ionescu.",
    image: "https://cdn1.basket4ballers.com/334366-medium_default/nike-sabrina-4-white-label-lx-light-work-ii0402-101.jpg",
    stock: 5,
  },
  {
    slug: "basketball-puma-b4b-all-pro-nitro-2-le-brasier",
    name: "Puma x b4b All-Pro Nitro 2 'Le Brasier'",
    team: "Puma x b4b",
    priceEur: 140,
    sizes: ADULT_SHOE_SIZES,
    description: "Chaussure de basket performance Puma x b4b All-Pro Nitro 2, collaboration exclusive 'Le Brasier'.",
    image: "https://cdn1.basket4ballers.com/289594-medium_default/puma-all-pro-nitro-2-b4b-313223-01.jpg",
    stock: 5,
  },
  {
    slug: "basketball-reebok-barbie-angel-reese-1-enfants",
    name: "Reebok Barbie x Angel Reese 1 Enfants",
    team: "Reebok",
    priceEur: 120,
    sizes: KIDS_SHOE_SIZES,
    description: "Chaussure de basket enfant Reebok Angel Reese 1, collaboration Barbie — première paire signature d'Angel Reese.",
    image: "https://cdn1.basket4ballers.com/331628-medium_default/reebok-barbie-x-angel-reese-1-enfants-gs-285410.jpg",
    stock: 6,
  },
  {
    slug: "basketball-nike-kobe-3-low-protro-enfant-hot-punch",
    name: "Nike Kobe 3 Low Protro Enfant Hot Punch",
    team: "Nike",
    priceEur: 120,
    sizes: KIDS_SHOE_SIZES,
    description: "Chaussure de basket enfant Nike Kobe 3 Low Protro, coloris Hot Punch.",
    image: "https://cdn2.basket4ballers.com/331277-medium_default/nike-kobe-3-low-protro-enfant-hot-punch-gs-iw2220-100.jpg",
    stock: 6,
  },
  {
    slug: "basketball-jordan-luka-5-mango-enfant",
    name: "Jordan Luka 5 Mango Enfant",
    team: "Jordan",
    priceEur: 100,
    sizes: KIDS_SHOE_SIZES,
    description: "Chaussure de basket enfant Jordan Luka 5, coloris orange pulse/hyper crimson.",
    image: "https://cdn2.basket4ballers.com/330491-medium_default/jordan-luka-5-orange-pulse-hyper-crimson-im5166-800.jpg",
    stock: 6,
  },
  {
    slug: "basketball-sac-a-dos-nike-elite-varsity-black-silver",
    name: "Sac à Dos Nike Elite Varsity Black Silver",
    team: "Nike",
    priceEur: 80,
    sizes: ONE_SIZE,
    description: "Sac à dos Nike Elite Varsity, pensé pour accompagner joueurs et joueuses aux matchs et aux entraînements.",
    image: "https://cdn1.basket4ballers.com/332497-medium_default/sac-a-dos-nike-elite-varsity-black-silver-hm9965-010.jpg",
    stock: 8,
  },
  {
    slug: "basketball-nike-kobe-air-force-1-low-armory-blue",
    name: "Nike Kobe Air Force 1 Low Armory Blue",
    team: "Nike",
    priceEur: 120,
    sizes: ADULT_SHOE_SIZES,
    description: "Chaussure de basket Nike Kobe Air Force 1 Low, coloris Armory Blue.",
    image: "https://cdn2.basket4ballers.com/333395-medium_default/nike-kobe-air-force-1-low-armory-blue-ib0018-103.jpg",
    stock: 5,
  },
  {
    slug: "basketball-air-jordan-1-low-og-laser",
    name: "Air Jordan 1 Low OG Laser",
    team: "Jordan",
    priceEur: 160,
    sizes: ADULT_SHOE_SIZES,
    description: "Chaussure de basket Air Jordan 1 Low OG, coloris Laser.",
    image: "https://cdn1.basket4ballers.com/332321-medium_default/air-jordan-1-low-og-laser-iv6750-001.jpg",
    stock: 5,
  },
  {
    slug: "basketball-air-jordan-1-retro-high-og-love-letter",
    name: "Air Jordan 1 Retro High OG Love Letter",
    team: "Jordan",
    priceEur: 180,
    sizes: ADULT_SHOE_SIZES,
    description: "Chaussure de basket Air Jordan 1 Retro High OG, édition Love Letter.",
    image: "https://cdn2.basket4ballers.com/328481-medium_default/air-jordan-1-retro-high-og-love-letter-dz5485-201.jpg",
    stock: 4,
  },
  {
    slug: "basketball-air-jordan-3-retro-true-blue",
    name: "Air Jordan 3 Retro True Blue",
    team: "Jordan",
    priceEur: 150,
    sizes: KIDS_SHOE_SIZES,
    description: "Chaussure de basket enfant Air Jordan 3 Retro, coloris True Blue.",
    image: "https://cdn1.basket4ballers.com/330686-medium_default/air-jordan-3-retro-true-blue-dm0967-104.jpg",
    stock: 4,
  },
  {
    slug: "basketball-maillot-nba-anthony-edwards-timberwolves",
    name: "Maillot NBA Anthony Edwards — Minnesota Timberwolves",
    team: "Jordan",
    priceEur: 105,
    sizes: JERSEY_SIZES,
    description: "Maillot NBA authentique Anthony Edwards, Minnesota Timberwolves, Jordan Statement Edition.",
    image:
      "https://cdn2.basket4ballers.com/333061-medium_default/maillot-nba-anthony-edwards-minnesota-timberwolves-jordan-statement-edition-ii4420-010.jpg",
    stock: 6,
  },
  {
    slug: "basketball-maillot-nba-victor-wembanyama-spurs",
    name: "Maillot NBA Victor Wembanyama — San Antonio Spurs",
    team: "Nike",
    priceEur: 105,
    sizes: JERSEY_SIZES,
    description: "Maillot NBA authentique Victor Wembanyama, San Antonio Spurs, Nike Icon Edition Swingman.",
    image:
      "https://cdn2.basket4ballers.com/210961-medium_default/maillot-nba-victor-wembanyama-san-antonio-spurs-nike-icon-edition-swingman.jpg",
    stock: 6,
  },
  {
    slug: "basketball-maillot-nba-luka-doncic-lakers",
    name: "Maillot NBA Luka Doncic — Los Angeles Lakers",
    team: "Nike",
    priceEur: 105,
    sizes: JERSEY_SIZES,
    description: "Maillot NBA authentique Luka Doncic, Los Angeles Lakers, Nike Icon Edition.",
    image: "https://cdn2.basket4ballers.com/292314-medium_default/maillot-nba-luka-doncic-los-angeles-lakers-nike-icon-edition-dn2009-741.jpg",
    stock: 6,
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
        sport: SPORT,
        sportLabel: SPORT_LABEL,
        league: null,
        leagueLabel: null,
        color: SPORT_COLOR,
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
        updatedBy: "import-basket4ballers-script",
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
