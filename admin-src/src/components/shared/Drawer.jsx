// Tiroir d'édition modal — porté depuis admin.html (#admDrawer/#admOverlay)
// et la logique de piège de focus de js/admin.js (lignes ~360-406). Pas de
// <dialog> natif : tests/browser-audit.mjs vérifie `drawer.inert`/
// `aria-hidden` directement, un <dialog> n'expose pas les mêmes primitives.
import { useEffect, useRef } from "react";

export default function Drawer({ open, onClose, titleIcon = "edit", title, children, footer }) {
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lastFocusRef = useRef(null);

  // Ouverture : mémorise l'élément actif puis déplace le focus sur le
  // bouton fermer. Fermeture : restaure le focus d'origine.
  useEffect(() => {
    if (open) {
      lastFocusRef.current = document.activeElement;
      const raf = requestAnimationFrame(() => closeButtonRef.current && closeButtonRef.current.focus());
      return () => cancelAnimationFrame(raf);
    }
    const target = lastFocusRef.current;
    if (target && typeof target.focus === "function" && document.contains(target)) target.focus();
    return undefined;
  }, [open]);

  // Échap ferme, Tab/Maj+Tab reste piégé à l'intérieur du tiroir.
  useEffect(() => {
    if (!open) return undefined;
    function handleKeydown(e) {
      const drawer = drawerRef.current;
      if (!drawer) return;
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        drawer.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.getClientRects().length > 0);
      if (!focusable.length) { e.preventDefault(); drawer.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, onClose]);

  return (
    <>
      <div className={"adm-overlay" + (open ? " open" : "")} onClick={onClose} />
      <aside
        ref={drawerRef}
        className={"adm-drawer" + (open ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-labelledby="admDrawerTitle"
        tabIndex={-1}
        inert={!open}
      >
        <div className="adm-drawer-head">
          <svg className="icon icon-lg" aria-hidden="true"><use href={"#i-" + titleIcon}></use></svg>
          <span id="admDrawerTitle">{title}</span>
          <button ref={closeButtonRef} type="button" className="icon-btn plain close" aria-label="Fermer" onClick={onClose}>
            <svg className="icon" aria-hidden="true"><use href="#i-close"></use></svg>
          </button>
        </div>
        <div className="adm-drawer-body">{children}</div>
        {footer ? <div className="adm-drawer-foot">{footer}</div> : null}
      </aside>
    </>
  );
}
