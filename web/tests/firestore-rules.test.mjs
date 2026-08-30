// Tests des Security Rules Firestore contre l'émulateur (plan de migration
// §7) : lecture publique OK, écriture directe cliente refusée — y compris
// pour un compte portant le custom claim admin, puisque l'architecture
// retenue (CLAUDE.md §12, plan §3) veut que SEUL le serveur (Admin SDK, via
// les Server Actions) écrive dans Firestore. Ce test protège justement contre
// la tentation future d'ajouter `|| request.auth.token.admin == true` aux
// règles, ce qui court-circuiterait cette garantie.
//
// Nécessite l'émulateur Firestore démarré (voir le script npm "test:rules",
// qui utilise `firebase emulators:exec`).
import { test, before, after } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [emulatorHost, emulatorPort] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "le-maillot-ideal-test",
    firestore: {
      rules: fs.readFileSync(path.join(rootDir, "firestore.rules"), "utf8"),
      host: emulatorHost,
      port: Number(emulatorPort),
    },
  });

  // Amorce des documents en contournant les règles — équivalent de l'écriture
  // par l'Admin SDK (qui, lui, contourne toujours les Security Rules côté
  // serveur), pour avoir de vraies données à lire dans les tests ci-dessous.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "products", "maillot-domicile-test"), { name: "Maillot Test", price: 12000 });
    await setDoc(doc(db, "leagues", "ligue-test"), { label: "Championnat Test" });
    await setDoc(doc(db, "gallery", "photo-test"), { src: "https://res.cloudinary.com/test/x.jpg" });
    await setDoc(doc(db, "testimonials", "avis-test"), { name: "Cliente Test" });
    await setDoc(doc(db, "settings", "site"), { whatsapp: "237655634265" });
  });
});

after(async () => {
  await testEnv.cleanup();
});

test("lecture publique OK sur products/leagues/gallery/testimonials/settings, sans authentification", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, "products", "maillot-domicile-test")));
  await assertSucceeds(getDoc(doc(db, "leagues", "ligue-test")));
  await assertSucceeds(getDoc(doc(db, "gallery", "photo-test")));
  await assertSucceeds(getDoc(doc(db, "testimonials", "avis-test")));
  await assertSucceeds(getDoc(doc(db, "settings", "site")));
});

test("écriture directe refusée pour un visiteur non connecté", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "products", "maillot-domicile-test"), { price: 1 }));
  await assertFails(setDoc(doc(db, "settings", "site"), { whatsapp: "0" }));
});

test("écriture directe refusée même pour un compte authentifié sans rôle particulier", async () => {
  const db = testEnv.authenticatedContext("visiteur-uid").firestore();
  await assertFails(setDoc(doc(db, "gallery", "photo-test"), { src: "x" }));
});

test("écriture directe refusée même pour un compte portant le custom claim admin", async () => {
  // Le SDK client d'un admin ne doit jamais pouvoir écrire directement :
  // seul le serveur (Admin SDK, dans les Server Actions) le peut. Si ce test
  // échoue après une modification des règles, c'est que quelqu'un a ajouté
  // une exception `request.auth.token.admin == true` — à ne pas faire.
  const db = testEnv.authenticatedContext("admin-uid", { admin: true }).firestore();
  await assertFails(setDoc(doc(db, "products", "maillot-domicile-test"), { price: 1 }));
  await assertFails(setDoc(doc(db, "testimonials", "avis-nouveau"), { name: "Faux avis" }));
});

test("collections non prévues (ex. futures commandes/comptes) refusées en lecture et en écriture", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "orders", "commande-test")));
  await assertFails(setDoc(doc(db, "orders", "commande-test"), { total: 1 }));
});
