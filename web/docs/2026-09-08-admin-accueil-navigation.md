# IKIGAI — admin, accueil et navigation

## Écrans modifiés

- `/admin/apercu` : commandes à préparer, livraisons en cours, stocks faibles et paiements à vérifier. Les indicateurs viennent des données de la session admin vérifiée. Aucune statistique commerciale fictive.
- `/admin/commandes` : recherche client/téléphone/article et filtres opérationnels. Les actions existantes sont conservées. Présentation en cartes sur mobile.
- `/admin` : catalogue et stock, avec présentation mobile, colonne code-barres conservée et vocabulaire multisport.
- `/` : hero avec une photo en plein cadre, texte superposé lisible et boutons accessibles ; la dernière photo ajoutée sur master est conservée. Diapositives inactives retirées de la navigation au clavier.
- `/[sport]/compte` : accueil personnalisé, recherche, sports, commande en cours, favoris locaux et articles du catalogue. La connexion et l’inscription mènent ici.
- Accueils publics : salutation après vérification de la session serveur. La réponse privée ne contient que le nom, avec `Cache-Control: private, no-store` et `Vary: Cookie`.
- Livraison : carte sombre pour le livreur, route verte avec halo, prochaine manœuvre, distance restante, durée estimée hors trafic, vitesse et orientation GPS lorsqu’elles sont disponibles. Recentrage, zoom et vue du trajet complet.

## Identité

Accent commun `#22C55E`. Les boutons utilisent du texte sombre pour rester lisibles sur ce vert vif. Les surfaces peuvent utiliser une teinte claire de cette couleur ; les erreurs restent distinctes.

## Règles de navigation

La géométrie et les manœuvres sont lues dans la réponse OSRM (`steps=true`). Les mesures GPS sont projetées sur le trajet pour actualiser la prochaine indication. Les consignes sont masquées si la position date de plus de 30 secondes, si sa précision dépasse 50 mètres, si elle sort du trajet ou si le passage est ambigu. La vitesse n’est jamais simulée. Les requêtes sont espacées de 30 secondes avec interruption après 10 secondes sans réponse. Le calcul s’arrête hors des états de livraison active.

Le service OSRM de démonstration utilisé précédemment reste le fournisseur actuel : sa disponibilité n’est pas garantie et les durées ne tiennent pas compte du trafic. Une instance dédiée ou un fournisseur avec conditions commerciales adaptées est une prochaine amélioration d’exploitation. Documentation : https://project-osrm.org/docs/v5.24.0/api/

## Vérifications

- 75 tests automatisés : panier, paiement, stock, livraison, protection des profils et calcul des indications de navigation.
- TypeScript et ESLint.
- Compilation Next.js avec webpack en mode `compile`. Le build complet avec génération des pages doit être confirmé par le déploiement Vercel.
- Aucun test visuel ou trajet GPS réel validé ici : le navigateur cloud a refusé l’accès au site à cause d’une préférence de sécurité enregistrée. Les tests automatiques ne remplacent pas cette validation.

## Recette sur téléphone

1. Vérifier le hero et la navigation à 320, 390 et 430 pixels, en thèmes clair et sombre.
2. Se connecter comme client ; vérifier le nom, les recherches, les favoris et les commandes de ce compte uniquement.
3. Se connecter comme admin ; ouvrir l’aperçu, filtrer les commandes et modifier un produit.
4. Sur une livraison de test autorisée, démarrer le partage des deux côtés ; vérifier tracé, consignes, vitesse, recentrage et retour après perte réseau.
5. Confirmer l’arrivée puis la remise avec le QR ou le code ; vérifier l’arrêt du suivi.
