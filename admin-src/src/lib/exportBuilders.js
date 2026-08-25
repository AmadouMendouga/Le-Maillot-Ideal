// Génère data.js/site-config.js pour le repli "export manuel" (voir
// CLAUDE.md §12). Porté depuis js/admin.js. Doit produire une forme
// identique aux fonctions de même nom côté serveur (lib/generate-site.mjs,
// utilisées par api/publish.js) : les deux copies — repli manuel ici,
// publication en un clic côté serveur — sont interchangeables.
import { syncDeliveryThreshold } from "./validation.js";

export function buildDataJs({ products, leagues, gallery, testimonials }) {
  return "// Données du site — exporté depuis la console d'administration le " + new Date().toLocaleString("fr-FR") + "\n" +
    "window.PRODUCTS = " + JSON.stringify(products, null, 2) + ";\n\n" +
    "window.LEAGUES = " + JSON.stringify(leagues, null, 2) + ";\n\n" +
    "window.GALLERY = " + JSON.stringify(gallery, null, 2) + ";\n\n" +
    "window.TESTIMONIALS = " + JSON.stringify(testimonials, null, 2) + ";\n";
}

export function buildConfigJs(site) {
  syncDeliveryThreshold(site);
  return "/* Textes du site — exporté depuis la console d'administration le " + new Date().toLocaleString("fr-FR") + " */\n" +
    "window.SITE = " + JSON.stringify(site, null, 2) + ";\n";
}
