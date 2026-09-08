// Logique pure de la console d'administration (admin-src/src/lib) : validation
// du catalogue avant publication, génération des fichiers d'export et
// fabrication du ZIP de sauvegarde — le seul endroit du dépôt qui manipule des
// octets en masse (CRC32 sur les photos du brouillon).
import { Bench } from "tinybench";
import { withCodSpeed } from "@codspeed/tinybench-plugin";

import {
  crossFieldSiteErrors,
  productsAreValid,
  siteFieldError,
  syncDeliveryThreshold,
} from "../admin-src/src/lib/validation.js";
import { buildConfigJs, buildDataJs } from "../admin-src/src/lib/exportBuilders.js";
import { crc32, makeZip } from "../admin-src/src/lib/zip.js";
import { GALLERY, LEAGUES, PRODUCTS, SITE, TESTIMONIALS_SAMPLE } from "./fixtures.mjs";

const SITE_TEXT_FIELDS = Object.entries(SITE)
  .filter(([, value]) => typeof value === "string" || typeof value === "number")
  .map(([key, value]) => [key, value]);

// buildConfigJs mute son argument (syncDeliveryThreshold) : on travaille sur
// une copie stable, l'opération étant idempotente.
const siteCopy = structuredClone(SITE);

// Deux « photos » de 256 Kio : l'ordre de grandeur d'un JPEG recompressé par
// l'administration avant d'entrer dans le ZIP de sauvegarde.
const imageBytes = new Uint8Array(256 * 1024);
for (let index = 0; index < imageBytes.length; index += 1) imageBytes[index] = (index * 31 + 7) & 0xff;
const zipFiles = [
  { name: "images/photos/photo-01.jpg", bytes: imageBytes },
  { name: "images/photos/photo-02.jpg", bytes: imageBytes.slice().reverse() },
  { name: "js/data.js", bytes: new TextEncoder().encode(buildDataJs({ products: PRODUCTS, leagues: LEAGUES, gallery: GALLERY, testimonials: [] })) },
];

const bench = withCodSpeed(new Bench({ time: 200 }));

bench
  .add("productsAreValid - 76 produits du catalogue", () => {
    productsAreValid(PRODUCTS);
  })
  .add("siteFieldError - tous les champs texte du site", () => {
    for (const [key, value] of SITE_TEXT_FIELDS) siteFieldError(key, value, SITE);
  })
  .add("crossFieldSiteErrors - galerie et avis complets", () => {
    crossFieldSiteErrors({
      site: { showGallery: true, showTestimonials: true },
      testimonials: TESTIMONIALS_SAMPLE,
      gallery: GALLERY,
    });
  })
  .add("syncDeliveryThreshold - lignes de livraison", () => {
    syncDeliveryThreshold(siteCopy);
  })
  .add("buildDataJs - export manuel du catalogue", () => {
    buildDataJs({ products: PRODUCTS, leagues: LEAGUES, gallery: GALLERY, testimonials: TESTIMONIALS_SAMPLE });
  })
  .add("buildConfigJs - export manuel des textes", () => {
    buildConfigJs(siteCopy);
  })
  .add("crc32 - image de 256 Kio", () => {
    crc32(imageBytes);
  })
  .add("makeZip - archive de sauvegarde", () => {
    makeZip(zipFiles);
  });

await bench.run();
console.table(bench.table());
