/* ===========================================================
   Textes modifiables depuis l'admin (admin.html).
   Les mêmes textes existent en dur dans le HTML : ils servent de
   repli si le JS ne se charge pas, et garantissent le référencement.
   Ce fichier les écrase au chargement via js/config-apply.js.
   =========================================================== */
window.SITE = {
  /* --- identité publique --- */
  businessName: "Le Maillot Idéal",
  siteUrl: "https://le-maillot-ideal.com/",
  shareImage: "images/og-cover.jpg",

  /* --- barre du haut --- */
  topbarInfo: "Commande sur WhatsApp · Modalités confirmées avant expédition",
  topbarHelp: "Besoin d'aide ? Écrivez-nous",

  /* --- accueil : bandeau principal --- */
  heroBadge: "Boutique de maillots au Cameroun",
  heroTitle1: "Porte ta passion.",
  heroTitle2: "Ton maillot idéal t'attend.",
  heroLead:
    "Sélection de maillots de football répliques inspirés des grands championnats et des équipes nationales. Commande sur WhatsApp, paiement selon les modalités confirmées avec vous.",

  /* --- chiffres clés --- */
  statDelay: "Sur WhatsApp",
  statDelayLabel: "Délai confirmé avant commande",
  statRating: "Selon le modèle",
  statRatingLabel: "Tailles à confirmer",

  /* --- coordonnées --- */
  whatsapp: "237655634265",
  whatsappDisplay: "+237 655 634 265",
  email: "contact@le-maillot-ideal.com",
  address: "Douala, Cameroun (adresse exacte communiquée sur WhatsApp)",
  addressLocality: "Douala",
  addressCountry: "CM",
  hours: "Lundi – Samedi, 8h – 19h",
  responseTime: "Réponse pendant les horaires indiqués",
  openingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  openingTime: "08:00",
  closingTime: "19:00",
  areaServed: ["Douala", "Yaoundé", "Cameroun"],
  paymentAccepted: ["Cash", "Mobile Money"],

  /* Passer à true uniquement après validation des prix, stocks et descriptions. */
  catalogDataVerified: false,
  /* Passer à true après validation des délais, frais, paiements et retours. */
  commercialTermsVerified: false,

  /* --- livraison --- */
  freeShippingThreshold: 15000,
  deliveryRows: [
    { zone: "Douala", delay: "24h", cost: "Gratuit dès 15 000 FCFA", payment: "Espèces ou Mobile Money à la réception" },
    { zone: "Yaoundé", delay: "24-48h", cost: "Gratuit dès 15 000 FCFA", payment: "Espèces ou Mobile Money à la réception" },
    {
      zone: "Autres villes (Bafoussam, Garoua, Limbé, Kribi…)",
      delay: "48-72h",
      cost: "À la charge du client (agence de transport, tarif communiqué avant expédition)",
      payment: "Paiement à l'agence ou Mobile Money à l'avance sur demande",
    },
  ],

  /* --- réseaux sociaux (vide = icône masquée) --- */
  instagram: "",
  facebook: "",
  tiktok: "",

  /* --- contenus à publier uniquement après remplacement des démos --- */
  showGallery: false,
  showTestimonials: false,

  /* --- bandeaux « photos de démonstration » : passer à false une fois
         les vraies photos en place --- */
  showDemoNotice: true,
};
