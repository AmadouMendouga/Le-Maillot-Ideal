// Porté depuis l'en-tête de admin.html. Les liens vers le site public sont
// en chemins absolus ("/") puisque cette page vit désormais sous /admin.
import { useDraftState } from "../../state/useDraftState.jsx";

function toggleTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("lmi_theme", next); } catch { /* thème non mémorisé, sans gravité */ }
}

export default function AdminHeader({ onGoExport }) {
  const { savedStatus } = useDraftState();

  return (
    <header className="adm-header">
      <div className="container">
        <a href="/" className="logo">
          <span className="logo-mark"><svg className="icon icon-lg" aria-hidden="true"><use href="#i-soccer"></use></svg></span>
          <span>Le Maillot Idéal<small>ADMINISTRATION</small></span>
        </a>
        <span className="adm-badge">Hors ligne</span>

        <div className="adm-actions">
          <span className="adm-saved">{savedStatus}</span>
          <button type="button" className="theme-toggle" aria-label="Changer de thème" title="Thème clair / sombre" onClick={toggleTheme}>
            <svg className="icon icon-lg i-moon" aria-hidden="true"><use href="#i-dark-mode"></use></svg>
            <svg className="icon icon-lg i-sun" aria-hidden="true"><use href="#i-light-mode"></use></svg>
          </button>
          <a className="btn btn-outline btn-sm" href="/" target="_blank" rel="noopener">
            <svg className="icon icon-sm" aria-hidden="true"><use href="#i-visibility"></use></svg>Voir le site
          </a>
          <button type="button" className="btn btn-primary btn-sm" onClick={onGoExport}>
            <svg className="icon icon-sm" aria-hidden="true"><use href="#i-save"></use></svg>Préparer l'export
          </button>
        </div>
      </div>
    </header>
  );
}
