// Création ponctuelle du sport Basketball — premier import depuis
// Basket4Ballers (nouveau fournisseur). Patron : create-new-sports.mjs +
// migrate-sport-hero.mjs (créé en un seul passage cette fois, les champs de
// bandeau d'accueil font maintenant partie du schéma Sport dès la création).
// Usage : node scripts/create-basketball-sport.mjs
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

// Couleur distincte du "flame" orange déjà utilisé par le site pour les
// promotions (#ff6b00, voir app/lmi.css) — terracotta plus sombre, pas de
// confusion possible avec un badge promo.
const SPORT = {
  key: "basketball",
  label: "Basketball",
  color: "#9a3412",
  logo: "",
  heroBadge: "Boutique Basketball au Cameroun",
  heroTitle1: "Équipe-toi pour",
  heroTitle2: "le terrain.",
  heroLead:
    "Maillots, chaussures et accessoires — une sélection pour chaque baller. Commande sur WhatsApp, paiement selon les modalités confirmées avec vous.",
  statDelay: "Sur WhatsApp",
  statDelayLabel: "Délai confirmé avant commande",
  statRating: "Selon le modèle",
  statRatingLabel: "Tailles à confirmer",
};

async function main() {
  const ref = db.collection("sports").doc(SPORT.key);
  const snap = await ref.get();
  if (snap.exists) {
    console.log("= Basketball existe déjà, ignoré.");
    return;
  }
  const { key, ...data } = SPORT;
  await ref.set(data);
  console.log(`✓ Sport créé : ${SPORT.label} (${key})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
