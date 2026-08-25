// Redimensionnement d'image côté navigateur (canvas), sans dépendance —
// porté depuis js/admin.js. Nécessite un DOM (Image, FileReader, canvas) :
// non testable par le test runner Node, voir tests/admin-lib.test.mjs pour
// ce qui l'est (validation.js, exportBuilders.js, zip.js).

export function reportImageError(error, file) {
  const name = file && file.name ? ` « ${file.name} »` : "";
  const detail = error && error.message ? "\n" + error.message : "";
  console.error("Impossible de traiter l'image" + name, error);
  alert(
    "Impossible de traiter l'image" + name + "." + detail +
      "\nEssayez un fichier JPEG, PNG ou WebP valide.",
  );
}

export function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error("Aucun fichier n'a été sélectionné.")); return; }
    if (!file.type || file.type.indexOf("image/") !== 0) {
      reject(new Error("Le fichier sélectionné n'est pas une image reconnue."));
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight) {
          reject(new Error("L'image ne contient aucune dimension exploitable."));
          return;
        }
        resolve(img);
      };
      img.onerror = () => reject(new Error("Le navigateur ne parvient pas à décoder cette image."));
      img.src = fr.result;
    };
    fr.onerror = () => reject(new Error("Le fichier n'a pas pu être lu."));
    fr.onabort = () => reject(new Error("La lecture du fichier a été interrompue."));
    try { fr.readAsDataURL(file); }
    catch (e) { reject(e); }
  });
}

export function canvasDataUrl(canvas, quality) {
  const out = canvas.toDataURL("image/jpeg", quality);
  if (!out || out === "data:,") throw new Error("La conversion de l'image a échoué.");
  return out;
}

// Carré rogné au centre — origine verticale volontairement biaisée vers le
// haut (`* 0.8`) pour garder torses/visages dans le cadre. Ne pas arrondir.
export function toSquare(img, size, quality) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Le traitement d'image n'est pas disponible dans ce navigateur.");
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const s = Math.min(w, h);
  ctx.drawImage(img, (w - s) / 2, ((h - s) / 2) * 0.8, s, s, 0, 0, size, size);
  return canvasDataUrl(c, quality);
}

// Redimensionné en gardant les proportions, jamais agrandi au-delà de l'original.
export function toWide(img, maxW, quality) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const r = Math.min(1, maxW / w);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * r));
  c.height = Math.max(1, Math.round(h * r));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Le traitement d'image n'est pas disponible dans ce navigateur.");
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return canvasDataUrl(c, quality);
}
