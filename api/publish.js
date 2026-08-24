// Publie le brouillon de l'admin directement sur le dépôt GitHub : régénère
// tout côté serveur (mêmes fonctions que scripts/generate-product-pages.mjs,
// via lib/generate-site.mjs) puis commite en un seul commit atomique via
// l'API Git de GitHub. Le push déclenche le redéploiement Vercel déjà
// connecté au dépôt — le client n'a rien d'autre à faire.
//
// Accès protégé en amont par middleware.js (authentification basique,
// identifiants en variable d'environnement, jamais dans ce code).
import { generateSite, buildDataJs, buildConfigJs } from "../lib/generate-site.mjs";

const OWNER = "AmadouMendouga";
const REPO = "Le-Maillot-Ideal";
const BRANCH = "master";
const API = "https://api.github.com";
const MAX_IMAGES_BYTES = 4 * 1024 * 1024; // filet de sécurité sous la limite de requête de Vercel (~4,5 Mo)

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function gh(token, path, init) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "le-maillot-ideal-admin",
      ...(init && init.headers),
    },
  }).then(async (res) => {
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new HttpError(502, `GitHub (${res.status} sur ${path}) : ${(data && data.message) || res.statusText}`);
    }
    return data;
  });
}

function assertValidProducts(products) {
  if (!Array.isArray(products) || !products.length) throw new HttpError(400, "Aucun produit reçu.");
  for (const p of products) {
    const label = (p && (p.name || p.slug)) || "produit";
    if (!p || typeof p !== "object") throw new HttpError(400, "Produit invalide.");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(p.slug || ""))) throw new HttpError(400, `Identifiant (slug) invalide pour ${label}.`);
    if (!Number.isInteger(p.price) || p.price <= 0) throw new HttpError(400, `Prix invalide pour ${label}.`);
    if (!Number.isInteger(p.priceOriginal) || p.priceOriginal < p.price) throw new HttpError(400, `Prix barré invalide pour ${label}.`);
    if (!Number.isInteger(p.stock) || p.stock < 0) throw new HttpError(400, `Stock invalide pour ${label}.`);
    if (!String(p.name || "").trim()) throw new HttpError(400, `Nom manquant pour ${label}.`);
    if (!String(p.description || "").trim()) throw new HttpError(400, `Description manquante pour ${label}.`);
    if (!Array.isArray(p.sizes) || !p.sizes.length) throw new HttpError(400, `Aucune taille sélectionnée pour ${label}.`);
  }
  const slugs = new Set(products.map((p) => p.slug));
  if (slugs.size !== products.length) throw new HttpError(400, "Deux produits partagent le même identifiant (slug).");
}

function assertValidSite(site) {
  if (!site || typeof site !== "object") throw new HttpError(400, "Configuration du site invalide.");
  if (!/^[1-9]\d{7,14}$/.test(String(site.whatsapp || "").trim())) {
    throw new HttpError(400, "Le numéro WhatsApp du site est invalide.");
  }
}

async function fetchTemplate(token, path) {
  const data = await gh(token, `/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
  return Buffer.from(data.content, "base64").toString("utf8");
}

export async function POST(request) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new HttpError(500, "GITHUB_TOKEN n'est pas configuré sur Vercel.");

    const body = await request.json();
    const products = body.products;
    const leagues = body.leagues || {};
    const gallery = Array.isArray(body.gallery) ? body.gallery : [];
    const testimonials = Array.isArray(body.testimonials) ? body.testimonials : [];
    const site = body.site;
    const newImages = body.newImages && typeof body.newImages === "object" ? body.newImages : {};

    assertValidProducts(products);
    assertValidSite(site);

    const imageBytes = Object.values(newImages).reduce((total, dataUrl) => total + String(dataUrl || "").length * 0.75, 0);
    if (imageBytes > MAX_IMAGES_BYTES) {
      throw new HttpError(413, "Trop d'images modifiées à la fois pour une seule publication. Publiez en plusieurs fois.");
    }

    // --- état actuel du dépôt ---
    const ref = await gh(token, `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
    const baseCommitSha = ref.object.sha;
    const baseCommit = await gh(token, `/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`);
    const baseTreeSha = baseCommit.tree.sha;
    const fullTree = await gh(token, `/repos/${OWNER}/${REPO}/git/trees/${baseTreeSha}?recursive=1`);
    const existingProductPages = new Set(
      fullTree.tree.filter((entry) => entry.type === "blob" && /^produits\/[^/]+\.html$/.test(entry.path)).map((entry) => entry.path),
    );

    const [productTpl, shopTpl, photothequeTpl, indexTpl, merciTpl, confidentialiteTpl, notFoundTpl] = await Promise.all(
      ["product.html", "shop.html", "phototheque.html", "index.html", "merci.html", "confidentialite.html", "404.html"].map(
        (path) => fetchTemplate(token, path),
      ),
    );

    // --- régénération (même logique que scripts/generate-product-pages.mjs) ---
    const generated = generateSite({
      PRODUCTS: products,
      SITE: site,
      GALLERY: gallery,
      TESTIMONIALS: testimonials,
      templates: {
        product: productTpl,
        shop: shopTpl,
        phototheque: photothequeTpl,
        index: indexTpl,
        merci: merciTpl,
        confidentialite: confidentialiteTpl,
        notFound: notFoundTpl,
      },
    });

    const treeEntries = [];
    for (const [name, content] of generated.produits) {
      treeEntries.push({ path: `produits/${name}`, mode: "100644", type: "blob", content });
    }
    for (const path of existingProductPages) {
      if (!generated.produits.has(path.slice("produits/".length))) {
        treeEntries.push({ path, mode: "100644", type: "blob", sha: null });
      }
    }
    for (const [name, content] of generated.files) {
      treeEntries.push({ path: name, mode: "100644", type: "blob", content });
    }
    treeEntries.push({ path: "shop.html", mode: "100644", type: "blob", content: generated.shopHtml });
    treeEntries.push({ path: "phototheque.html", mode: "100644", type: "blob", content: generated.photothequeHtml });
    treeEntries.push({ path: "sitemap.xml", mode: "100644", type: "blob", content: generated.sitemapXml });
    treeEntries.push({ path: "js/data.js", mode: "100644", type: "blob", content: buildDataJs({ PRODUCTS: products, LEAGUES: leagues, GALLERY: gallery, TESTIMONIALS: testimonials }) });
    treeEntries.push({ path: "js/site-config.js", mode: "100644", type: "blob", content: buildConfigJs(site) });

    for (const [path, dataUrl] of Object.entries(newImages)) {
      const comma = String(dataUrl).indexOf(",");
      if (comma < 0) throw new HttpError(400, `Image illisible : ${path}.`);
      const blob = await gh(token, `/repos/${OWNER}/${REPO}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: dataUrl.slice(comma + 1), encoding: "base64" }),
      });
      treeEntries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
    }

    // --- commit atomique ---
    const newTree = await gh(token, `/repos/${OWNER}/${REPO}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
    });

    const identity = {
      name: "Administration Le Maillot Idéal",
      email: /.+@.+\..+/.test(String(site.email || "")) ? site.email : "admin@le-maillot-ideal.com",
      date: new Date().toISOString(),
    };
    const newCommit = await gh(token, `/repos/${OWNER}/${REPO}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: `Publication depuis l'admin — ${new Date().toLocaleString("fr-FR")}`,
        tree: newTree.sha,
        parents: [baseCommitSha],
        author: identity,
        committer: identity,
      }),
    });

    await gh(token, `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    return Response.json({
      ok: true,
      commitSha: newCommit.sha,
      commitUrl: `https://github.com/${OWNER}/${REPO}/commit/${newCommit.sha}`,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return Response.json({ ok: false, error: error.message || "Erreur inconnue." }, { status });
  }
}
