// Config Vite de l'admin React (voir CLAUDE.md §12). Racine = admin-src/,
// sortie = dist/admin/. Le reste du site public est copié tel quel dans
// dist/ par scripts/copy-public.mjs, sans passer par Vite — voir ce script.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// En dev uniquement (npm run dev:admin) : admin-src/index.html référence
// /css, /js, /images, /fonts en chemins absolus (la page vit sous /admin/ en
// production). Ce plugin sert ces dossiers depuis la racine du dépôt pour
// que `vite dev` se comporte comme la production, sans dupliquer ces
// fichiers dans admin-src/. N'affecte pas `vite build`.
const PASSTHROUGH_DIRS = new Set(["css", "js", "images", "fonts"]);
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

function servePublicAssetsInDev() {
  return {
    name: "serve-public-assets-in-dev",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        const [, top] = url.split("/");
        if (!PASSTHROUGH_DIRS.has(top)) return next();
        const filePath = path.join(repoRoot, decodeURIComponent(url));
        fs.readFile(filePath, (error, data) => {
          if (error) return next();
          res.setHeader("Content-Type", MIME_TYPES[path.extname(filePath)] || "application/octet-stream");
          res.end(data);
        });
      });
    },
  };
}

export default defineConfig({
  root: here,
  base: "/admin/",
  plugins: [react(), servePublicAssetsInDev()],
  build: {
    outDir: path.resolve(repoRoot, "dist/admin"),
    emptyOutDir: true,
  },
});
