"use client";

// Vignette qui vole de la carte vers la barre — porté depuis
// js/main.js#animateAdd (uniquement la partie vol d'image + rebond de la
// barre ; le "pop" de la carte et le texte "Ajouté" du bouton sont gérés par
// le composant appelant, plus naturel en React qu'ici).
export function flyToCart(mediaEl: HTMLElement, barEl: HTMLElement | null): boolean {
  const img = mediaEl.querySelector<HTMLImageElement>("img");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!img || !barEl || reduce || typeof img.animate !== "function") return false;

  const from = mediaEl.getBoundingClientRect();
  if (!from.width) return false;
  const barBox = barEl.getBoundingClientRect();
  const toX = barBox.left + 34;
  const toY = barBox.top + barBox.height / 2;

  const fly = document.createElement("img");
  fly.src = img.currentSrc || img.src;
  fly.className = "fly-item";
  fly.alt = "";
  const size = Math.min(from.width, from.height);
  fly.style.width = size + "px";
  fly.style.height = size + "px";
  fly.style.left = from.left + (from.width - size) / 2 + "px";
  fly.style.top = from.top + (from.height - size) / 2 + "px";
  document.body.appendChild(fly);

  // L'image quitte la carte (zoomée à 1.15 dans son cadre) puis y revient.
  mediaEl.classList.add("emptied");
  setTimeout(() => {
    mediaEl.classList.remove("emptied");
    mediaEl.classList.add("returning");
    setTimeout(() => mediaEl.classList.remove("returning"), 520);
  }, 430);

  const dx = toX - (from.left + from.width / 2);
  const dy = toY - (from.top + from.height / 2);
  const scaleEnd = 30 / size;

  // Trajectoire en arc : le point médian remonte avant de redescendre.
  const anim = fly.animate(
    [
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
      {
        transform: `translate(${dx * 0.45}px, ${dy * 0.28 - 70}px) scale(.62) rotate(-12deg)`,
        opacity: 1,
        offset: 0.55,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(${scaleEnd}) rotate(6deg)`, opacity: 0.55, offset: 1 },
    ],
    { duration: 720, easing: "cubic-bezier(.4,.05,.35,1)", fill: "forwards" }
  );
  anim.onfinish = () => {
    fly.remove();
    barEl.classList.remove("bump");
    void barEl.offsetWidth;
    barEl.classList.add("bump");
  };
  return true;
}
