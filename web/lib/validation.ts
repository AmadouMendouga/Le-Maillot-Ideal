// Règles de validation — portées depuis admin-src/src/lib/validation.js (elle-même
// portée depuis l'ancien js/admin.js). Utilisées à la fois côté client (retour
// instantané dans les formulaires admin) et dans les Server Actions (rempart final,
// seul endroit qui fasse réellement autorité — voir CLAUDE.md §12 et le plan §3).
import type { Product, SiteSettings, Testimonial, GalleryItem } from "@/lib/types";

const SOCIAL_FIELDS = ["instagram", "facebook", "tiktok"] as const;

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname;
  } catch {
    return false;
  }
}

// Règles métier spécifiques à ces champs (numéro WhatsApp, cohérence avec son
// affichage, URLs réseaux sociaux) — le reste des champs est validé par la
// contrainte HTML native de l'input lui-même.
export function siteFieldError(key: string, value: unknown, site: Partial<SiteSettings>): string {
  const raw = String(value == null ? "" : value);
  const text = raw.trim();
  if (key === "whatsapp" && (raw !== text || !/^[1-9]\d{7,14}$/.test(text))) {
    return "Le numéro WhatsApp doit contenir 8 à 15 chiffres au format international, sans +.";
  }
  if (key === "whatsappDisplay") {
    const expected = String(site.whatsapp || "").replace(/\D/g, "");
    const displayed = text.replace(/\D/g, "");
    if (!displayed || displayed !== expected) {
      return "Le numéro affiché doit contenir les mêmes chiffres que le numéro WhatsApp.";
    }
  }
  if ((SOCIAL_FIELDS as readonly string[]).includes(key) && text && (raw !== text || !isHttpUrl(text))) {
    return "L'URL doit commencer par http:// ou https:// et être valide.";
  }
  return "";
}

// Règles croisées "afficher X ⇒ X doit avoir du contenu réel et complet".
export function crossFieldSiteErrors({
  site,
  testimonials,
  gallery,
}: {
  site: Partial<SiteSettings>;
  testimonials: Pick<Testimonial, "name" | "quote" | "photoUrl">[];
  gallery: Pick<GalleryItem, "src">[];
}): { field: string; message: string } | null {
  const list = testimonials || [];
  const incompleteTestimonial = list.find(
    (item) => !String(item.name || "").trim() || !String(item.quote || "").trim() || !String(item.photoUrl || "").trim()
  );
  if (site.showTestimonials === true && (list.length === 0 || incompleteTestimonial)) {
    return {
      field: "showTestimonials",
      message:
        list.length === 0
          ? "Ajoutez au moins un avis réel avant d'afficher les témoignages."
          : "Complétez le nom, le texte et l'image de chaque avis avant de les afficher.",
    };
  }
  if (site.showGallery === true && (gallery || []).length === 0) {
    return { field: "showGallery", message: "Ajoutez au moins une photo avant d'afficher la photothèque." };
  }
  return null;
}

// Mute site.deliveryRows en place : garde le texte "Gratuit dès X FCFA" synchronisé
// avec le seuil numérique.
export function syncDeliveryThreshold(site: SiteSettings): void {
  const threshold = Number(site.freeShippingThreshold);
  if (!Number.isFinite(threshold) || threshold < 0 || !Array.isArray(site.deliveryRows)) return;
  const formatted = Math.round(threshold).toLocaleString("fr-FR") + " FCFA";
  site.deliveryRows.forEach((row) => {
    if (row && /^\s*Gratuit\s+dès\b/i.test(String(row.cost || ""))) row.cost = "Gratuit dès " + formatted;
  });
}

export interface ProductPatch {
  name: string;
  team: string;
  kit: Product["kit"];
  price: number;
  priceOriginal: number;
  stock: number;
  season: string;
  description: string;
  sizes: string[];
  kidsAvailable: boolean;
  isNew: boolean;
}

// Rempart final côté serveur — reprend les contrôles de ProductEditDrawer
// (admin-src), qui n'existaient jusqu'ici que côté client.
export function productPatchError(patch: ProductPatch): string | null {
  if (!Number.isInteger(patch.price) || patch.price <= 0) {
    return "Le prix de vente doit être un entier supérieur à 0 FCFA.";
  }
  if (!Number.isInteger(patch.priceOriginal) || patch.priceOriginal < patch.price) {
    return "Le prix barré doit être un entier supérieur ou égal au prix de vente.";
  }
  if (!Number.isInteger(patch.stock) || patch.stock < 0) {
    return "Le stock doit être un entier positif ou nul.";
  }
  if (!String(patch.name || "").trim()) return "Le nom affiché est obligatoire.";
  if (!String(patch.description || "").trim()) return "La description est obligatoire.";
  if (!Array.isArray(patch.sizes) || patch.sizes.length === 0) {
    return "Sélectionnez au moins une taille disponible.";
  }
  return null;
}
