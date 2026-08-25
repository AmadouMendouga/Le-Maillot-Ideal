// Wrapper fin autour de js/stateful-button.js (chargé en <script> classique
// dans admin-src/index.html, voir CLAUDE.md §5.4) — ne réimplémente pas
// l'animation FLIP en React : même script que product.html côté site
// public, zéro risque de dérive de timing/easing.
//
// Piège : StatefulButton.upgrade() (appelé par .run() au premier clic) mute
// les enfants DOM du bouton une seule fois (les enveloppe dans .sb-inner et
// y insère les icônes spinner/coche). React ne les touche plus ensuite tant
// que les enfants JSX qu'on lui passe restent identiques d'un rendu à
// l'autre — ne jamais rendre ce bouton avec un contenu dynamique.
export default function StatefulButton({ innerRef, onRun, children, className, ...rest }) {
  function handleClick(el) {
    if (!el || !window.StatefulButton) return;
    window.StatefulButton.run(el, onRun);
  }

  return (
    <button
      ref={innerRef}
      type="button"
      className={className}
      onClick={(e) => handleClick(e.currentTarget)}
      {...rest}
    >
      {children}
    </button>
  );
}
