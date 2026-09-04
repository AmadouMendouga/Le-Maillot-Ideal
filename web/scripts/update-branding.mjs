// Mise à jour ponctuelle de la marque — IKIGAI Sport (migration multi-sports).
// Patron : create-admin.mjs (Admin SDK direct, .env.local).
//
// Ne touche PAS siteUrl ni email : ce sont des adresses réelles (domaine et
// boîte mail) qui n'existent pas encore sous le nouveau nom — les changer
// casserait des liens/emails fonctionnels. À mettre à jour depuis l'admin
// une fois le domaine ikigai-sport réservé et la boîte mail créée.
//
// Usage : node scripts/update-branding.mjs
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

await db
  .collection("settings")
  .doc("site")
  .update({
    businessName: "IKIGAI Sport",
    heroBadge: "Boutique d'articles de sport au Cameroun",
    heroTitle2: "Équipe-toi pour ce qui te fait vibrer.",
    heroLead:
      "Maillots, judogi, sneakers et bien d'autres — une sélection d'articles de sport pour chaque discipline. Commande sur WhatsApp, paiement selon les modalités confirmées avec vous.",
  });

console.log("✓ settings/site mis à jour : businessName, heroBadge, heroTitle2, heroLead.");
console.log("  siteUrl et email non touchés (domaine/boîte mail IKIGAI Sport pas encore prêts).");
