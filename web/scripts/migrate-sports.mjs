// Migration one-off — IKIGAI Sport (multi-sports). Sur le modèle de
// resync-product-images.mjs : Admin SDK direct, pas de passage par les
// Server Actions (qui exigent une session admin authentifiée).
//
// 1. Crée sports/football (idempotent).
// 2. Ajoute sport:"football" à toutes les leagues qui ne l'ont pas encore.
// 3. Ajoute sport:"football", sportLabel:"Football" à tous les produits qui
//    ne l'ont pas encore (ne touche jamais un produit qui a déjà un champ
//    sport — relance sans risque).
//
// Usage : node scripts/migrate-sports.mjs
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

const FOOTBALL_KEY = "football";
const FOOTBALL_LABEL = "Football";
const FOOTBALL_COLOR = "#22c55e"; // --primary du site, cohérent avec l'identité actuelle

async function ensureFootballSport() {
  const ref = db.collection("sports").doc(FOOTBALL_KEY);
  const snap = await ref.get();
  if (snap.exists) {
    console.log("✓ sports/football existe déjà");
    return;
  }
  await ref.set({ label: FOOTBALL_LABEL, color: FOOTBALL_COLOR, logo: "" });
  console.log("✓ sports/football créé");
}

async function batchUpdateMissingField(collectionName, fields, matchLabel) {
  const snap = await db.collection(collectionName).get();
  const toUpdate = snap.docs.filter((d) => d.data().sport === undefined);
  if (toUpdate.length === 0) {
    console.log(`✓ ${collectionName} : rien à migrer (${snap.size} document(s), déjà à jour)`);
    return;
  }
  // Firestore limite un batch à 500 écritures — largement suffisant ici
  // (95+ produits, quelques leagues), mais on chunk par prudence si le
  // catalogue grossit avant la prochaine exécution.
  for (let i = 0; i < toUpdate.length; i += 500) {
    const chunk = toUpdate.slice(i, i + 500);
    const batch = db.batch();
    chunk.forEach((d) => batch.update(d.ref, fields));
    await batch.commit();
  }
  console.log(`✓ ${collectionName} : ${toUpdate.length}/${snap.size} document(s) migré(s) (${matchLabel})`);
}

await ensureFootballSport();
await batchUpdateMissingField("leagues", { sport: FOOTBALL_KEY }, "sport ajouté");
await batchUpdateMissingField(
  "products",
  { sport: FOOTBALL_KEY, sportLabel: FOOTBALL_LABEL },
  "sport + sportLabel ajoutés"
);

console.log("\nMigration IKIGAI Sport (fondation) terminée.");
process.exit(0);
