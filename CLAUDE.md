# Le Maillot Idéal — brief de reprise

> Fichier lu automatiquement par Claude Code. Il contient tout ce qui a été décidé
> et construit jusqu'ici. **Lis-le en entier avant de modifier quoi que ce soit.**

---

## 1. Le projet

Boutique en ligne de maillots de football au Cameroun. Refonte complète de
`le-maillot-ideal.com`, livrée en **HTML / CSS / JavaScript statique**, sans
framework ni dépendance réseau à l'exécution. Un script Node local génère les
fiches produit indexables avant le déploiement.

**Client :** Djimi — WhatsApp `+237 655 634 265` · `contact@le-maillot-ideal.com` · Douala.

**Modèle de vente :** pas de paiement en ligne sur le site. Le client remplit son
panier et le site génère un message WhatsApp pré-rempli. Tant que
`SITE.catalogDataVerified` vaut `false`, les prix, stocks et caractéristiques sont
présentés comme restant à confirmer. Les modalités de paiement et de livraison
restent à confirmer tant que `SITE.commercialTermsVerified` vaut `false`.

### Contraintes non négociables

| Règle | Pourquoi |
|---|---|
| **Zéro requête réseau externe** — polices auto-hébergées, icônes en sprite SVG inline, aucun CDN | Les clients sont sur données mobiles camerounaises. Chaque requête bloquante coûte des secondes. |
| **Poids maîtrisé** — le site complet fait ~3 Mo, images comprises | Idem. Toute image ajoutée doit être recompressée (voir §7). |
| **Pas de build à l'exécution** — on ouvre `index.html` et ça marche, y compris en `file://` | Le client doit pouvoir tester sans outillage. La génération Node ne sert qu'après une modification du catalogue. |
| **Fonctionne sans JS pour le contenu critique** — prix, coordonnées, FAQ sont dans le HTML | Réseau instable. |

---

## 2. Ce qui n'allait pas sur le site d'origine (déjà corrigé, ne pas réintroduire)

1. **Témoignages volés** — la photothèque affichait six avis remerciant tous
   « Fatil Store », un nom de marque étranger au site. Signe d'un template cloné
   sans nettoyage. Corrigé : aucun avis n'est publié par défaut ; seuls des avis
   réels et autorisés peuvent être ajoutés depuis l'administration.
2. **Compteurs incohérents** — l'accueil annonçait 76 maillots, la boutique en
   affichait 67, la page Ligue 1 en listait 9. Corrigé : une seule source de
   vérité (`js/data.js`), tous les compteurs sont calculés depuis elle.
3. **Promo uniforme** — les 76 maillots étaient à 15 000 → 8 900 FCFA, même
   remise partout, en permanence. Corrigé : aucune remise n'est publiée tant que
   les données commerciales n'ont pas été validées dans l'administration.
4. **Pas de panier** — une commande = un article = un message WhatsApp. Corrigé.
5. **`sitemap.xml` en 404**, pas d'email ni d'adresse. Corrigé. Les réseaux
   sociaux restent masqués tant que leurs URL réelles ne sont pas renseignées.
6. **Fiches produit indigentes** — une phrase générique, pas de guide des
   tailles, pas de politique de retour. Corrigé.

---

## 3. Arborescence

```
le-maillot-ideal/
├── index.html            accueil
├── shop.html             catalogue + filtres
├── product.html          route de compatibilité générique (noindex)
├── produits/             76 fiches HTML indexables générées
├── phototheque.html      galerie ; avis masqués tant qu'ils sont vides
├── merci.html            confirmation après commande (noindex)
├── 404.html               page d'erreur personnalisée (noindex)
├── confidentialite.html  politique de confidentialité
├── admin.html            console d'administration hors ligne (voir §12, noindex)
├── css/
│   ├── style.css         TOUT le style du site public (~1400 lignes, un seul fichier)
│   └── admin.css         styles de l'admin uniquement — seule exception à la règle
├── js/
│   ├── icons.js          sprite SVG Material Symbols (56 icônes, inline)
│   ├── data.js           76 produits + 6 championnats + galerie + avis
│   ├── main.js           panier, filtres, thème, fiche produit, SEO fiche produit
│   ├── navbar-menu.js    barre de navigation (composant Aceternity)
│   ├── animated-testimonials.js
│   ├── direction-aware-hover.js
│   ├── stateful-button.js
│   ├── site-config.js    textes/coordonnées modifiables (window.SITE, voir §12)
│   ├── config-apply.js   applique SITE aux éléments [data-cfg] du site public
│   └── admin.js          logique de la console d'administration (voir §12)
├── fonts/                IBM Plex Sans 400/500/600/700 (woff2, 100 Ko)
├── images/
│   ├── photos/           vignettes produits 600×600 (DÉMO — à remplacer)
│   ├── gallery/          galerie 1400px (DÉMO — à remplacer)
│   ├── testimonials/     6 portraits SVG placeholder
│   ├── avatars/          6 avatars initiales
│   └── og-cover.jpg      image de partage réseaux sociaux (1200×630)
├── robots.txt            interdit /admin.html et /admin/
├── scripts/              générateur local des fiches produit et du sitemap
├── tests/                tests statiques et audit Playwright
├── package.json          commandes de génération et de contrôle
└── sitemap.xml           79 ou 80 URLs selon que la photothèque contient du contenu publié
```

**Ordre de chargement des scripts (à respecter) :**
`icons.js` dans le `<head>` → puis en fin de `<body>` : `site-config.js`, `data.js`,
`navbar-menu.js`, `direction-aware-hover.js`, `stateful-button.js`, `main.js`,
`config-apply.js` (en tout dernier, il doit s'exécuter après que `main.js` ait
construit le DOM dynamique). `animated-testimonials.js` avant `site-config.js`
sur `index.html` et `phototheque.html`. `admin.html` ne charge pas `main.js` ni
`config-apply.js` : c'est une page autonome (voir §12).

---

## 4. Design system

Repris de l'app Flutter du client : **github.com/AmadouMendouga/flutter_billing_app**,
fichier `lib/core/theme/app_theme.dart`. Material 3, seed `#6259F5`.

### Couleurs (tokens CSS dans `:root` et `html[data-theme="dark"]`)

| Token | Clair | Sombre | Origine |
|---|---|---|---|
| `--primary` | `#6259F5` | `#C6BFFF` | `AppTheme.primaryColor` |
| `--on-primary` | `#FFFFFF` | `#2C2178` | |
| `--primary-container` | `#E4E0FF` | `#443B90` | |
| `--secondary` | `#075E54` | `#6ED6C3` | aligné sur le vert WhatsApp |
| `--background` | `#F2F2F7` | `#121318` | `AppTheme.backgroundColor` / `darkBackgroundColor` |
| `--surface` | `#FFFFFF` | `#1B1C23` | `AppTheme.surfaceColor` / `darkSurfaceColor` |
| `--error` | `#B3261E` | `#F2B8B5` | `AppTheme.errorColor` |
| `--whatsapp` | `#075E54` | `#075E54` | bouton facture de `checkout_page.dart` |
| `--hero-bg` | `#6259F5` | `#332C7A` | assombri en sombre pour la lisibilité |

> **⚠️ Un seul vert.** `#075E54` sur **tous** les boutons WhatsApp, le FAB, le
> bouton « Ajouté » des cartes — en clair comme en sombre. Il y avait trois
> verts différents avant, c'est corrigé. Ne pas réintroduire de variante.
> Seule exception tolérée : en thème sombre, les **textes** verts (« Achat
> vérifié », pourcentages de remise) restent en `#6ED6C3` — `#075E54` serait
> illisible sur fond sombre.

### Formes (reprises des `ThemeData` Flutter)

```
--r-card: 16px      CardTheme
--r-item: 12px      listes, champs
--r-btn: 12px       ElevatedButtonTheme
--r-btn-lg: 16px    PrimaryButton
--r-icon-btn: 8px   boutons icône tintés
--r-sheet: 24px     bottom sheets, hero
--r-pill: 999px     badges, navigation
```

### Typographie

**IBM Plex Sans** (= `GoogleFonts.ibmPlexSansTextTheme` de l'app), auto-hébergée
dans `fonts/`. Corps de texte : 15 px, `font-weight: 500` (le `bodyLarge` w500 de
l'app). Titres en 700.

### Icônes

**Material Symbols Rounded**, mêmes glyphes que les `Icons.*` de l'app Flutter.
Compilées dans `js/icons.js` en un sprite injecté au chargement.

Usage : `<svg class="icon"><use href="#i-cart"></use></svg>`
Tailles : `.icon` 20px · `.icon-sm` 16px · `.icon-lg` 24px · `.icon-xl` 32px.

**Ajouter une icône :** récupérer le SVG dans `@material-symbols/svg-400`
(dossier `rounded/`), extraire son contenu et l'ajouter comme
`<symbol id="i-NOM" viewBox="0 -960 960 960">` dans la chaîne `SPRITE` de
`js/icons.js`. **Ne jamais charger la police Material Symbols par CDN.**

---

## 5. Composants portés — paramètres exacts

Tous portés **en JavaScript natif** (pas de React, pas de Framer Motion), avec la
Web Animations API. Les valeurs ci-dessous viennent des sources originales : les
respecter si tu modifies.

### 5.1 Navbar Menu — `js/navbar-menu.js`
*Source : ui.aceternity.com/components/navbar-menu*

Barre flottante en pilule, `position: sticky`, logo à gauche / menus au centre /
actions à droite.

**L'effet clé, c'est le `layoutId="active"` :** il n'existe qu'**une seule carte**
partagée par tous les menus. Elle glisse et se redimensionne quand on passe d'un
item à l'autre — elle ne disparaît jamais pour réapparaître.

Ressort d'origine `{ type: "spring", mass: 0.5, damping: 11.5, stiffness: 100 }`,
résolu analytiquement : ζ = 0,813 · pic à 382 ms · dépassement 1,24 % ·
stabilisation **616 ms**. Échantillonné en 45 points dans la variable CSS
`--am-spring` (fonction `linear()`). Première ouverture : `opacity 0→1`,
`scale .85→1`, `y 10→0`. Le contenu est échangé en fondu à 130 ms, en plein
mouvement.

Menus : **Boutique** et **Aide** en listes (`HoveredLink`), **Championnats** en
grille (`ProductItem`). Sous 1040 px les dropdowns disparaissent et le tiroir
latéral prend le relais (le survol n'existe pas au doigt).

### 5.2 Animated Testimonials — `js/animated-testimonials.js`
*Source : ui.aceternity.com/components/animated-testimonials*

Pile d'images en `perspective: 1000px`. Active : `z 0, scale 1, rotate 0,
opacity 1`. Inactives : `z -100, scale .95, opacity .7`, **rotation aléatoire
entre -10 et +10° régénérée à chaque transition** (le `randomRotateY()` d'origine).
`z-index = length + 2 - index`. L'image qui devient active fait le saut
`y: [0, -80, 0]` sur **400 ms ease-in-out**.

Citation révélée **mot par mot** : `blur(10px)→blur(0)`, `y 5→0`, **200 ms**,
décalage **20 ms par mot**. Nom et fonction : `y 20→0`, 200 ms.

Ajouts hors composant : points de progression, autoplay 5,2 s (pause au survol et
hors écran), flèches clavier, clic direct sur une image de la pile.

Contenu dans `window.TESTIMONIALS` dans `js/data.js` — structure
`quote`, `name`, `designation`, `src`. La liste est vide par défaut et le
composant masque toute la section dans cet état.

### 5.3 Direction Aware Hover — `js/direction-aware-hover.js`
*Source : ui.aceternity.com/components/direction-aware-hover*

Sur **toutes** les images de cartes (45 au total) : produits, fiche produit,
galerie, vignettes du hero.

Fonction `getDirection` reprise telle quelle :
```js
const x = ev.clientX - left - (w / 2) * (w > h ? h / w : 1);
const y = ev.clientY - top  - (h / 2) * (h > w ? w / h : 1);
const d = Math.round(Math.atan2(y, x) / 1.57079633 + 5) % 4;
```

Variants exacts (vérifiés au navigateur, ne pas arrondir) :

| Entrée | Image | Légende |
|---|---|---|
| haut | `y: 20` | `y: -20` |
| bas | `y: -20` | `y: 2` |
| gauche | `x: 20` | `x: -2` |
| droite | `x: -20` | `x: 20` |

Image pré-zoomée `scale(1.15)` pour que le décalage ne découvre jamais les bords.
Transition image **200 ms ease-out**, voile noir 40 % en **500 ms**, légende
**500 ms ease-out**.

Structure HTML attendue :
```html
<a class="product-media dah">
  <div class="product-badges">…</div>      <!-- z-index 41, au-dessus du voile -->
  <div class="dah-img"><img …></div>
  <div class="dah-overlay"></div>
  <div class="dah-caption"><p class="t">…</p><p class="s">…</p></div>
</a>
```

Sous `@media (hover: none)` l'effet est **entièrement neutralisé** : au doigt il
n'y a pas de direction d'entrée, un voile permanent masquerait les photos.
Un `MutationObserver` attache l'effet aux cartes injectées dynamiquement.

**Exception (24/08/2026) :** la photo de la fiche produit (`.pd-media`) n'utilise
plus ce composant — voir §5.9 Lens. DAH reste en place partout ailleurs (grille
boutique, produits similaires, galerie, vignettes du hero).

### 5.4 Stateful Button — `js/stateful-button.js`
*Source : ui.aceternity.com/components/stateful-button*

Séquence : spinner apparaît (`width 0→20px`, `scale 0→1`, **200 ms**) et tourne
(**300 ms linear infinite**) → attente du travail → spinner disparaît (200 ms) →
coche apparaît (200 ms) → **reste 2 s** → disparaît.

Tracés SVG d'origine (Tabler) : loader `M12 3a9 9 0 1 0 9 9`, coche
`M5 12l5 5l10 -10`.

Le `layout` de Framer (largeur du bouton qui s'anime quand l'icône s'insère) est
reproduit en **FLIP sur la largeur**. Vérifié : 132 px → 160 px → 132 px.

Anneau au survol (`ring-2 ring-offset-2`) : double `box-shadow`.

**Le bouton ne change JAMAIS de couleur** pendant la séquence — c'est le
comportement du composant original, et ça évite d'introduire un troisième vert.

Usage déclaratif :
```html
<a data-stateful data-stateful-delay="600" data-stateful-validate="maFonction" …>
```
Ou programmatique : `window.StatefulButton.run(el, () => maPromesse)`.

Ajout hors composant : un **état d'erreur** (vibration rouge) quand la validation
échoue — sinon on afficherait une coche de succès pour une action qui n'a pas eu
lieu.

Branché sur : « Ajouter au panier » (fiche produit), « Commander sur WhatsApp »
(fiche produit, panneau panier, navigation), « Envoyer sur WhatsApp » (contact),
bouton de la photothèque.

**Délais : 420 à 800 ms**, pas les 4 s de la démo. Le site est statique, il n'y a
pas de requête à attendre ; faire patiner un client sur données mobiles pour une
animation serait contre-productif.

### 5.5 Panier animé — dans `js/main.js` + `css/style.css`
*Source : vidéo de référence fournie par le client*

Au clic sur « Ajouter » :
1. La carte se soulève avec rebond puis retombe (`cardPop`, 550 ms).
2. Une **copie ronde de l'image vole vers le panier** en suivant un arc (monte
   avant de redescendre, tourne, rétrécit) — 720 ms, `cubic-bezier(.4,.05,.35,1)`.
   Elle part du **cadre visible** (`.product-media`), pas de l'`<img>` : celle-ci
   est zoomée à 1,15 et déborde.
3. L'image disparaît de la carte puis y revient avec un dépassement d'échelle.
4. Le bouton passe en « ✓ Ajouté » vert puis revient après 1,6 s.
5. La **barre flottante** surgit du bas en ressort, empile les vignettes rondes
   (3 max puis badge `+N`), fait un bond à chaque ajout.
6. Clic sur la barre → le **panneau** s'ouvre depuis le bas : en-tête + pastille,
   articles en cascade, ligne « Vérification de l'éligibilité à la livraison
    offerte… » avec shimmer pendant **1,4 s**. Le seuil vient de
   `SITE.freeShippingThreshold`. Si le catalogue n'est pas validé, le texte
   précise que l'éligibilité doit être confirmée, puis affiche le sous-total
   indicatif et le bouton de commande.

Le tiroir latéral d'origine a été **supprimé** : la barre + panneau le remplacent
partout, y compris via le bouton « Panier » de la navigation.

### 5.6 Container Text Flip — `js/container-text-flip.js`
*Source : ui.aceternity.com/components/container-text-flip*
*Ajouté le 24/08/2026 (passe UI/UX Aceternity)*

Bandeau d'accueil : « Au catalogue en ce moment : **[nom d'équipe]** » — la pastille
tourne sur de vrais noms d'équipe tirés de `window.PRODUCTS` (dédupliqués, 10 max),
pas sur du texte inventé. Valeurs par défaut du composant respectées : intervalle
**3000 ms**, largeur du conteneur animée en **700 ms ease-in-out** (mesurée via
`scrollWidth + 30px`). Chaque lettre apparaît en fondu-flou (`blur(10px)→0`,
opacity 0→1, **200 ms**, décalage **20 ms/lettre** — même rythme que §5.2).

Piège corrigé en cours de route : `upgrade()` marquait l'élément « prêt » dès le
premier appel, même quand `data-ctf="[]"` (placeholder vide avant que
`initHome()` n'y mette les vrais noms) — la mise à jour réelle qui suit était
alors ignorée. Le marqueur `ctfReady` n'est posé qu'une fois qu'il y a du contenu
à afficher.

### 5.7 Infinite Moving Cards — `js/infinite-moving-cards.js`
*Source : ui.aceternity.com/components/infinite-moving-cards*
*Ajouté le 24/08/2026*

Bandeau défilant sous le hero (`#leagueMarquee`), un badge par championnat avec
son nombre réel de maillots. Le contenu est dupliqué une fois puis translaté à
`-50%` en boucle CSS linéaire — la deuxième copie prend le relais exactement où
la première finit. Vitesses d'origine : `fast` 20 s · `normal` 40 s · **`slow`
80 s (retenue ici, pour rester discret)**. Pause au survol. Masqué aux lecteurs
d'écran (`aria-hidden`) : c'est une redite décorative de la grille des
championnats juste en dessous, qui porte les vrais liens.

### 5.8 Moving Border — `js/moving-border.js`
*Source : ui.aceternity.com/components/moving-border*
*Ajouté le 24/08/2026*

Anneau lumineux qui tourne autour du bouton « Toute la boutique » (section
Championnats). L'original anime un point le long du périmètre d'un `<rect>` SVG
(`getTotalLength`/`getPointAtLength`, piloté par Framer Motion) ; reproduit ici
avec la **CSS Motion Path** native (`offset-path` sur un rectangle arrondi
calculé en JS à partir des dimensions réelles du bouton) animée par la **Web
Animations API** (`offsetDistance` 0%→100%, **3000 ms linéaire, infini**). Se
désactive proprement (`highlight.style.display = "none"`) si `offset-path`
n'est pas supporté ou si `prefers-reduced-motion: reduce`.

Deux pièges rencontrés, à ne pas réintroduire :
- **Contraste** : posé d'abord sur le CTA blanc du hero (fond violet) — le
  dégradé de la traînée est `var(--primary)`, exactement la couleur qui
  transparaissait déjà dans l'interstice de 2px avant même l'animation.
  Résultat : un anneau invisible. `.mborder` a maintenant son propre fond
  (`var(--surface)` / `var(--surface-container-high)` en sombre), garanti
  différent de `--primary` quel que soit le thème ou la section où on l'utilise.
- **Double décalage** : `offset-path` centre déjà l'élément sur le point du
  tracé via `offset-anchor` (= `transform-origin`, 50% 50% par défaut). Ajouter
  en plus `transform: translate(-50%,-50%)` cumule les deux centrages et sort
  la traînée du cadre — supprimé, la boîte n'a pas d'autre transform.

### 5.9 Lens — `js/lens.js`
*Source : ui.aceternity.com/components/lens*
*Ajouté le 24/08/2026 — remplace Direction Aware Hover sur `.pd-media`*

Loupe circulaire qui suit le curseur sur la photo de la fiche produit (statique
`produits/*.html` et route `product.html?slug=`). Valeurs par défaut du
composant : `zoomFactor` **1.5**, `lensSize` **170px**. Apparition en
**300 ms ease-out**, `opacity 0→1`, `scale .58→1`. `background-size`/
`background-position` recalculés à chaque `mousemove` pour suivre le curseur.

Remplace DAH spécifiquement ici (et seulement ici) : sur une fiche produit il
n'y a qu'une seule photo déjà identifiée par le titre à côté — zoomer le tissu
ou le floquage aide davantage la décision d'achat qu'un survol directionnel
pensé pour repérer une carte dans une grille. Neutralisé sous
`@media (hover: none)`, comme les autres effets de survol du site.

---

## 6. Données — `js/data.js`

Quatre globales : `window.PRODUCTS` (76), `window.LEAGUES` (6),
`window.GALLERY` (16) et `window.TESTIMONIALS` (vide par défaut).

Schéma produit :
```js
{
  id, slug, name, team, kit,            // "Domicile" | "Extérieur" | "Third"
  league, leagueLabel, color,           // clé + libellé + couleur du championnat
  season: "2026/2027",
  priceOriginal, price, discountPct,    // en FCFA
  isNew, stock,                         // stock 0 = rupture, ≤5 = stock bas
  rating, reviews,                      // null et 0 tant qu'aucun avis réel n'existe
  sizes: ["S","M","L","XL","2XL"], kidsAvailable,
  description,
  image, imageWide, imageSvg            // imageSvg = illustration de repli
}
```

Répartition : Ligue 1 19 · Premier League 19 · Liga 8 · Serie A 8 · Bundesliga 6 ·
Équipes nationales 16. **Ces chiffres sont affichés sur l'accueil — si tu modifies
le catalogue, ils se recalculent tout seuls, mais vérifie le texte en dur
« 76 maillots disponibles » dans `index.html`.**

Filtres URL supportés par `shop.html` :
`?league=liga` · `?promo=1` · `?stock=1` · `?tri=prix-asc|prix-desc`

---

## 7. ⚠️ Ce qui doit être remplacé avant mise en ligne

| Élément | État | À faire |
|---|---|---|
| `images/photos/*` et `images/gallery/*` | **Photos de démonstration sans rapport** (soins spa, coiffure, colombes) | Remplacer par les vraies photos de maillots, mêmes noms de fichiers (`photo-01.jpg` … `photo-16.jpg`), aucun code à toucher |
| Bandeaux « Photos de démonstration » | Affichés sur `shop.html` et `phototheque.html` | **Supprimer** une fois les vraies photos en place |
| `images/testimonials/t1-6.svg` | Portraits placeholder (initiales sur dégradé) | Remplacer par de vraies photos clients, **avec leur accord écrit** |
| Textes des témoignages | Aucun avis publié par défaut | Ajouter uniquement de vrais avis autorisés. **Ne jamais coller une citation inventée sur le visage d'une personne réelle.** |
| Prix et stocks | Valeurs historiques non validées ; avertissement public actif | Saisir les vraies valeurs puis seulement passer `catalogDataVerified` à `true` |
| Notes | Toutes à `null`, volumes à `0` | Calculer depuis de vrais avis uniquement |
| Liens réseaux sociaux | Vides, icônes masquées | Mettre les vraies URL HTTPS |
| `contact@le-maillot-ideal.com` | À vérifier | Confirmer que la boîte existe |

**Recompresser toute nouvelle image** : carré 600×600 qualité 82 pour les
vignettes, large 1400 px qualité 80 pour la galerie. Les originaux du client
faisaient jusqu'à 11 Mo pièce — inutilisables en l'état.

---

## 8. Accessibilité et bonnes pratiques déjà en place

- Contraste vérifié : blanc sur `#075E54` = **7,67:1**, `#075E54` sur `#F2F2F7` = **6,87:1**.
- `prefers-reduced-motion` respecté **partout** : toutes les animations se
  désactivent proprement (vol vers le panier, pile de témoignages, direction-aware,
  spinner).
- `@media (hover: none)` : les effets de survol sont neutralisés au tactile.
- Skip link, `aria-label` sur les boutons icône, navigation clavier
  (Échap ferme panneau/menu/lightbox, flèches sur les témoignages et la lightbox).
- Aucun débordement horizontal, testé de 390 px à 1400 px.
- Sur le site public, `localStorage` ne contient que le panier v3
  (`lmi_cart_v3`) et le thème. L'admin locale utilise séparément
  `lmi_admin_draft_v2`.

**Si tu ajoutes une animation, ajoute sa désactivation dans le bloc
`@media (prefers-reduced-motion: reduce)`.**

---

## 9. Tester

La suite locale vérifie la syntaxe, les données, les ressources, les 76 fiches
générées, le sitemap et les parcours principaux dans Chromium.

```bash
npm ci
npx playwright install chromium  # une fois sur la machine de test
npm run generate:products         # après toute modification des données/config
npm run check                     # génération à jour + statique + navigateur
```

Node.js 20 ou plus récent est requis pour la suite locale.

Points à revérifier après toute modification :

```js
// 1. aucune icône manquante
const ids = new Set([...document.querySelectorAll('#icon-sprite symbol')].map(s => s.id));
[...document.querySelectorAll('use')]
  .map(u => (u.getAttribute('href') || '').slice(1))
  .filter(h => h && !ids.has(h));            // doit être vide

// 2. un seul vert
[...new Set([...document.querySelectorAll('.btn-whatsapp, .wa-float')]
  .map(e => getComputedStyle(e).backgroundColor))];   // doit avoir length === 1

// 3. pas de débordement
document.documentElement.scrollWidth > window.innerWidth;   // doit être false
```

Tester systématiquement **les deux thèmes** (`localStorage.setItem('lmi_theme','dark')`)
et **au moins 390 px et 1400 px** de large.

---

## 10. Outils mentionnés par le client

Le client a partagé un reel (@houri.s_) listant cinq outils pour améliorer les
interfaces générées par Claude Code :

1. **Impeccable** — audite l'interface (animations génériques, espacement
   irrégulier, couleurs incohérentes, gradients ratés)
2. **UI/UX Pro Max** — boîte à outils design (styles Minimal / Brutalist / Glass /
   Retro, palettes, règles de hiérarchie, contraste, espacement)
3. **Taste** — typographie, couleurs, animations, cohérence
4. **Uhu Design** — passage « brouillon → designer pro »
5. **Playwright** — test dans le navigateur

**Playwright est réel et déjà utilisable** (voir §9). Pour les quatre autres, je
n'ai pas pu vérifier leur existence ni leur provenance depuis cet environnement —
ce sont des noms cités dans une vidéo promotionnelle. **Avant d'installer un MCP
ou une skill tierce, vérifie sa source** : un serveur MCP a accès au code du
projet. Les critères qu'ils annoncent (cohérence des couleurs, régularité de
l'espacement, animations non génériques) sont de toute façon couverts par les
tokens de la §4 et les paramètres de la §5.

---

## 11. Style de travail attendu

- **Un seul fichier CSS**, `css/style.css`. Ne pas éclater en modules.
- **Vanilla JS**, pas de framework, pas de bundler.
- **Commentaires en français**, comme le reste du code.
- Quand tu portes un composant d'une bibliothèque, **va chercher les valeurs
  exactes de la source** (durées, easings, offsets) plutôt que d'approximer.
- Ne pas inventer de contenu client (avis, chiffres de vente, adresses) — mettre
  un placeholder explicite et le signaler.
- Vérifier dans un navigateur avant d'annoncer que c'est fait.

---

## 12. Console d'administration — `admin.html`

Ajoutée à la demande du client pour changer les photos, les prix, la photothèque
et les textes sans toucher au code.

### Comment ça marche

Le site est **statique** : il n'y a ni serveur, ni base de données. L'admin ne
peut donc rien écrire en ligne. Elle fonctionne en trois temps :

1. **Modifier** — tout se passe dans le navigateur, sur un brouillon enregistré
   dans `localStorage` (clé `lmi_admin_draft_v2`). Rien n'est envoyé nulle part.
2. **Exporter** — l'onglet « Exporter » génère `js/data.js`, `js/site-config.js`
   et une archive `images-le-maillot-ideal.zip` contenant uniquement les photos
   modifiées, déjà redimensionnées.
3. **Régénérer** — après remplacement local des exports, exécuter
   `npm run generate:products` pour synchroniser les pages HTML publiques,
   `produits/` et `sitemap.xml`.
4. **Déposer** — le client envoie les exports, les pages HTML régénérées, les
   fiches et le sitemap chez son hébergeur. Sans Node.js, il transmet les exports
   au mainteneur.

Les images sont retaillées côté navigateur avec `<canvas>` : **600×600 qualité
0,82** pour les vignettes, **1400 px qualité 0,80** pour la galerie. Le client
dépose ses photos brutes, il n'a rien à préparer.

L'archive ZIP est écrite à la main dans `js/admin.js` (méthode « stockée », sans
compression, avec CRC32). **Aucune bibliothèque externe** : les JPEG sont déjà
compressés, la compression n'apporterait rien et JSZip violerait la règle §1.

### Fichiers

| Fichier | Rôle |
|---|---|
| `admin.html` | l'interface, 5 onglets |
| `js/admin.js` | toute la logique (état, redimensionnement, export, ZIP) |
| `css/admin.css` | **seule exception à la règle « un seul fichier CSS »** : ces styles ne doivent pas être livrés aux visiteurs |
| `js/site-config.js` | textes et coordonnées modifiables (`window.SITE`) |
| `js/config-apply.js` | applique `SITE` aux éléments `[data-cfg]` du site public |

Les textes restent **en dur dans le HTML** (référencement + repli sans JS) ;
`config-apply.js` ne les remplace que s'ils diffèrent de la config. Pour rendre
un nouveau texte modifiable : lui ajouter `data-cfg="maCle"` dans le HTML et la
clé correspondante dans `site-config.js`.

Intégration du 23/08/2026 : `data-cfg` est posé sur `topbarInfo` (les 7 pages
publiques) et, sur `index.html` uniquement, sur `heroBadge`, `heroTitle1`,
`heroTitle2`, `heroLead`, `statDelay`, `statDelayLabel`, `statRating`,
`statRatingLabel`, `whatsappDisplay`, `email`, `address`, `hours` et
`responseTime` (ce dernier aussi sur la fiche produit, générée en JS dans
`initProductPage`). Les liens `wa.me/...` et `mailto:` de **tout le site** sont
déjà réécrits automatiquement par `config-apply.js` sans avoir besoin de
`data-cfg` — voir sa logique généraliste. Si tu ajoutes un nouveau bloc de texte
au site public (accueil ou ailleurs), pense à te demander s'il doit, lui aussi,
devenir modifiable depuis l'onglet « Textes du site ».

### ⚠️ Sécurité — à lire avant mise en ligne

**Ne mets JAMAIS un mot de passe en JavaScript sur cette page.** Le code est
téléchargé par le visiteur : un mot de passe dans le JS se lit en deux clics dans
l'inspecteur. C'est exactement la faille « vérification côté client » de la vidéo
que le client a partagée. Une fausse protection est pire que pas de protection,
parce qu'elle donne un sentiment de sécurité.

Trois options réellement sûres, par ordre de simplicité :

1. **Ne pas déployer `admin.html`** — le client la garde en local et ne met en
   ligne que les fichiers exportés. C'est le plus sûr et ça suffit dans ce cas.
2. **Protection par l'hébergeur** — `.htaccess` + `.htpasswd` en Apache, ou
   `basic_auth` en Nginx, ou la protection par mot de passe de Netlify/Vercel.
   La vérification se fait côté serveur, avant même d'envoyer le fichier.
3. **Un vrai backend** si un jour le client veut publier en un clic — voir
   ci-dessous.

`robots.txt` contient déjà `Disallow: /admin.html` et la page porte
`<meta name="robots" content="noindex, nofollow">`. **Ce n'est pas une sécurité**,
seulement une politesse envers les moteurs : n'importe qui connaissant l'URL y
accède. Les points 1 ou 2 restent indispensables.

### Si le client veut publier sans manipuler de fichiers

Il faudra un backend. Trois pistes, à discuter avec lui car chacune a un coût :

- **Firebase** (il l'utilise déjà pour son app Flutter) : Firestore pour les
  données, Storage pour les images, Auth pour la connexion. Le plus cohérent
  avec son écosystème. Attention : la vérification du rôle admin doit être dans
  les **Firestore Security Rules**, pas dans l'interface.
- **CMS sur Git** (Decap CMS, Tina) : l'admin écrit dans le dépôt, l'hébergeur
  reconstruit. Gratuit, pas de backend à maintenir, mais introduit une étape de
  build — contraire à la règle §1.
- **Supabase** : équivalent à Firebase, base PostgreSQL.

Dans les trois cas le site cesse d'être purement statique. **Ne pas s'engager
là-dedans sans validation explicite du client** : c'est un changement d'échelle,
pas une amélioration.
