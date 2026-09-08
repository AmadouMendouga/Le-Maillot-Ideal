// Génération du site statique : c'est la charge CPU la plus lourde du dépôt
// (76 fiches produit + 7 gabarits passés au crible d'une vingtaine
// d'expressions régulières chacun). Exécutée à chaque `npm run build` et à
// chaque publication depuis l'administration (api/publish.js).
import { Bench } from "tinybench";
import { withCodSpeed } from "@codspeed/tinybench-plugin";

import { buildConfigJs, buildDataJs, generateSite } from "../lib/generate-site.mjs";
import {
  GALLERY,
  LEAGUES,
  PRODUCTS,
  SITE,
  TESTIMONIALS,
  TESTIMONIALS_SAMPLE,
  VERIFIED_SITE,
  templates,
} from "./fixtures.mjs";

const bench = withCodSpeed(new Bench({ time: 200 }));

bench
  .add("generateSite - catalogue publié (76 fiches, données non vérifiées)", () => {
    generateSite({ PRODUCTS, SITE, GALLERY, TESTIMONIALS, templates });
  })
  .add("generateSite - catalogue vérifié avec galerie et avis", () => {
    generateSite({
      PRODUCTS,
      SITE: VERIFIED_SITE,
      GALLERY,
      TESTIMONIALS: TESTIMONIALS_SAMPLE,
      templates,
    });
  })
  .add("generateSite - une seule fiche produit", () => {
    generateSite({ PRODUCTS: PRODUCTS.slice(0, 1), SITE, GALLERY, TESTIMONIALS, templates });
  })
  .add("buildDataJs - sérialisation du catalogue", () => {
    buildDataJs({ PRODUCTS, LEAGUES, GALLERY, TESTIMONIALS });
  })
  .add("buildConfigJs - sérialisation des textes du site", () => {
    buildConfigJs(SITE);
  });

await bench.run();
console.table(bench.table());
