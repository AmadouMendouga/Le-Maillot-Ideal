// Attribue un code-barres (12 chiffres aléatoires) à chaque produit qui n'en
// a pas encore — un seul passage, à exécuter après l'introduction du champ
// `barcode` sur Product (voir lib/actions/products.ts, lib/barcode.ts). Ne
// touche jamais un produit qui a déjà un code (admin ou passage précédent).
import { config } from "dotenv";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

config({ path: ".env.local" });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

function generateProductBarcode() {
  let code = "";
  for (let i = 0; i < 12; i++) code += Math.floor(Math.random() * 10);
  return code;
}

const snap = await db.collection("products").get();
const existingCodes = new Set(snap.docs.map((d) => d.data().barcode).filter(Boolean));
console.log(`${snap.size} produits au total, ${existingCodes.size} ont déjà un code-barres.`);

let assigned = 0;
for (const doc of snap.docs) {
  const data = doc.data();
  if (data.barcode) continue;
  let code;
  do {
    code = generateProductBarcode();
  } while (existingCodes.has(code));
  existingCodes.add(code);
  await doc.ref.update({ barcode: code });
  assigned++;
}

console.log(`${assigned} produit(s) mis à jour avec un nouveau code-barres.`);
