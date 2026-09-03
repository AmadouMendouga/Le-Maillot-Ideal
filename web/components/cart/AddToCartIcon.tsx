// Doit correspondre à la durée totale des animations atc-bag-out/atc-cart-run
// dans app/lmi.css (1.3s).
const ADD_TO_CART_ICON_ANIM_MS = 1300;

// Déclenche l'animation en manipulant la classe directement sur le DOM (avec
// un reflow forcé entre retrait et repose), exactement comme le "cardPop" de
// ProductCard.tsx pour la même raison : un clic répété doit RELANCER
// l'animation depuis le début, pas être ignoré parce que la classe React
// était déjà à `true`. Annule le timeout de remise à zéro précédent pour
// éviter qu'un clic répété avant la fin ne coupe la nouvelle animation en
// cours de route (bug constaté : deux clics rapprochés faisaient courir deux
// setTimeout en parallèle, le premier remettant tout à zéro en plein milieu
// du second). `timeoutRef` doit être un useRef<ReturnType<typeof setTimeout> | null>
// tenu par l'appelant, réutilisé à chaque clic.
export function runAddToCartIcon(container: HTMLElement | null, timeoutRef: { current: ReturnType<typeof setTimeout> | null }) {
  const icon = container?.querySelector<HTMLElement>(".atc-icon");
  if (!icon) return;
  if (timeoutRef.current) clearTimeout(timeoutRef.current);
  icon.classList.remove("running");
  void icon.offsetWidth; // force le reflow : sans ça, remove+add dans le même tick ne relance rien
  icon.classList.add("running");
  timeoutRef.current = setTimeout(() => icon.classList.remove("running"), ADD_TO_CART_ICON_ANIM_MS);
}

// Icône animée du bouton "Ajouter au panier" — voir le commentaire dans
// app/lmi.css (classes .atc-*) pour le contexte et l'origine de l'effet.
// N'anime que l'icône : le texte du bouton garde son propre cycle "Ajouter"
// → "Ajouté" (déjà géré par l'appelant), et le vol d'image vers la barre
// panier (flyToCart) reste inchangé — cette icône est un ajout, pas un
// remplacement. Toujours montée (jamais échangée contre une coche statique) :
// l'animation elle-même communique le succès, pas besoin d'un second état.
export function AddToCartIcon() {
  return (
    <span className="atc-icon" aria-hidden="true">
      <svg className="atc-bag" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 9V6a4 4 0 0 1 8 0v3" />
        <rect x="5" y="9" width="14" height="12" rx="2" />
      </svg>
      {/* Chariot Tabler (mêmes tracés que #i-cart dans le sprite du site,
          repris ici tel quel pour rester cohérent visuellement) — un <svg>
          entier plutôt que des roues animées séparément : les roues de
          l'icône sont de simples cercles, les faire "tourner" ne se
          verrait pas ; le déplacement horizontal suffit à lire "roule". */}
      <svg className="atc-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
        <path d="M15 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
        <path d="M17 17h-11v-14h-2" />
        <path d="M6 5l14 1l-1 7h-13" />
      </svg>
    </span>
  );
}
