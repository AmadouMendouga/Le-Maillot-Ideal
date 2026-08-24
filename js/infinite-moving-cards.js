/* ===========================================================
   Infinite Moving Cards — portage vanilla du composant Aceternity UI
   ui.aceternity.com/components/infinite-moving-cards

   Le contenu est dupliqué une fois puis translaté de -50% en boucle
   linéaire : la deuxième copie prend le relais exactement où la
   première finit, donnant une boucle continue sans à-coup.
   Durées d'origine : fast 20s · normal 40s · slow 80s.
   Pause au survol (pauseOnHover, comportement par défaut du composant).
   =========================================================== */
(function () {
  "use strict";

  const SPEED_SECONDS = { fast: 20, normal: 40, slow: 80 };

  function upgrade(el) {
    if (el.dataset.imcReady) return;
    const track = el.querySelector(".imc-track");
    if (!track || !track.children.length) return;
    el.dataset.imcReady = "1";

    Array.from(track.children).forEach(function (node) {
      track.appendChild(node.cloneNode(true));
    });

    const speed = el.dataset.imcSpeed || "normal";
    el.style.setProperty("--imc-duration", (SPEED_SECONDS[speed] || SPEED_SECONDS.normal) + "s");
    if (el.dataset.imcDirection === "right") el.classList.add("imc-reverse");
  }

  function scan(root) {
    (root || document).querySelectorAll("[data-imc]").forEach(upgrade);
  }

  document.addEventListener("DOMContentLoaded", function () { scan(); });
  if ("MutationObserver" in window) {
    new MutationObserver(function (muts) {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches && n.matches("[data-imc]")) upgrade(n);
        if (n.querySelectorAll) scan(n);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.InfiniteMovingCards = { scan: scan };
})();
