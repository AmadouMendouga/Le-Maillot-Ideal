// Porté depuis la section PHOTOTHÈQUE de js/admin.js.
import { useRef } from "react";
import { useDraftState } from "../../state/useDraftState.jsx";
import { readImage, reportImageError, toSquare, toWide } from "../../lib/image.js";
import { resolveImageSrc } from "../../lib/resolveImage.js";

function nextGalleryIndex(gallery) {
  let max = 0;
  gallery.forEach((g) => {
    const m = /gallery-(\d+)\./.exec(g.src || "");
    if (m) max = Math.max(max, Number(m[1]));
  });
  return max + 1;
}

export default function GalleryTab({ active }) {
  const { state, dispatch } = useDraftState();
  const addInputRef = useRef(null);
  const swapInputRef = useRef(null);
  const swapIndexRef = useRef(null);
  const resolveImage = (path) => resolveImageSrc(state.newImages, path);

  function move(index, direction) {
    dispatch({ type: "GALLERY_MOVE", index, direction });
  }
  function remove(index) {
    if (!confirm("Retirer cette photo de la photothèque ?")) return;
    dispatch({ type: "GALLERY_DELETE", index });
  }
  function startAdd() {
    if (!addInputRef.current) return;
    addInputRef.current.value = "";
    addInputRef.current.click();
  }
  function startSwap(index) {
    swapIndexRef.current = index;
    if (!swapInputRef.current) return;
    swapInputRef.current.value = "";
    swapInputRef.current.click();
  }

  // Traitement séquentiel (pas Promise.all) : nextGalleryIndex() doit
  // incrémenter correctement à travers plusieurs fichiers d'un même lot.
  async function handleAddFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    let n = nextGalleryIndex(state.gallery);
    const items = [];
    const newImages = {};
    const failed = [];
    for (const file of files) {
      try {
        const img = await readImage(file);
        const id = String(n).padStart(2, "0");
        n += 1;
        const thumb = "images/photos/photo-" + id + ".jpg";
        const wide = "images/gallery/gallery-" + id + ".jpg";
        newImages[thumb] = toSquare(img, 600, 0.82);
        newImages[wide] = toWide(img, 1400, 0.8);
        items.push({ src: wide, thumb });
      } catch (error) {
        console.error("Impossible de traiter l'image « " + file.name + " »", error);
        failed.push(file.name || "fichier sans nom");
      }
    }
    if (items.length) dispatch({ type: "GALLERY_ADD", items, newImages });
    if (failed.length) {
      alert(
        failed.length + " image(s) ignorée(s), car elles n'ont pas pu être lues ou converties :\n• " +
          failed.join("\n• ") + "\n\nEssayez des fichiers JPEG, PNG ou WebP valides.",
      );
    }
  }

  async function handleSwapFile(e) {
    const file = e.target.files && e.target.files[0];
    const index = swapIndexRef.current;
    if (!file || index == null) return;
    try {
      const img = await readImage(file);
      const thumbDataUrl = toSquare(img, 600, 0.82);
      const wideDataUrl = toWide(img, 1400, 0.8);
      dispatch({ type: "GALLERY_REPLACE_IMAGE", index, thumbDataUrl, wideDataUrl });
    } catch (error) {
      reportImageError(error, file);
    }
  }

  return (
    <section className={"adm-panel" + (active ? " active" : "")} data-panel="galerie">
      <div className="adm-info">
        <svg className="icon" aria-hidden="true"><use href="#i-info"></use></svg>
        <div>
          Les photos sont redimensionnées automatiquement : <strong>600×600</strong> pour la vignette et{" "}
          <strong>1400 px</strong> pour l'affichage en grand. Inutile de les préparer avant, déposez vos photos telles quelles.
        </div>
      </div>
      <div className="adm-gallery">
        {state.gallery.map((g, i) => (
          <div className="adm-gcard" key={g.thumb + "|" + g.src}>
            <img src={resolveImage(g.thumb)} alt="" />
            <div className="bar">
              <span className="num">#{i + 1}</span>
              <button type="button" className="icon-btn" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>
                <svg className="icon icon-sm" aria-hidden="true"><use href="#i-arrow-back"></use></svg>
              </button>
              <button
                type="button" className="icon-btn" aria-label="Descendre"
                disabled={i === state.gallery.length - 1} onClick={() => move(i, 1)}
              >
                <svg className="icon icon-sm" aria-hidden="true"><use href="#i-arrow-forward"></use></svg>
              </button>
              <button type="button" className="icon-btn" aria-label="Remplacer" onClick={() => startSwap(i)}>
                <svg className="icon icon-sm" aria-hidden="true"><use href="#i-image"></use></svg>
              </button>
              <button type="button" className="icon-btn danger" aria-label="Supprimer" onClick={() => remove(i)}>
                <svg className="icon icon-sm" aria-hidden="true"><use href="#i-delete"></use></svg>
              </button>
            </div>
          </div>
        ))}
        <div className="adm-gadd" role="button" tabIndex={0} onClick={startAdd} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startAdd(); } }}>
          <svg className="icon" aria-hidden="true"><use href="#i-add"></use></svg>
          <span>Ajouter des photos</span>
        </div>
      </div>
      <input ref={addInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleAddFiles} />
      <input ref={swapInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleSwapFile} />
    </section>
  );
}
