// Règles de validation — portées depuis js/admin.js, rendues pures (prennent
// leurs données en paramètre plutôt que de fermer sur le `state` vanilla ou
// le DOM). Les contrôles HTML natifs génériques (required, type=email,
// type=url, pattern, min, step) restent portés par les vrais <input> React
// du formulaire "Textes du site" (Phase 4d) et leur checkValidity() natif —
// ils n'ont pas leur place ici, ce ne sont pas des règles métier.

const SOCIAL_FIELDS = ["instagram", "facebook", "tiktok"];

export function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname;
  } catch {
    return false;
  }
}

// Règles métier spécifiques à ces 3 champs (numéro WhatsApp, cohérence avec
// son affichage, URLs réseaux sociaux) — le reste des champs [data-site] est
// validé par la contrainte HTML native de l'input lui-même.
export function siteFieldError(key, value, site) {
  const raw = String(value == null ? "" : value);
  const text = raw.trim();
  if (key === "whatsapp" && (raw !== text || !/^[1-9]\d{7,14}$/.test(text))) {
    return "Le numéro WhatsApp doit contenir 8 à 15 chiffres au format international, sans +.";
  }
  if (key === "whatsappDisplay") {
    const expected = String((site && site.whatsapp) || "").replace(/\D/g, "");
    const displayed = text.replace(/\D/g, "");
    if (!displayed || displayed !== expected) {
      return "Le numéro affiché doit contenir les mêmes chiffres que le numéro WhatsApp.";
    }
  }
  if (SOCIAL_FIELDS.includes(key) && text && (raw !== text || !isHttpUrl(text))) {
    return "L'URL doit commencer par http:// ou https:// et être valide.";
  }
  return "";
}

// Retourne le premier produit invalide, ou null si tous sont valides.
export function productsAreValid(products) {
  return (
    (products || []).find((p) => (
      !Number.isInteger(Number(p.price)) || Number(p.price) <= 0 ||
      !Number.isInteger(Number(p.priceOriginal)) || Number(p.priceOriginal) < Number(p.price) ||
      !Number.isInteger(Number(p.stock)) || Number(p.stock) < 0 ||
      !String(p.name || "").trim() || !String(p.description || "").trim() ||
      !Array.isArray(p.sizes) || p.sizes.length === 0
    )) || null
  );
}

// Règles croisées "afficher X ⇒ X doit avoir du contenu réel et complet".
// Retourne { field, message } ou null si tout est cohérent.
export function crossFieldSiteErrors({ site, testimonials, gallery }) {
  const list = testimonials || [];
  const incompleteTestimonial = list.find((item) => (
    !String(item.name || "").trim() || !String(item.quote || "").trim() || !String(item.src || "").trim()
  ));
  if (site.showTestimonials === true && (list.length === 0 || incompleteTestimonial)) {
    return {
      field: "showTestimonials",
      message: list.length === 0
        ? "Ajoutez au moins un avis réel avant d'afficher les témoignages."
        : "Complétez le nom, le texte et l'image de chaque avis avant de les afficher.",
    };
  }
  if (site.showGallery === true && (gallery || []).length === 0) {
    return { field: "showGallery", message: "Ajoutez au moins une photo avant d'afficher la photothèque." };
  }
  return null;
}

// Mute site.deliveryRows en place (même comportement que l'original) : garde
// le texte "Gratuit dès X FCFA" synchronisé avec le seuil numérique.
export function syncDeliveryThreshold(site) {
  const threshold = Number(site.freeShippingThreshold);
  if (!Number.isFinite(threshold) || threshold < 0 || !Array.isArray(site.deliveryRows)) return;
  const formatted = Math.round(threshold).toLocaleString("fr-FR") + " FCFA";
  site.deliveryRows.forEach((row) => {
    if (row && /^\s*Gratuit\s+dès\b/i.test(String(row.cost || ""))) row.cost = "Gratuit dès " + formatted;
  });
}
