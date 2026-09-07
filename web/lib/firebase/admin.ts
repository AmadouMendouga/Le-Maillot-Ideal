import "server-only";
import { initializeApp, getApps, getApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length) return getApp();

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
// Plusieurs actions construisent un patch avec des champs optionnels du genre
// `champ: input.champ?.trim() || undefined` (ex. kit, barcode dans
// lib/actions/products.ts) puis le spread tel quel dans .set()/.update() — le
// SDK Admin refuse par défaut tout objet contenant une valeur `undefined` et
// fait échouer TOUTE l'écriture, pas seulement ce champ (constaté le
// 07/09/2026 en testant le nouveau champ code-barres, laissé vide). Plutôt
// que de traquer chaque champ optionnel un par un, on l'autorise une fois ici :
// une clé à `undefined` est alors simplement omise de l'écriture, jamais
// stockée comme `null`.
adminDb.settings({ ignoreUndefinedProperties: true });
