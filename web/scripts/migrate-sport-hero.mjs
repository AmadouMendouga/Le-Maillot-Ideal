// Migration ponctuelle — pivot portail multi-sports : le bandeau d'accueil
// (heroBadge/heroTitle1/heroTitle2/heroLead + 4 statistiques) quitte
// settings/site (global) pour devenir un champ par sport (sports/{key}),
// pour que chaque site-sport ait son propre discours (voir le plan
// "IKIGAI Sport — portail multi-sports").
//
// - sports/football reçoit les valeurs actuelles de settings/site, réécrites
//   pour parler explicitement de maillots (le texte générique "Vis ta
//   passion." mélangeait déjà le discours football avec les autres sports).
// - sports/judo, sports/nippon-kempo, sports/kendo (créés avant l'ajout des
//   champs hero à Sport) reçoivent un texte de démarrage propre à chacun.
// - settings/site perd ces 8 champs, désormais superflus.
//
// Usage : node scripts/migrate-sport-hero.mjs
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url) });

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const SPORT_HERO = {
  football: {
    heroBadge: "Boutique de maillots de football au Cameroun",
    heroTitle1: "Porte ta passion.",
    heroTitle2: "Ton maillot idéal t'attend.",
    heroLead:
      "Maillots de football pour chaque championnat et chaque équipe — commande sur WhatsApp, paiement selon les modalités confirmées avec vous.",
    statDelay: "Sur WhatsApp",
    statDelayLabel: "Délai confirmé avant commande",
    statRating: "Selon le modèle",
    statRatingLabel: "Tailles à confirmer",
  },
  judo: {
    heroBadge: "Boutique Judo au Cameroun",
    heroTitle1: "Équipe-toi pour",
    heroTitle2: "le tatami.",
    heroLead:
      "Judogi, ceintures et accessoires — une sélection pour chaque judoka. Commande sur WhatsApp, paiement selon les modalités confirmées avec vous.",
    statDelay: "Sur WhatsApp",
    statDelayLabel: "Délai confirmé avant commande",
    statRating: "Selon le modèle",
    statRatingLabel: "Tailles à confirmer",
  },
  "nippon-kempo": {
    heroBadge: "Boutique Nippon Kempo au Cameroun",
    heroTitle1: "Équipe-toi pour",
    heroTitle2: "le combat.",
    heroLead:
      "Kempogi, protections et accessoires — une sélection pour chaque pratiquant de Nippon Kempo. Commande sur WhatsApp, paiement selon les modalités confirmées avec vous.",
    statDelay: "Sur WhatsApp",
    statDelayLabel: "Délai confirmé avant commande",
    statRating: "Selon le modèle",
    statRatingLabel: "Tailles à confirmer",
  },
  kendo: {
    heroBadge: "Boutique Kendo au Cameroun",
    heroTitle1: "Équipe-toi pour",
    heroTitle2: "le dojo.",
    heroLead:
      "Accessoires de Shinai et bien d'autres — une sélection pour chaque kendoka. Commande sur WhatsApp, paiement selon les modalités confirmées avec vous.",
    statDelay: "Sur WhatsApp",
    statDelayLabel: "Délai confirmé avant commande",
    statRating: "Selon le modèle",
    statRatingLabel: "Tailles à confirmer",
  },
};

async function main() {
  for (const [key, hero] of Object.entries(SPORT_HERO)) {
    const ref = db.collection("sports").doc(key);
    const snap = await ref.get();
    if (!snap.exists) {
      console.warn(`⚠ sports/${key} introuvable, ignoré.`);
      continue;
    }
    await ref.update(hero);
    console.log(`✓ sports/${key} — bandeau d'accueil écrit.`);
  }

  await db
    .collection("settings")
    .doc("site")
    .update({
      heroBadge: FieldValue.delete(),
      heroTitle1: FieldValue.delete(),
      heroTitle2: FieldValue.delete(),
      heroLead: FieldValue.delete(),
      statDelay: FieldValue.delete(),
      statDelayLabel: FieldValue.delete(),
      statRating: FieldValue.delete(),
      statRatingLabel: FieldValue.delete(),
    });
  console.log("✓ settings/site — champs de bandeau d'accueil retirés (déplacés vers sports/*).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
