// Contexte + hook exposant le brouillon d'admin et sa persistance
// localStorage — porte le comportement de saveDraft/loadDraft de l'ancien
// js/admin.js (clé lmi_admin_draft_v2, debounce 400 ms) sur useReducer.
// L'ancien loadDraft() tournait une seule fois avant tout rendu ; ici
// l'initialiseur paresseux de useReducer joue le même rôle (voir
// createInitialState dans draftReducer.js) pour éviter qu'un effet de
// sauvegarde n'écrase un brouillon pas encore restauré.
import { createContext, useContext, useEffect, useReducer, useRef, useState } from "react";
import { createInitialState, draftReducer } from "./draftReducer.js";

const DRAFT_KEY = "lmi_admin_draft_v2";
const DraftContext = createContext(null);

function hadStoredDraft() {
  try {
    return !!localStorage.getItem(DRAFT_KEY);
  } catch {
    return false;
  }
}

export function DraftProvider({ children }) {
  const [state, dispatch] = useReducer(draftReducer, undefined, createInitialState);
  const [savedStatus, setSavedStatus] = useState(() => (hadStoredDraft() ? "Brouillon restauré" : ""));
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Ne pas sauvegarder au montage : le brouillon vient d'être restauré (ou
    // il n'y en avait pas), rien de nouveau à écrire tant que l'admin n'a
    // encore rien modifié.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return undefined;
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
        const d = new Date();
        setSavedStatus(
          "Brouillon enregistré à " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"),
        );
      } catch {
        setSavedStatus("Brouillon trop volumineux pour être enregistré — exportez vos changements");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [state]);

  const resetDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* rien à faire */ }
    dispatch({ type: "RESET_DRAFT" });
  };

  return (
    <DraftContext.Provider value={{ state, dispatch, savedStatus, resetDraft }}>
      {children}
    </DraftContext.Provider>
  );
}

export function useDraftState() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraftState doit être utilisé sous <DraftProvider>.");
  return ctx;
}
