/* ===========================================================
   Lens — portage vanilla du composant Aceternity UI
   ui.aceternity.com/components/lens

   Loupe circulaire qui suit le curseur : zoomFactor 1.5, taille
   170px (valeurs par défaut du composant). Apparition en 300ms
   ease-out, opacity 0→1 et scale .58→1. Remplace le Direction
   Aware Hover sur l'image de la fiche produit : sur cette page il
   n'y a qu'une seule photo déjà identifiée, zoomer le tissu/le
   floquage aide plus la décision d'achat qu'un survol directionnel.
   Neutralisé au tactile (hover: none), comme les autres effets de
   survol du site.
   =========================================================== */
(function () {
  "use strict";

  function upgrade(el) {
    if (el.dataset.lensReady) return;
    const img = el.querySelector(".lens-img img");
    const glass = el.querySelector(".lens-glass");
    if (!img || !glass) return;
    el.dataset.lensReady = "1";

    const zoom = Number(el.dataset.lensZoom) || 1.5;
    const size = Number(el.dataset.lensSize) || 170;
    glass.style.width = size + "px";
    glass.style.height = size + "px";

    function ready() {
      glass.style.backgroundImage = "url('" + (img.currentSrc || img.src) + "')";
    }
    if (img.complete) ready(); else img.addEventListener("load", ready, { once: true });

    function move(clientX, clientY) {
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) { glass.classList.remove("on"); return; }
      glass.classList.add("on");
      glass.style.left = x + "px";
      glass.style.top = y + "px";
      glass.style.backgroundSize = (rect.width * zoom) + "px " + (rect.height * zoom) + "px";
      glass.style.backgroundPosition = (-(x * zoom - size / 2)) + "px " + (-(y * zoom - size / 2)) + "px";
    }

    el.addEventListener("mousemove", function (e) { move(e.clientX, e.clientY); });
    el.addEventListener("mouseleave", function () { glass.classList.remove("on"); });
  }

  function scan(root) {
    (root || document).querySelectorAll("[data-lens]").forEach(upgrade);
  }

  document.addEventListener("DOMContentLoaded", function () { scan(); });
  if ("MutationObserver" in window) {
    new MutationObserver(function (muts) {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches && n.matches("[data-lens]")) upgrade(n);
        if (n.querySelectorAll) scan(n);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.LensZoom = { scan: scan };
})();
