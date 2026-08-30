// Compare l'état actuel du dépôt Git (js/data.js, js/site-config.js — la
// source de vérité de l'ancienne admin, toujours en production pendant la
// Phase 1, voir le plan §5) à ce qui est réellement dans Firestore, et
// signale tout écart. Sert à repérer, avant toute bascule ou tout push, une
// publication faite depuis l'ancienne admin après la dernière migration/
// resynchronisation Firestore (voir scripts/resync-product-images.mjs pour
// corriger un écart de photo).
//
// Ne modifie rien — lecture seule des deux côtés.
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url) });

import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../");

function loadWindowFile(relativePath) {
  const code = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window;
}

function basenameNoExt(p) {
  if (!p) return "";
  try {
    // Gère aussi bien un chemin relatif ("images/photos/x.jpg") qu'une URL
    // Cloudinary complète ("https://.../le-maillot-ideal/photos/x.jpg").
    const clean = p.startsWith("http") ? new URL(p).pathname : p;
    return path.basename(clean, path.extname(clean));
  } catch {
    return path.basename(p, path.extname(p));
  }
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

let mismatches = 0;
function report(label, ...lines) {
  mismatches += 1;
  console.log(`\n✗ ${label}`);
  for (const line of lines) console.log(`  ${line}`);
}

async function checkProducts() {
  const { PRODUCTS } = loadWindowFile("js/data.js");
  const snap = await db.collection("products").get();
  const byFirestore = new Map(snap.docs.map((d) => [d.id, d.data()]));

  for (const p of PRODUCTS) {
    const fs_ = byFirestore.get(p.slug);
    if (!fs_) {
      report(`${p.slug} : absent de Firestore (produit jamais migré)`);
      continue;
    }

    const fields = [
      ["name", p.name, fs_.name],
      ["team", p.team, fs_.team],
      ["kit", p.kit, fs_.kit],
      ["price", p.price, fs_.price],
      ["priceOriginal", p.priceOriginal, fs_.priceOriginal],
      ["discountPct", p.discountPct, fs_.discountPct],
      ["stock", p.stock, fs_.stock],
      ["isNew", p.isNew, fs_.isNew],
      ["kidsAvailable", p.kidsAvailable, fs_.kidsAvailable],
      ["description", p.description, fs_.description],
    ];
    const fieldDiffs = fields.filter(([, a, b]) => a !== b);

    const sizesA = JSON.stringify(p.sizes || []);
    const sizesB = JSON.stringify(fs_.sizes || []);
    if (sizesA !== sizesB) fieldDiffs.push(["sizes", sizesA, sizesB]);

    const imageA = basenameNoExt(p.image);
    const imageB = basenameNoExt(fs_.images?.square);
    if (imageA !== imageB) fieldDiffs.push(["image (nom de fichier)", imageA, imageB]);

    if (fieldDiffs.length > 0) {
      report(
        `${p.slug} : ${fieldDiffs.length} champ(s) différent(s)`,
        ...fieldDiffs.map(([field, a, b]) => `${field} : dépôt=« ${a} » vs Firestore=« ${b} »`)
      );
    }
  }

  byFirestore.forEach((_, slug) => {
    if (!PRODUCTS.some((p) => p.slug === slug)) {
      report(`${slug} : présent dans Firestore mais absent de js/data.js (produit retiré ?)`);
    }
  });

  console.log(`\n${PRODUCTS.length} produits comparés.`);
}

async function checkSiteSettings() {
  const { SITE } = loadWindowFile("js/site-config.js");
  const doc = await db.collection("settings").doc("site").get();
  if (!doc.exists) {
    report("settings/site : document absent de Firestore");
    return;
  }
  const fs_ = doc.data();
  const keysToCompare = Object.keys(SITE).filter((k) => k !== "deliveryRows");
  const diffs = keysToCompare.filter((k) => JSON.stringify(SITE[k]) !== JSON.stringify(fs_[k]));
  if (diffs.length > 0) {
    report(
      "settings/site : réglages différents",
      ...diffs.map((k) => `${k} : dépôt=${JSON.stringify(SITE[k])} vs Firestore=${JSON.stringify(fs_[k])}`)
    );
  }
}

async function checkLeagues() {
  const { LEAGUES } = loadWindowFile("js/data.js");
  const snap = await db.collection("leagues").get();
  const byFirestore = new Map(snap.docs.map((d) => [d.id, d.data()]));
  for (const [key, league] of Object.entries(LEAGUES)) {
    const fs_ = byFirestore.get(key);
    if (!fs_) {
      report(`league ${key} : absente de Firestore`);
      continue;
    }
    if (league.label !== fs_.label || league.color !== fs_.color) {
      report(`league ${key} : label/couleur différents`, `dépôt=${league.label}/${league.color} vs Firestore=${fs_.label}/${fs_.color}`);
    }
  }
}

async function main() {
  console.log("Comparaison js/data.js + js/site-config.js (dépôt) ↔ Firestore...\n");
  await checkProducts();
  await checkSiteSettings();
  await checkLeagues();

  if (mismatches === 0) {
    console.log("\n✓ Aucun écart détecté. Firestore est synchronisé avec le dépôt.");
  } else {
    console.log(`\n${mismatches} écart(s) détecté(s) — voir ci-dessus.`);
    process.exitCode = 1;
  }
}

main().then(() => process.exit(process.exitCode || 0));
