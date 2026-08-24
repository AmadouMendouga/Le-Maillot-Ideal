import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { generateSite } from "../lib/generate-site.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "produits");
const checkOnly = process.argv.includes("--check");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function loadGlobals(...relativePaths) {
  const context = vm.createContext({ window: {} });
  for (const relativePath of relativePaths) {
    vm.runInContext(read(relativePath), context, { filename: relativePath });
  }
  return context.window;
}

const { PRODUCTS, SITE, GALLERY, TESTIMONIALS } = loadGlobals("js/data.js", "js/site-config.js");

const { produits: generated, shopHtml: generatedShop, photothequeHtml: generatedPhototheque, sitemapXml: sitemap, files: synchronizedPublicPages } =
  generateSite({
    PRODUCTS,
    SITE,
    GALLERY,
    TESTIMONIALS,
    templates: {
      product: read("product.html"),
      shop: read("shop.html"),
      phototheque: read("phototheque.html"),
      index: read("index.html"),
      merci: read("merci.html"),
      confidentialite: read("confidentialite.html"),
      notFound: read("404.html"),
    },
  });

if (checkOnly) {
  let invalid = false;
  const existing = fs.existsSync(outputDirectory)
    ? fs.readdirSync(outputDirectory).filter((name) => name.endsWith(".html"))
    : [];
  for (const [name, content] of generated) {
    const target = path.join(outputDirectory, name);
    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== content) {
      console.error(`Page produit à régénérer : produits/${name}`);
      invalid = true;
    }
  }
  for (const name of existing) {
    if (!generated.has(name)) {
      console.error(`Page produit obsolète : produits/${name}`);
      invalid = true;
    }
  }
  if (!fs.existsSync(path.join(root, "sitemap.xml")) || read("sitemap.xml") !== sitemap) {
    console.error("Sitemap à régénérer");
    invalid = true;
  }
  if (read("shop.html") !== generatedShop) {
    console.error("Liens produit statiques de shop.html à régénérer");
    invalid = true;
  }
  if (read("phototheque.html") !== generatedPhototheque) {
    console.error("Indexation de phototheque.html à régénérer");
    invalid = true;
  }
  for (const [name, content] of synchronizedPublicPages) {
    if (read(name) !== content) {
      console.error(`Repli HTML configurable à régénérer : ${name}`);
      invalid = true;
    }
  }
  if (invalid) process.exitCode = 1;
  else console.log(`${generated.size} pages produit et sitemap à jour.`);
} else {
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const name of fs.readdirSync(outputDirectory).filter((entry) => entry.endsWith(".html"))) {
    if (!generated.has(name)) fs.unlinkSync(path.join(outputDirectory, name));
  }
  for (const [name, content] of generated) {
    fs.writeFileSync(path.join(outputDirectory, name), content);
  }
  fs.writeFileSync(path.join(root, "shop.html"), generatedShop);
  fs.writeFileSync(path.join(root, "phototheque.html"), generatedPhototheque);
  for (const [name, content] of synchronizedPublicPages) {
    fs.writeFileSync(path.join(root, name), content);
  }
  fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap);
  console.log(`${generated.size} pages produit générées.`);
}
