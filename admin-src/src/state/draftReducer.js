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

    // Remplace une tranche entière du brouillon — repli générique pour les
    // mutations en bloc (ex. onglet Textes du site, phase 4d).
    case "REPLACE_SLICE":
      return { ...state, [action.key]: action.value };

    case "GALLERY_MOVE": {
      const target = action.index + action.direction;
      if (target < 0 || target >= state.gallery.length) return state;
      const list = state.gallery.slice();
      const tmp = list[action.index];
      list[action.index] = list[target];
      list[target] = tmp;
      return { ...state, gallery: list };
    }

    case "GALLERY_DELETE":
      return { ...state, gallery: state.gallery.filter((_, i) => i !== action.index) };

    case "GALLERY_ADD":
      return {
        ...state,
        gallery: [...state.gallery, ...action.items],
        newImages: { ...state.newImages, ...action.newImages },
      };

    case "GALLERY_REPLACE_IMAGE": {
      const item = state.gallery[action.index];
      if (!item) return state;
      return {
        ...state,
        newImages: { ...state.newImages, [item.thumb]: action.thumbDataUrl, [item.src]: action.wideDataUrl },
      };
    }

    case "TESTI_ADD":
      return { ...state, testimonials: [...state.testimonials, action.item] };

    case "TESTI_DELETE":
      return { ...state, testimonials: state.testimonials.filter((_, i) => i !== action.index) };

    case "TESTI_UPDATE": {
      const list = state.testimonials.slice();
      list[action.index] = { ...list[action.index], [action.field]: action.value };
      return { ...state, testimonials: list };
    }

    case "TESTI_SET_IMAGE": {
      const list = state.testimonials.slice();
      if (!list[action.index]) return state;
      list[action.index] = { ...list[action.index], src: action.path };
      return { ...state, testimonials: list, newImages: { ...state.newImages, [action.path]: action.dataUrl } };
    }

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
