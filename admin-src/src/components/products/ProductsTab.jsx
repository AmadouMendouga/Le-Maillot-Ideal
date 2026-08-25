// Porté depuis la section PRODUITS de js/admin.js (filtered(), toolbar,
// ouverture du tiroir).
import { useMemo, useState } from "react";
import { useDraftState } from "../../state/useDraftState.jsx";
import { readImage, reportImageError, toSquare } from "../../lib/image.js";
import ProductTable from "./ProductTable.jsx";
import ProductEditDrawer from "./ProductEditDrawer.jsx";

function filterProducts(products, touched, filters) {
  return products.filter((p) => {
    if (filters.league && p.league !== filters.league) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      if (p.name.toLowerCase().indexOf(q) < 0 && p.team.toLowerCase().indexOf(q) < 0) return false;
    }
    if (filters.status === "modified" && !touched[p.slug]) return false;
    if (filters.status === "out" && p.stock !== 0) return false;
    if (filters.status === "low" && !(p.stock > 0 && p.stock <= 5)) return false;
    if (filters.status === "promo" && !(p.discountPct > 0)) return false;
    return true;
  });
}

export default function ProductsTab() {
  const { state, dispatch } = useDraftState();
  const [filters, setFilters] = useState({ q: "", league: "", status: "" });
  // editingSlug pilote l'ouverture réelle ; displaySlug reste sur le dernier
  // produit ouvert pendant que le tiroir se referme en animation (voir
  // ProductEditDrawer.jsx) — sinon le contenu disparaîtrait avant la fin de
  // la transition CSS. openNonce force un remount même en rouvrant le MÊME
  // produit : comme l'original (openProduct() reconstruit toujours les
  // champs depuis state.products), fermer sans enregistrer puis rouvrir doit
  // relire les vraies valeurs, pas garder une saisie abandonnée.
  const [editingSlug, setEditingSlug] = useState(null);
  const [displaySlug, setDisplaySlug] = useState(null);
  const [openNonce, setOpenNonce] = useState(0);

  const filtered = useMemo(
    () => filterProducts(state.products, state.touched, filters),
    [state.products, state.touched, filters],
  );
  const resolveImage = (path) => state.newImages[path] || path;

  function openEditor(slug) {
    setDisplaySlug(slug);
    setEditingSlug(slug);
    setOpenNonce((n) => n + 1);
  }
  function closeEditor() {
    setEditingSlug(null);
  }

  async function handleImagePicked(slug, file) {
    try {
      const img = await readImage(file);
      const target = "images/photos/" + slug + ".jpg";
      const dataUrl = toSquare(img, 600, 0.82);
      dispatch({ type: "SET_PRODUCT_IMAGE", slug, path: target, dataUrl });
    } catch (error) {
      reportImageError(error, file);
    }
  }

  return (
    <section className="adm-panel active" data-panel="produits">
      <div className="adm-toolbar">
        <span className="field-wrap grow">
          <svg className="icon" aria-hidden="true"><use href="#i-search"></use></svg>
          <input
            type="search" className="search-input" aria-label="Rechercher un maillot"
            placeholder="Rechercher une équipe, un maillot…" style={{ width: "100%" }}
            value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </span>
        <select
          className="sort-select" aria-label="Filtrer par championnat"
          value={filters.league} onChange={(e) => setFilters((f) => ({ ...f, league: e.target.value }))}
        >
          <option value="">Tous les championnats</option>
          {Object.keys(state.leagues).map((key) => (
            <option key={key} value={key}>{state.leagues[key].label}</option>
          ))}
        </select>
        <select
          className="sort-select" aria-label="Filtrer par état"
          value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">Tous les états</option>
          <option value="modified">Modifiés</option>
          <option value="out">En rupture</option>
          <option value="low">Stock bas</option>
          <option value="promo">En promotion</option>
        </select>
        <span className="adm-count">{filtered.length} maillot{filtered.length > 1 ? "s" : ""}</span>
      </div>

      <ProductTable
        products={filtered}
        touched={state.touched}
        resolveImage={resolveImage}
        onEdit={openEditor}
        onImagePicked={handleImagePicked}
      />

      <ProductEditDrawer key={displaySlug + ":" + openNonce} slug={displaySlug} open={editingSlug !== null} onClose={closeEditor} />
    </section>
  );
}
