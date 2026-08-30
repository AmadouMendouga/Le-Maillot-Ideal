// Resynchronise vers Cloudinary/Firestore les photos produit modifiées via
// l'ancienne admin statique pendant la construction du nouveau site (celle-ci
// reste en production, connectée au même dépôt Git, pendant toute la Phase 1
// — voir le plan §5). Un `npm run seed:firestore` complet re-téléverserait
// aussi les 70+ images inchangées ; ce script ne cible que les fichiers
// listés en argument, identifiés via `git diff --name-only <ancien-sha>
// <nouveau-sha> -- images/photos/`.
//
// Usage : node scripts/resync-product-images.mjs maillot-domicile-psg.jpg maillot-domicile-nice.jpg ...
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url) });

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../");

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage : node scripts/resync-product-images.mjs <fichier.jpg> [...]");
  console.error("(chemins relatifs à images/photos/, ou noms de fichier seuls)");
  process.exit(1);
}

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uploadWithRetry(absPath, publicId) {
  await sleep(300);
  let lastError;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await cloudinary.uploader.upload(absPath, {
        folder: "le-maillot-ideal/photos",
        public_id: publicId,
        overwrite: true,
        invalidate: true,
      });
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

async function main() {
  let updated = 0;
  for (const file of files) {
    const basename = path.basename(file, path.extname(file));
    const slug = basename; // "maillot-domicile-psg.jpg" -> slug "maillot-domicile-psg"
    const absPath = path.join(repoRoot, "images/photos", `${basename}.jpg`);

    if (!fs.existsSync(absPath)) {
      console.warn(`⚠ fichier introuvable, ignoré : ${absPath}`);
      continue;
    }

    const productRef = db.collection("products").doc(slug);
    const snap = await productRef.get();
    if (!snap.exists) {
      console.warn(`⚠ aucun produit Firestore pour le slug « ${slug} », ignoré`);
      continue;
    }

    process.stdout.write(`↻ ${slug}...`);
    const result = await uploadWithRetry(absPath, slug);
    await productRef.update({ "images.square": result.secure_url });
    console.log(` ✓ ${result.secure_url}`);
    updated += 1;
  }
  console.log(`\n${updated}/${files.length} produit(s) resynchronisé(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
