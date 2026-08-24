# Déploiement public

Le site public reste entièrement statique. Aucune installation Node ni étape de
build n'est nécessaire pour le consulter ou le déployer.

## Publier une modification (Vercel)

Sur le déploiement Vercel (connecté au dépôt GitHub, redéploiement automatique
à chaque push sur `master`), la console d'administration publie directement
ses modifications : onglet **Exporter** → bouton **« Publier en ligne
maintenant »**. La fonction serverless `api/publish.js` régénère tout côté
serveur et commite sur `master` via l'API GitHub — le site est à jour en
ligne sous environ une minute, sans aucun fichier à manipuler.

Cela nécessite la variable d'environnement Vercel `GITHUB_TOKEN` (jeton
GitHub *fine-grained*, limité à ce dépôt, permission « Contents: Read and
write ») ainsi que `ADMIN_USER`/`ADMIN_PASS` (protection de `/admin.html`,
voir `middleware.js`).

Les étapes manuelles ci-dessous restent une **solution de secours** — jeton
indisponible, fonction en panne, ou hébergement non-Vercel sans backend.

## Fichiers à ne pas publier

La console d'administration fonctionne localement et ne doit pas être envoyée
sur l'hébergement public. Exclure systématiquement :

- `admin.html`, `css/admin.css` et `js/admin.js` ;
- `le maillot ideal-admin.zip` et toute archive `*-admin.zip` ;
- `CLAUDE.md`, `DEPLOIEMENT.md`, `PROMPT-PRELANCEMENT.md`, `tests/`,
  `scripts/`, `node_modules/`, `.git/`, `.codex/`, `.agents/`, les fichiers
  `.env*`, `package.json` et `package-lock.json`.

Le fichier `.htaccess` bloque ces éléments sur Apache. Sur Netlify, Cloudflare
Pages, Vercel ou un autre hébergeur, appliquer la même liste dans les règles de
déploiement de la plateforme : `robots.txt` et `noindex` ne sont pas des mesures
de sécurité.

## Vérifications avant publication

1. Installer Node.js 20 ou plus récent, puis exécuter `npm ci` et
   `npx playwright install chromium` sur la machine de vérification.
2. Confirmer les prix, stocks, coordonnées et délais dans `js/site-config.js` et
   `js/data.js`.
3. Après toute modification de `js/data.js` ou `js/site-config.js`, exécuter
   `npm run generate:products`, puis `npm run check`.
4. Publier les pages HTML régénérées à la racine, le dossier `produits/` et
   `sitemap.xml` avec les autres fichiers publics.
5. Conserver le bandeau de démonstration tant que les vraies photos ne sont pas
   installées.
6. Vérifier que l'hébergement sert HTTPS, utilise `404.html` pour les réponses
   404 et respecte les en-têtes de sécurité de `.htaccess`.
7. Tester une commande réelle jusqu'à l'ouverture de WhatsApp, sans envoyer de
   message de test au client.

## Tests disponibles

- `npm test` : syntaxe, catalogue, sitemap, ressources et contenus sensibles ;
- `npm run test:browser` : rendu mobile/desktop et parcours panier dans Chromium ;
- `npm run check:generated` : vérifie que les 76 fiches et le sitemap correspondent aux données ;
- `npm run check` : vérifie la génération, puis exécute les deux suites.

Le serveur local des tests ne lit pas `.htaccess`. Avant la mise en ligne,
contrôler sur un hébergement Apache ou une préproduction les vrais statuts 404,
les redirections, les fichiers interdits, la CSP et les en-têtes de cache.
