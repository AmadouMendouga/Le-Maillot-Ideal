# NARA.md — Brief opérationnel IKIGAI Sport

> Lu automatiquement par Claude Code (importé depuis `CLAUDE.md`). Résume l'état
> du projet et les règles à suivre pour toute intervention future.

---

## 1. Règles fondamentales (toujours)

1. **Français partout** — l'application, son interface et tous les textes visibles sont entièrement en français.
2. **Réutiliser la charte existante** — tout nouvel écran ou composant reprend les styles, tokens de couleur et patrons déjà en place (§4). Ne jamais introduire une nouvelle palette ou un nouveau style de composant sans raison explicite.
3. **Expliquer simplement** — chaque modification est présentée en langage clair et accessible, sans jargon technique inutile.
4. **Confirmer avant d'ajouter une fonctionnalité complexe** — toute nouvelle dépendance, tout nouveau service externe ou toute fonctionnalité substantielle (au-delà d'un correctif ou d'un ajustement UI) est proposée et validée avant d'être codée.

---

## 2. Le projet

Boutique multisport en ligne au Cameroun (maillots de football, judo, kendo,
nippon-kempo, basketball, sneakers). Chaque sport est un site complet avec sa
propre boutique ; `/` est le portail qui les réunit.

**Client :** Amadou — WhatsApp `+237 655 634 265`, Douala.
**Modèle de vente :** pas de paiement en ligne obligatoire — panier → message
WhatsApp pré-rempli, ou paiement CamPay en ligne (webhook déjà branché).
Commander ne nécessite pas de compte.

## 3. Stack & déploiement

- **Next.js (App Router)** + **Firebase** (Firestore + Auth), tout le code actif est dans `web/`.
- Déploiement **Vercel**, automatique à chaque `git push` sur `master`.
- Pas de build séparé pour un « admin » : tout est dans la même app Next.js (`web/app/admin/`), protégé par Firebase Auth (jamais de mot de passe en dur, jamais de vérification de rôle côté client).

## 4. Charte graphique

- **Une seule couleur d'accent : le vert** `#22C55E` (`--brand-green`). L'orange a été retiré partout (sauf distinction fonctionnelle documentée sur la carte de livraison, client vs livreur).
- Icônes : sprite **Tabler Icons** inline (`components/icons/`), jamais de police/CDN externe.
- Feuilles de style :
  - `app/lmi.css` — base du site (tokens clair/sombre, composants partagés, admin compris).
  - `app/ikigai-ui.css` — habillage mobile des écrans publics (classe `.ik-app`), pilulier/glassmorphism/pages de connexion.
  - `app/admin/admin.css` — exclusif à l'admin.
- Champs de formulaire (connexion/inscription) : pilule + icône intégrée (`.auth-field`), pas de nouveau style de champ sans raison.
- Toujours tester **clair + sombre**, et viser un contraste correct (≥ 4.5:1 pour du texte normal).

## 5. Arborescence (`web/`)

```
app/
├── page.tsx                 portail (grille des sports)
├── [sport]/                 site complet d'un sport (accueil, boutique, produits, compte, favoris)
├── admin/                   console d'administration (protégée)
├── livraison/[token]/       suivi GPS client/livreur (lien à jeton, pas de session)
├── livreur/[token]/         tableau de bord personnel d'un livreur (lien permanent, pas de mot de passe)
├── avis/[token]/            dépôt d'avis + photo (lien à jeton)
└── api/                     routes serveur (session, campay, cron…)
components/                  un sous-dossier par domaine (admin, delivery, products, account, home, icons…)
lib/
├── actions/                 Server Actions (mutations, toujours avec vérification de session/jeton)
├── data/                    lectures Firestore (Server Components)
├── types.ts                 types partagés
└── orderWorkflow.ts         état des commandes (statuts, permissions d'accès aux liens)
tests/                       lib.test.mjs, critical-actions.test.mjs (node --test)
scripts/                     scripts ponctuels (voir §6) — jamais exécutés automatiquement
```

## 6. Conventions de code

- **Composants** : `PascalCase.tsx`. **Actions/données/utilitaires** : `camelCase.ts`.
- **Commentaires en français**, uniquement quand le *pourquoi* n'est pas évident (contrainte cachée, retour client daté, bug déjà rencontré) — jamais pour décrire ce que le code fait déjà clairement.
- **Classes CSS préfixées par contexte** : `ik-` (habillage mobile public), `dlv-` (livraison), `cp-` (panier), `adm-` (admin), `pd-` (fiche produit).
- **Scripts ponctuels** (`scripts/*.mjs`) : à supprimer après usage s'ils sont jetables (préfixe `_tmp-` recommandé) — ne pas laisser traîner des scripts de test dans le dépôt.
- **Aucun mot de passe ni secret en dur dans le code** — variables d'environnement uniquement (`.env.local`, Vercel).
- **Accès par jeton dédié** (livraison, avis, livreur) plutôt que par session, quand l'usage ne nécessite pas de compte.

## 7. Workflow de travail

1. Comprendre la demande, vérifier l'état réel du code avant de supposer.
2. Coder le changement, en respectant §1 et §4.
3. **Vérifier avant d'annoncer que c'est fait** :
   - `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.
   - Vérification visuelle réelle dans le navigateur (mobile **et** desktop, clair **et** sombre) — jamais d'affirmation non vérifiée.
4. Expliquer le changement simplement (§1.3).
5. Ne committer/pousser que sur demande explicite, sauf instruction contraire déjà donnée dans la conversation.

## 8. Ce qui existe déjà (ne pas reconstruire)

- Portail multi-sports, boutique, fiche produit, panier, commande WhatsApp + CamPay.
- Comptes clients (Firebase Auth e-mail/mot de passe + connexion Google), favoris (stockage local).
- Codes-barres produits (génération auto, recherche admin par scan/saisie).
- Suivi de livraison GPS en temps réel, code de remise à 4 chiffres + QR, panneau réductible/agrandissable.
- Livreurs : inscription en libre-service, lien personnel permanent (pas de mot de passe), tableau de bord gains.
- Avis clients avec photo, proposés automatiquement après livraison.
- Admin complet : produits, championnats, sports, commandes, avis, galerie, textes du site, aperçu.

## 9. Connu, en attente

- **Connexion Apple** : non implémentée — nécessite un compte Apple Developer payant (non disponible).
- **Recherche par image** : vue en référence UI, jamais implémentée — vraie fonctionnalité IA, pas un simple ajustement visuel.
- **Photos produits** : certaines restent des images de démonstration à remplacer par les vraies photos.
- Se référer à la mémoire du projet / conversation précédente pour le détail à jour de la roadmap commerciale (CamPay, témoignages).
