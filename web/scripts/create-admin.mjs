// Crée (ou met à jour) un compte admin. Pas d'inscription libre dans
// l'application — c'est la seule façon de créer un compte admin.
// Usage : node scripts/create-admin.mjs email@exemple.com "mot de passe"
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url) });

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage : node scripts/create-admin.mjs email@exemple.com "mot de passe"');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const auth = getAuth(app);

let user;
try {
  user = await auth.getUserByEmail(email);
  console.log("Compte existant trouvé, mise à jour du mot de passe et du rôle...");
  await auth.updateUser(user.uid, { password });
} catch {
  console.log("Création du compte...");
  user = await auth.createUser({ email, password });
}

await auth.setCustomUserClaims(user.uid, { admin: true });
console.log(`✓ ${email} est maintenant admin (uid: ${user.uid}).`);
