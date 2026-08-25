import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const filesIn = (directory, extension) =>
  fs.readdirSync(path.join(root, directory))
    .filter((name) => name.endsWith(extension))
    .map((name) => path.join(root, directory, name));
const filesInRecursive = (directory, extension) => {
  const start = path.join(root, directory);
  const files = [];
  const ignoredDirectories = new Set([".git", "node_modules", "reports", "admin-src", "dist"]);
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) visit(target);
      else if (entry.name.endsWith(extension)) files.push(target);
    }
  };
  visit(start);
  return files;
};

function loadGlobals(...relativePaths) {
  const context = vm.createContext({ window: {} });
  relativePaths.forEach((relativePath) => {
    vm.runInContext(read(relativePath), context, { filename: relativePath });
  });
  return context.window;
}

test("tous les fichiers JavaScript ont une syntaxe valide", () => {
  for (const file of filesIn("js", ".js")) {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  }
});

test("le catalogue et ses ressources sont cohérents", () => {
  const { PRODUCTS, LEAGUES, GALLERY, TESTIMONIALS } = loadGlobals(
    "js/data.js",
    "js/site-config.js",
  );

  assert.equal(PRODUCTS.length, 76);
  assert.equal(Object.keys(LEAGUES).length, 6);
  assert.ok(Array.isArray(GALLERY));
  assert.ok(Array.isArray(TESTIMONIALS), "TESTIMONIALS doit vivre dans data.js");
  assert.equal(new Set(PRODUCTS.map((product) => product.id)).size, PRODUCTS.length);
  assert.equal(new Set(PRODUCTS.map((product) => product.slug)).size, PRODUCTS.length);
  assert.equal(new Set(GALLERY.map((photo) => photo.src)).size, GALLERY.length);

  for (const product of PRODUCTS) {
    assert.ok(product.slug && product.name && product.team && product.league);
    assert.match(product.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(Array.isArray(product.sizes) && product.sizes.length > 0);
    assert.ok(Number.isInteger(product.price) && product.price > 0);
    assert.ok(Number.isInteger(product.priceOriginal) && product.priceOriginal >= product.price);
    assert.ok(Number.isInteger(product.stock) && product.stock >= 0);
    assert.equal(
      product.discountPct,
      product.priceOriginal > product.price
        ? Math.round((1 - product.price / product.priceOriginal) * 100)
        : 0,
      `Remise incohérente pour ${product.slug}`,
    );
    for (const asset of [product.image, product.imageSvg, product.imageWide]) {
      assert.ok(fs.existsSync(path.join(root, asset)), `Ressource absente : ${asset}`);
    }
  }

  for (const photo of GALLERY) {
    assert.ok(fs.existsSync(path.join(root, photo.src)), `Ressource absente : ${photo.src}`);
    assert.ok(fs.existsSync(path.join(root, photo.thumb)), `Ressource absente : ${photo.thumb}`);
  }
});

test("le sitemap couvre exactement les contenus publics indexables", () => {
  const { PRODUCTS, GALLERY, TESTIMONIALS, SITE } = loadGlobals("js/data.js", "js/site-config.js");
  const sitemap = read("sitemap.xml");
  const sitemapSlugs = [...sitemap.matchAll(/produits\/([^<]+)\.html/g)].map((match) => match[1]);
  const expectedSlugs = Array.from(PRODUCTS, (product) => product.slug).sort();
  assert.deepEqual(sitemapSlugs.sort(), expectedSlugs);
  assert.doesNotMatch(sitemap, /shop\.html\?league=/, "les filtres canonisés ne doivent pas être soumis");
  const photoIndexable =
    (SITE.showGallery === true && GALLERY.length > 0) ||
    (SITE.showTestimonials === true && TESTIMONIALS.length > 0);
  assert.equal(sitemap.includes(`${SITE.siteUrl}phototheque.html`), photoIndexable);
  assert.match(
    read("phototheque.html"),
    new RegExp(`<meta name="robots" content="${photoIndexable ? "index,follow,max-image-preview:large" : "noindex,follow"}">`),
  );
  const generator = read("lib/generate-site.mjs");
  assert.match(generator, /SITE\.showGallery === true && Array\.isArray\(GALLERY\) && GALLERY\.length > 0/);
  assert.match(generator, /SITE\.showTestimonials === true && Array\.isArray\(TESTIMONIALS\) && TESTIMONIALS\.length > 0/);
});

test("la boutique expose une fiche statique pour chaque produit sans JavaScript", () => {
  const { PRODUCTS } = loadGlobals("js/data.js");
  const links = [...read("shop.html").matchAll(/<a href="produits\/([^"/]+)\.html">/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(links, Array.from(PRODUCTS, (product) => product.slug).sort());
});

test("une fiche HTML indexable est générée pour chaque produit", () => {
  const { PRODUCTS, SITE } = loadGlobals("js/data.js", "js/site-config.js");
  const pages = filesIn("produits", ".html");
  assert.equal(pages.length, PRODUCTS.length);

  for (const product of PRODUCTS) {
    const html = read(`produits/${product.slug}.html`);
    assert.match(html, new RegExp(`data-product-slug=["']${product.slug}["']`));
    assert.match(html, /<base href="\.\.\/">/);
    assert.match(html, new RegExp(`href=["']produits/${product.slug}\\.html#main["']`));
    assert.match(html, /<h1 class="pd-title">/);
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITE.siteUrl}produits/${product.slug}\\.html">`));
    assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large">/);
    assert.match(html, /data-static-ld="breadcrumb"/);
    if (SITE.catalogDataVerified === true) {
      assert.match(html, /data-static-ld="product"/);
      assert.match(html, /"offers":/);
    } else {
      assert.doesNotMatch(html, /data-static-ld="product"/);
      assert.match(html, /Caractéristiques, prix, tailles et disponibilité à confirmer sur WhatsApp\./);
      assert.doesNotMatch(html, /class="price-old"/);
    }
  }
});

test("les pages ne chargent aucune dépendance distante", () => {
  for (const file of filesInRecursive(".", ".html")) {
    const html = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(html, /<script[^>]+src=["']https?:\/\//i, path.basename(file));
    assert.doesNotMatch(html, /<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:\/\//i, path.basename(file));
  }
});

test("les références locales des pages HTML existent", () => {
  for (const file of filesInRecursive(".", ".html")) {
    const html = fs.readFileSync(file, "utf8");
    const baseHref = html.match(/<base\s+href=["']([^"']+)["']/i)?.[1] || "";
    const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
    for (const ref of refs) {
      if (/^(?:https?:|mailto:|tel:|data:|blob:|#)/i.test(ref)) continue;
      const clean = ref.split(/[?#]/, 1)[0];
      if (!clean) continue;
      const target = path.resolve(path.dirname(file), baseHref, clean);
      assert.ok(fs.existsSync(target), `${path.basename(file)} référence un fichier absent : ${ref}`);
    }
  }
});

test("les contenus fictifs ne sont plus présentés comme des preuves réelles", () => {
  const publicFiles = [
    ...filesInRecursive(".", ".html").filter((file) => path.basename(file) !== "admin.html"),
    ...filesIn("js", ".js"),
  ];
  const source = publicFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /plus de 500 clients/i);
  assert.doesNotMatch(source, /avis (?:clients )?vérifiés/i);
  assert.doesNotMatch(source, /maillots? de football officiels/i);
});

test("l'administration exporte les témoignages", () => {
  const admin = read("js/admin.js");
  assert.match(admin, /window\.TESTIMONIALS\s*=/);
  assert.match(admin, /el\.checkValidity\(\)/);
  assert.match(admin, /Number\.isInteger\((?:Number\(p\.stock\)|stock)\)/);
  const html = read("admin.html");
  assert.match(html, /data-site="showGallery"/);
  assert.match(html, /data-site="showTestimonials"/);
});

test("les règles Apache protègent les outils locaux et évitent un cache CSS périmé", () => {
  const apache = read(".htaccess");
  assert.match(apache, /RewriteRule \^\(\?:node_modules\|scripts\|tests\)/);
  assert.match(apache, /RewriteRule \^\\\.\(\?:git\|codex\|agents\)/);
  assert.match(apache, /RewriteCond %\{THE_REQUEST\} .*index\\\.html/);
  assert.match(apache, /admin\\\.html/);
  assert.match(apache, /<FilesMatch "\\\.\(\?:html\|css\|js\|json\|xml\)\$">/);
});
