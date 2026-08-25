// Porté depuis openProduct()/#admSave dans js/admin.js. Le composant est
// remonté (key={slug} côté ProductsTab) à chaque nouveau produit ouvert —
// mais PAS à la fermeture (le slug affiché reste le dernier ouvert tant que
// `open` est false) pour que le contenu ne disparaisse pas pendant
// l'animation de fermeture du tiroir (transform + transition, voir
// .adm-drawer dans css/admin.css).
import { useState } from "react";
import { useDraftState } from "../../state/useDraftState.jsx";
import { readImage, reportImageError, toSquare } from "../../lib/image.js";
import Drawer from "../shared/Drawer.jsx";
import ImageDropZone from "../shared/ImageDropZone.jsx";

const SIZES = ["S", "M", "L", "XL", "2XL"];
const KITS = ["Domicile", "Extérieur", "Third"];

export default function ProductEditDrawer({ slug, open, onClose }) {
  const { state, dispatch } = useDraftState();
  const product = state.products.find((p) => p.slug === slug) || null;

  const [name, setName] = useState(product ? product.name : "");
  const [team, setTeam] = useState(product ? product.team : "");
  const [kit, setKit] = useState(product ? product.kit : KITS[0]);
  const [season, setSeason] = useState(product ? product.season : "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [priceOriginal, setPriceOriginal] = useState(product ? String(product.priceOriginal) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [description, setDescription] = useState(product ? product.description : "");
  const [sizes, setSizes] = useState(product ? product.sizes || [] : []);
  const [kidsAvailable, setKidsAvailable] = useState(product ? !!product.kidsAvailable : false);
  const [isNew, setIsNew] = useState(product ? !!product.isNew : false);

  const priceNum = Number(price);
  const origNum = Number(priceOriginal);
  const discountPct = origNum > priceNum && origNum > 0 ? Math.round((1 - priceNum / origNum) * 100) : 0;

  function toggleSize(s) {
    setSizes((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  }

  async function handleImageFile(file) {
    if (!product) return;
    try {
      const img = await readImage(file);
      const dataUrl = toSquare(img, 600, 0.82);
      dispatch({ type: "SET_PRODUCT_IMAGE", slug: product.slug, path: "images/photos/" + product.slug + ".jpg", dataUrl });
    } catch (error) {
      reportImageError(error, file);
    }
  }

  function handleSave() {
    if (!product) return;
    if (!Number.isInteger(priceNum) || priceNum <= 0) {
      alert("Le prix de vente doit être supérieur à 0 FCFA.");
      return;
    }
    if (!Number.isInteger(origNum) || origNum < priceNum) {
      alert("Le prix barré doit être supérieur ou égal au prix de vente.");
      return;
    }
    if (!stock.trim() || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
      alert("Le stock doit être un nombre entier positif ou nul.");
      return;
    }
    if (!sizes.length) {
      alert("Sélectionnez au moins une taille disponible.");
      return;
    }
    dispatch({
      type: "SET_PRODUCT",
      slug: product.slug,
      patch: {
        name: name.trim() || product.name,
        team: team.trim() || product.team,
        kit,
        price: priceNum,
        priceOriginal: origNum,
        stock: Number(stock),
        season: season.trim(),
        description: description.trim(),
        sizes,
        kidsAvailable,
        isNew,
        discountPct,
      },
    });
    onClose();
  }

  const footer = product ? (
    <button type="button" className="btn btn-primary btn-block" onClick={handleSave}>
      <svg className="icon icon-sm" aria-hidden="true"><use href="#i-check-circle"></use></svg>Enregistrer
    </button>
  ) : null;

  return (
    <Drawer open={open} onClose={onClose} title={product ? product.name : ""} titleIcon="edit" footer={footer}>
      {product ? (
        <>
          <ImageDropZone previewSrc={state.newImages[product.image] || product.image} onFile={handleImageFile} />

          <div className="adm-field" style={{ marginTop: 18 }}>
            <label>Nom affiché</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="adm-grid2">
            <div className="adm-field"><label>Équipe</label><input value={team} onChange={(e) => setTeam(e.target.value)} /></div>
            <div className="adm-field">
              <label>Type de maillot</label>
              <select value={kit} onChange={(e) => setKit(e.target.value)}>
                {KITS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          <div className="adm-grid3">
            <div className="adm-field">
              <label>Prix de vente</label>
              <input type="number" min="1" step="100" required value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="adm-field">
              <label>Prix barré</label>
              <input type="number" min="1" step="100" required value={priceOriginal} onChange={(e) => setPriceOriginal(e.target.value)} />
            </div>
            <div className="adm-field">
              <label>Stock</label>
              <input type="number" min="0" step="1" required value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>
          <p className="hint" style={{ margin: "-6px 0 14px", fontSize: ".78rem", color: "var(--on-surface-variant)" }}>
            {discountPct > 0
              ? "Remise calculée : -" + discountPct + "%"
              : "Aucune remise affichée (le prix barré doit être supérieur au prix de vente)."}
          </p>

          <div className="adm-field"><label>Saison</label><input value={season} onChange={(e) => setSeason(e.target.value)} /></div>
          <div className="adm-field"><label>Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>

          <div className="adm-field">
            <label>Tailles disponibles</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SIZES.map((s) => (
                <label key={s} className="adm-check" style={{ padding: 0 }}>
                  <input type="checkbox" checked={sizes.includes(s)} onChange={() => toggleSize(s)} /> {s}
                </label>
              ))}
            </div>
          </div>

          <label className="adm-check">
            <input type="checkbox" checked={kidsAvailable} onChange={(e) => setKidsAvailable(e.target.checked)} /> Tailles enfant disponibles
          </label>
          <label className="adm-check">
            <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} /> Afficher le badge « Nouveau »
          </label>
        </>
      ) : null}
    </Drawer>
  );
}
