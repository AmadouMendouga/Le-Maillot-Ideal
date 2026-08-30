// Migre le catalogue actuel (js/data.js + js/site-config.js à la racine du dépôt)
// vers Firestore + Cloudinary. À lancer une seule fois pour amorcer la Phase 1 —
// après ça, l'admin écrit directement dans Firestore. Voir le plan §1.
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url) });

import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../");

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

function loadWindowFile(relativePath) {
  const code = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window;
}

// Cache d'upload : un même fichier source (photo de démo réutilisée par
// plusieurs produits) n'est envoyé qu'une seule fois à Cloudinary.
const uploadCache = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uploadOnce(relativeImagePath, cloudinaryFolder) {
  if (!relativeImagePath) return "";
  if (uploadCache.has(relativeImagePath)) return uploadCache.get(relativeImagePath);

  const absPath = path.join(repoRoot, relativeImagePath);
  if (!fs.existsSync(absPath)) {
    console.warn("  ⚠ fichier introuvable, ignoré :", relativeImagePath);
    uploadCache.set(relativeImagePath, "");
    return "";
  }

  const publicId = path.basename(relativeImagePath, path.extname(relativeImagePath));

  // Palier gratuit Cloudinary : capacité de traitement très limitée en rafale.
  // On espace chaque appel et on retente longtemps plutôt que de bombarder
  // l'API — un script de migration ponctuel peut se permettre d'être lent.
  await sleep(1500);
  let lastError;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const result = await cloudinary.uploader.upload(absPath, {
        folder: cloudinaryFolder,
        public_id: publicId,
        overwrite: true,
      });
      uploadCache.set(relativeImagePath, result.secure_url);
      return result.secure_url;
    } catch (err) {
      lastError = err;
      if (err?.http_code === 429) {
        const delay = 5000 * (attempt + 1);
        console.warn(`  ⏳ limite Cloudinary atteinte, nouvelle tentative dans ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function seedProductsAndLeagues() {
  const { PRODUCTS, LEAGUES } = loadWindowFile("js/data.js");

  console.log(`Produits : ${PRODUCTS.length} à migrer...`);
  let batch = db.batch();
  let opsInBatch = 0;

  for (const p of PRODUCTS) {
    // Séquentiel plutôt que Promise.all : évite les rafales qui déclenchent
    // la limite de débit du palier gratuit Cloudinary (le cache absorbe déjà
    // la grande majorité des appels, ces photos de démo étant réutilisées).
    const square = await uploadOnce(p.image, "le-maillot-ideal/photos");
    const wide = await uploadOnce(p.imageWide, "le-maillot-ideal/gallery");
    const svgFallback = await uploadOnce(p.imageSvg, "le-maillot-ideal/products-svg");

    const doc = {
      name: p.name,
      team: p.team,
      kit: p.kit,
      league: p.league,
      leagueLabel: p.leagueLabel,
      color: p.color,
      season: p.season,
      priceOriginal: p.priceOriginal,
      price: p.price,
      discountPct: p.discountPct,
      isNew: p.isNew,
      stock: p.stock,
      rating: p.rating,
      reviews: p.reviews,
      sizes: p.sizes,
      kidsAvailable: p.kidsAvailable,
      description: p.description,
      images: { square, wide, svgFallback },
      updatedAt: new Date().toISOString(),
      updatedBy: "seed-script",
    };

    batch.set(db.collection("products").doc(p.slug), doc);
    opsInBatch++;
    if (opsInBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
    process.stdout.write(".");
  }
  if (opsInBatch > 0) await batch.commit();
  console.log(`\n✓ ${PRODUCTS.length} produits écrits dans Firestore.`);

  const leagueEntries = Object.entries(LEAGUES);
  console.log(`Championnats : ${leagueEntries.length} à migrer...`);
  for (const [key, league] of leagueEntries) {
    const logo = await uploadOnce(league.logo, "le-maillot-ideal/leagues");
    await db
      .collection("leagues")
      .doc(key)
      .set({ label: league.label, color: league.color, logo, teams: league.teams });
  }
  console.log(`✓ ${leagueEntries.length} championnats écrits dans Firestore.`);

  return { PRODUCTS, LEAGUES };
}

async function seedGalleryAndTestimonials() {
  const { GALLERY, TESTIMONIALS } = loadWindowFile("js/data.js");

  console.log(`Photothèque : ${GALLERY.length} entrées à migrer...`);
  for (let i = 0; i < GALLERY.length; i++) {
    const item = GALLERY[i];
    const src = await uploadOnce(item.src, "le-maillot-ideal/gallery");
    const thumb = await uploadOnce(item.thumb, "le-maillot-ideal/photos");
    await db.collection("gallery").add({
      src,
      thumb,
      order: i,
      createdAt: new Date().toISOString(),
    });
  }
  console.log(`✓ ${GALLERY.length} entrées de galerie écrites dans Firestore.`);

  console.log(`Témoignages : ${TESTIMONIALS.length} à migrer...`);
  for (let i = 0; i < TESTIMONIALS.length; i++) {
    const t = TESTIMONIALS[i];
    const photoUrl = await uploadOnce(t.src, "le-maillot-ideal/testimonials");
    await db.collection("testimonials").add({
      quote: t.quote,
      name: t.name,
      designation: t.designation,
      photoUrl,
      order: i,
    });
  }
  console.log(`✓ ${TESTIMONIALS.length} témoignages écrits dans Firestore.`);
}

async function seedSiteSettings() {
  const { SITE } = loadWindowFile("js/site-config.js");
  await db.collection("settings").doc("site").set(SITE);
  console.log("✓ Réglages du site écrits dans Firestore (settings/site).");
}

async function main() {
  console.log(`Dépôt : ${repoRoot}`);
  await seedProductsAndLeagues();
  await seedGalleryAndTestimonials();
  await seedSiteSettings();
  console.log("\nMigration terminée.");
  console.log(`Images uploadées ou trouvées en cache : ${uploadCache.size}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
