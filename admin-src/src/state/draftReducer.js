// Forme du brouillon — identique à `state` dans l'ancien js/admin.js, car
// c'est aussi le corps JSON envoyé à POST /api/publish (voir
// assertValidProducts/assertValidSite dans api/publish.js). Clés
// restaurées depuis le brouillon localStorage (même liste blanche que
// l'ancien loadDraft) : "leagues" n'est jamais éditée par l'interface, donc
// volontairement absente.
export const DRAFT_KEYS = ["products", "gallery", "testimonials", "site", "newImages", "touched"];

export function createInitialState() {
  const fresh = {
    products: JSON.parse(JSON.stringify(window.PRODUCTS || [])),
    leagues: JSON.parse(JSON.stringify(window.LEAGUES || {})),
    gallery: JSON.parse(JSON.stringify(window.GALLERY || [])),
    testimonials: JSON.parse(JSON.stringify(window.TESTIMONIALS || [])),
    site: JSON.parse(JSON.stringify(window.SITE || {})),
    newImages: {},
    touched: {},
  };
  try {
    const raw = localStorage.getItem("lmi_admin_draft_v2");
    if (raw) {
      const draft = JSON.parse(raw);
      for (const key of DRAFT_KEYS) {
        if (draft[key] !== undefined) fresh[key] = draft[key];
      }
    }
  } catch {
    // brouillon illisible : on repart d'un état propre plutôt que de bloquer l'admin
  }
  return fresh;
}

export function draftReducer(state, action) {
  switch (action.type) {
    case "RESET_DRAFT":
      return createInitialState();

    // Remplace une tranche entière du brouillon (ex. réordonner la
    // photothèque, ajouter/supprimer un avis) — les onglets Photothèque et
    // Avis (phase 4) l'utilisent pour leurs mutations de tableau.
    case "REPLACE_SLICE":
      return { ...state, [action.key]: action.value };

    case "SET_PRODUCT":
      return {
        ...state,
        products: state.products.map((p) => (p.slug === action.slug ? { ...p, ...action.patch } : p)),
        touched: { ...state.touched, [action.slug]: true },
      };

    case "SET_PRODUCT_IMAGE":
      return {
        ...state,
        products: state.products.map((p) => (
          p.slug === action.slug ? { ...p, image: action.path, imageWide: action.path } : p
        )),
        newImages: { ...state.newImages, [action.path]: action.dataUrl },
        touched: { ...state.touched, [action.slug]: true },
      };

    case "SET_SITE_FIELD":
      return { ...state, site: { ...state.site, [action.key]: action.value } };

    default:
      return state;
  }
}
