# Archive de l'audit de pré-lancement (obsolète)

> **Ne pas exécuter ce prompt.** Il décrit l'état du 22/08/2026. Les corrections
> ont été intégrées le 24/08/2026 : fiches produit statiques, sitemap, métadonnées,
> pages légales, panier fiabilisé, avis fictifs retirés et tests automatisés.
> Utiliser désormais `DEPLOIEMENT.md` et lancer `npm run check`.

> Le texte ci-dessous est conservé uniquement pour retracer les décisions de
> l'audit initial.

---

Tu travailles sur **Le Maillot Idéal**, une boutique statique de maillots de foot
au Cameroun (HTML/CSS/JS, sans framework, sans build). Lis `CLAUDE.md` avant tout :
il contient le design system, les couleurs, les composants et les contraintes du
projet. Respecte-les.

Ta mission : appliquer la check-list de pré-lancement ci-dessous. **L'audit est
déjà fait, ne le refais pas.** Chaque ligne indique son état réel, vérifié dans le
code le 22/08/2026.

---

## A. Check-list des 20 points avant lancement

### ✅ Déjà en place — ne pas retoucher

| # | Point | Où |
|---|---|---|
| 1 | Titres de pages uniques | les 4 `<title>` sont distincts et descriptifs |
| 3 | `robots.txt` | à la racine, avec la ligne `Sitemap:` |
| 4 | Avis clients | composant Animated Testimonials (accueil + photothèque) |
| 5 | CTA sticky mobile | barre panier flottante + FAB WhatsApp |
| 6 | Meta descriptions | présentes sur les 4 pages |
| 10 | FAQ | 5 questions sur l'accueil, `#faq` |
| 13 | CTA sans scroller | 2 boutons dans le hero, au-dessus de la ligne de flottaison |
| 14 | Alt text images | images produits décrites, décoratives en `alt=""` |
| 17 | Liens internes | navigation, pied de page, produits similaires |

### ⚠️ Partiel — à compléter

**#7 — Fil d'Ariane : manquant sur `product.html`**
Le fil est présent sur `shop.html` et `phototheque.html`. Sur `product.html` il
est généré dans `js/main.js` (fonction `initProductPage`) mais **il n'est pas dans
le HTML statique**, donc invisible pour les moteurs. Ajoute-le aussi en dur dans
`product.html`, et complète le JS avec le `BreadcrumbList` JSON-LD.

**#9 — Images de partage réseaux sociaux : `og:image` absent partout**
`og:title` et `og:description` existent, mais **aucune `og:image`** — les partages
WhatsApp et Facebook s'affichent sans visuel, ce qui tue le taux de clic.
Crée une image 1200×630 (logo + « Maillots de foot au Cameroun » + un maillot) dans
`images/og-cover.jpg`, puis ajoute sur les 4 pages :
```html
<meta property="og:image" content="https://le-maillot-ideal.com/images/og-cover.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://le-maillot-ideal.com/…">
<meta name="twitter:card" content="summary_large_image">
```
Sur `product.html`, mets à jour `og:image` en JS avec la photo du maillot affiché.

**#15 — Temps de réponse : nulle part**
Le site promet une commande WhatsApp mais ne dit jamais en combien de temps on
répond. Ajoute « Réponse en moins de 30 minutes, 7j/7 de 8h à 19h » (à confirmer
avec le client) sous les boutons WhatsApp et dans le bloc contact.

**#18 — Schema local business : incomplet**
`index.html` a un JSON-LD `SportingGoodsStore` minimal, et **rien sur les autres
pages**. À faire :
- Compléter celui de l'accueil : `openingHoursSpecification` (Lun–Sam 8h–19h),
  `geo`, `areaServed` (Douala, Yaoundé, Cameroun), `sameAs` (réseaux sociaux),
  `aggregateRating` — **uniquement si les notes sont réelles**.
- Ajouter un JSON-LD `Product` sur `product.html`, généré en JS depuis
  `window.PRODUCTS` : `name`, `image`, `description`, `sku`, `brand`,
  et `offers` avec `priceCurrency: "XAF"`, `price`, `availability`
  (`InStock` / `OutOfStock` selon `stock`).
- Ajouter `FAQPage` sur l'accueil à partir des 5 questions existantes.
- Ajouter `BreadcrumbList` sur `shop.html` et `product.html`.

### ❌ Manquant — à créer

**#2 — Page de remerciement (`merci.html`)**
Aujourd'hui le client part sur WhatsApp et ne revient jamais sur le site. Crée
`merci.html` : confirmation, rappel du délai de livraison, du mode de paiement,
lien vers la boutique, invitation à suivre les réseaux. Redirige-y après l'envoi
de la commande (le lien WhatsApp s'ouvre dans un onglet, donc `window.location`
sur l'onglet courant fonctionne).

**#8 — Page confidentialité (`confidentialite.html`)**
Obligatoire dès qu'on collecte un nom et un téléphone via le formulaire. Doit
dire : quelles données sont collectées (nom, téléphone, message), qu'elles
transitent par WhatsApp et ne sont pas stockées sur le site, l'usage du
`localStorage` (panier et thème uniquement, aucun traceur), et comment demander
la suppression. Lien dans le pied de page des 4 pages.
**Ne rédige pas de mentions légales complètes ni de clauses RGPD inventées** —
mets un texte factuel sur ce que fait réellement le site, et signale au client
qu'un juriste doit valider avant mise en ligne.

**#11 — Page 404 personnalisée (`404.html`)**
Même en-tête et pied de page que le reste, message clair, barre de recherche
renvoyant vers `shop.html?q=`, 4 maillots suggérés, bouton WhatsApp.

**#12 — Carte + itinéraire**
Le site dit « adresse exacte communiquée sur WhatsApp ». Si le client accepte de
publier une adresse ou un point de retrait, ajoute une carte.
**N'intègre pas d'iframe Google Maps** : c'est une requête externe bloquante et
des cookies tiers, contraire aux contraintes du projet (voir `CLAUDE.md` §1).
Mets plutôt une image statique de la carte + un lien
`https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`.
**Demande l'adresse au client avant** — n'invente aucune coordonnée.

**#16 — Mesure d'audience**
Google Analytics est un script externe et des cookies tiers : incompatible avec
la contrainte « zéro requête réseau externe » et impose un bandeau cookies.
Propose plutôt au client une solution sans cookie et sans bandeau
(Plausible, Umami auto-hébergé, ou les statistiques de son hébergeur).
**Ne l'installe pas sans son accord explicite** — c'est une décision qui engage
sa conformité.

**#20 — Photo d'équipe / du vendeur**
Sur une boutique WhatsApp, savoir à qui on parle change tout pour la confiance.
Ajoute un bloc « Qui sommes-nous » sur l'accueil avec une vraie photo du client
et deux phrases. **Placeholder explicite tant qu'il ne l'a pas fournie.**

### Sans objet
**#19 — Études de cas** : format B2B, hors sujet pour une boutique.

---

## B. Sécurité — ce qui s'applique et ce qui ne s'applique pas

La seconde vidéo liste 5 failles classiques des applis générées par IA :

1. jeton de connexion volable dans le navigateur
2. vérification « es-tu admin » faite côté client
3. aucune limite de tentatives au login
4. comptes sans email vérifié, aucune 2FA
5. mots de passe déjà présents dans des fuites, acceptés

**Sur ce site statique, ces 5 points ne s'appliquent pas** : il n'y a ni compte,
ni connexion, ni base de données, ni backend. Le `localStorage` ne contient que
le panier et le thème — aucune donnée personnelle, aucun jeton. Ne va pas ajouter
de l'authentification pour « corriger » des failles inexistantes.

**En revanche ils s'appliquent pleinement à l'app Flutter du client**
(`github.com/AmadouMendouga/flutter_billing_app`), qui a Firebase Auth, un
dashboard admin et des rôles (`admin_access_model.dart`,
`firestore_admin_repository.dart`). **Si on touche un jour à ce dépôt**, vérifier
dans cet ordre :

| # | À vérifier | Où regarder |
|---|---|---|
| 1 | Les jetons Firebase ne sont jamais recopiés dans un stockage lisible par du JS ; s'appuyer sur le SDK | `auth_bloc.dart` |
| 2 | Le statut admin est vérifié **dans les Firestore Security Rules**, pas seulement dans l'UI Flutter | `firestore.rules`, `admin_access_model.dart` |
| 3 | Limitation des tentatives de connexion activée (App Check + Identity Platform) | console Firebase |
| 4 | Email vérifié **exigé** avant tout accès, pas seulement affiché | `email_verification_page.dart`, `auth_gate_access_test.dart` |
| 5 | Longueur minimale de mot de passe et refus des mots de passe fuités (Identity Platform le propose) | console Firebase |

Le point le plus critique est le **#2** : si les règles Firestore laissent passer
une écriture qu'un utilisateur non-admin peut déclencher, tout le reste ne sert à
rien. C'est côté serveur que ça se joue, pas dans l'app.

Si le client veut un audit de ce dépôt, dis-le-lui — c'est un travail à part.

---

## C. Ordre de travail

Fais-le dans cet ordre, en vérifiant dans le navigateur à chaque étape :

1. `og:image` + Open Graph complet (le plus gros gain immédiat : les partages
   WhatsApp du client sont son premier canal d'acquisition)
2. Fil d'Ariane dans le HTML de `product.html`
3. JSON-LD `Product` + `FAQPage` + `BreadcrumbList`
4. `404.html`, `merci.html`, `confidentialite.html` + liens dans le pied de page
5. Temps de réponse affiché
6. Bloc « Qui sommes-nous » (avec placeholder)
7. Ajouter les nouvelles pages à `sitemap.xml`
8. Poser les questions au client (voir §D) — ne pas inventer les réponses

## D. À demander au client avant de finir

- L'adresse ou le point de retrait est-il publiable ? (#12)
- Quel temps de réponse promettre sur WhatsApp ? (#15)
- Photo du vendeur / de l'équipe (#20)
- Les vraies photos de maillots (voir `CLAUDE.md` §7)
- Les vrais avis clients, avec accord écrit pour publier nom et photo
- Veut-il une mesure d'audience, et laquelle ? (#16)
- Les URL de ses réseaux sociaux (les liens sont en `href="#"`)

## E. Règles à ne pas enfreindre

- **Aucune requête réseau externe** — pas de CDN, pas d'iframe Maps, pas de
  Google Fonts. Tout est auto-hébergé (`CLAUDE.md` §1).
- **N'invente aucune donnée client** : adresse, note moyenne, nombre de ventes,
  témoignage, horaires. Placeholder explicite et signalement.
- **Ne mets pas d'`aggregateRating` en JSON-LD sur des notes inventées** — c'est
  une violation des règles de Google, sanctionnable.
- Vérifie dans un navigateur avant d'annoncer que c'est fait. Teste les deux
  thèmes et au moins 390 px / 1400 px de large.
