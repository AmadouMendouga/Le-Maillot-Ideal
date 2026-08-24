/* ===========================================================
   Moving Border — portage vanilla du composant Aceternity UI
   ui.aceternity.com/components/moving-border

   L'original anime un point le long du périmètre d'un <rect> SVG
   (getTotalLength / getPointAtLength) piloté par Framer Motion.
   Reproduit ici avec la CSS Motion Path (offset-path) native, animée
   par la Web Animations API — même résultat, sans dépendance.
   Durée par défaut 3000ms, dégradé radial qui s'estompe à 60%.
   Se désactive proprement si offset-path n'est pas supporté.
   =========================================================== */
(function () {
  "use strict";

  const supportsOffsetPath = window.CSS && CSS.supports && CSS.supports("offset-path", "path('M0,0 L1,1')");

  function roundedRectPath(w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    return "M" + rr + ",0" +
      " H" + (w - rr) +
      " A" + rr + "," + rr + " 0 0 1 " + w + "," + rr +
      " V" + (h - rr) +
      " A" + rr + "," + rr + " 0 0 1 " + (w - rr) + "," + h +
      " H" + rr +
      " A" + rr + "," + rr + " 0 0 1 0," + (h - rr) +
      " V" + rr +
      " A" + rr + "," + rr + " 0 0 1 " + rr + ",0 Z";
  }

  function upgrade(el) {
    if (el.dataset.mbReady) return;
    el.dataset.mbReady = "1";
    const highlight = el.querySelector(".mborder-highlight");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!highlight || !supportsOffsetPath || typeof highlight.animate !== "function" || reduce) {
      if (highlight) highlight.style.display = "none";
      return;
    }

    let anim = null;
    function setup() {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const radiusVar = getComputedStyle(el).getPropertyValue("--mborder-radius").trim();
      const radius = radiusVar.endsWith("px") ? parseFloat(radiusVar) : Math.min(w, h) / 2;
      highlight.style.offsetPath = "path('" + roundedRectPath(w, h, radius) + "')";
      if (anim) anim.cancel();
      const duration = Number(el.dataset.mborderDuration) || 3000;
      anim = highlight.animate(
        [{ offsetDistance: "0%" }, { offsetDistance: "100%" }],
        { duration: duration, iterations: Infinity, easing: "linear" }
      );
    }

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup); else setup();
    let resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(setup, 200);
    });
  }

  function scan(root) {
    (root || document).querySelectorAll("[data-mborder]").forEach(upgrade);
  }

  document.addEventListener("DOMContentLoaded", function () { scan(); });
  window.MovingBorder = { scan: scan };
})();
