// Copie le site public tel quel dans dist/ (aucune transformation) avant que
// `vite build` construise l'admin React dans dist/admin/ — voir CLAUDE.md §12
// et le plan de réécriture de l'admin. Le site public n'a et n'aura jamais de
// build : ce script se contente de recopier les fichiers déjà statiques.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");

// Tout ce qui n'est pas listé ici (admin-src/, api/, lib/, node_modules/,
// tests/, scripts/, middleware.js, vercel.json, package*.json, la doc
// interne, les archives, .git/, .env*...) reste hors de dist/ — même
// intention que .vercelignore pour l'ancien mode de déploiement passthrough.
const PUBLIC_ENTRIES = [
  "404.html",
  "confidentialite.html",
  "css",
  "fonts",
  "images",
  "index.html",
  "js",
  "merci.html",
  "phototheque.html",
  "product.html",
  "produits",
  "robots.txt",
  "shop.html",
  "sitemap.xml",
];

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

let copied = 0;
for (const entry of PUBLIC_ENTRIES) {
  const from = path.join(root, entry);
  if (!fs.existsSync(from)) continue;
  fs.cpSync(from, path.join(distDir, entry), { recursive: true });
  copied += 1;
}

console.log(`Site public copié dans dist/ (${copied}/${PUBLIC_ENTRIES.length} entrées trouvées).`);
