// Création ponctuelle du sport/catégorie "Sneakers" — revendeurs multi-marques
// streetwear (ex. City Sport Cameroun : Nike, Adidas, Puma, Under Armour, New
// Balance, Lacoste, Levi's, Calvin Klein). Catégorie évoquée dès le départ de
// la migration IKIGAI Sport ("MAILLOTS, JUDOGI, SNEAKERS..."). Créée sans
// produits pour l'instant — en attente des photos/prix fournis par le client
// pour City Sport (Instagram/TikTok bloqués sans connexion, voir la
// conversation). Patron : create-basketball-sport.mjs.
// Usage : node scripts/create-sneakers-sport.mjs
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

// Violet distinct des autres sports (vert football, navy judo, brun nippon
// kempo, gris kendo, terracotta basketball) — cohérent avec un rayon
// streetwear/sneakers.
const SPORT = {
  key: "sneakers",
  label: "Sneakers",
  color: "#6d28d9",
  logo: "",
  heroBadge: "Boutique Sneakers au Cameroun",
  heroTitle1: "Équipe-toi pour",
  heroTitle2: "la rue.",
  heroLead:
    "Sneakers et streetwear des plus grandes marques — une sélection pour chaque style. Commande sur WhatsApp, paiement selon les modalités confirmées avec vous.",
  statDelay: "Sur WhatsApp",
  statDelayLabel: "Délai confirmé avant commande",
  statRating: "Selon le modèle",
  statRatingLabel: "Tailles à confirmer",
};

async function main() {
  const ref = db.collection("sports").doc(SPORT.key);
  const snap = await ref.get();
  if (snap.exists) {
    console.log("= Sneakers existe déjà, ignoré.");
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
