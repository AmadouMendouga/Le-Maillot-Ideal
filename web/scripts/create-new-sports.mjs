// Création ponctuelle des sports Judo, Nippon Kempo et Kendo — premier import
// fournisseur hors football (Kusakura + MEIJU FIT). Patron : migrate-sports.mjs.
// Usage : node scripts/create-new-sports.mjs
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url) });

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

// Couleurs distinctes de celle du football (vert de marque), cohérentes avec
// la palette existante (voir web/app/lmi.css) — pas de nouvelle teinte inventée.
const SPORTS = [
  { key: "judo", label: "Judo", color: "#1e3a8a" },
  { key: "nippon-kempo", label: "Nippon Kempo", color: "#7c2d12" },
  { key: "kendo", label: "Kendo", color: "#374151" },
];

async function main() {
  for (const sport of SPORTS) {
    const ref = db.collection("sports").doc(sport.key);
    const snap = await ref.get();
    if (snap.exists) {
      console.log(`= ${sport.label} existe déjà, ignoré.`);
      continue;
    }
    await ref.set({ label: sport.label, color: sport.color, logo: "" });
    console.log(`✓ Sport créé : ${sport.label} (${sport.key})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
