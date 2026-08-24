/* ===========================================================
   Direction Aware Hover — portage vanilla du composant Aceternity UI
   ui.aceternity.com/components/direction-aware-hover

   À l'entrée du curseur, on calcule par quel bord il arrive
   (getDirection, formule atan2 d'origine), puis l'image — pré-zoomée
   à 1.15 — glisse de 20px dans la direction opposée, un voile noir
   apparaît et la légende monte depuis le bas.
   =========================================================== */
(function () {
  "use strict";

  /* variants d'origine : décalage de l'image selon le bord d'entrée */
  const IMG = {
    top:    { x: 0,   y: 20 },
    bottom: { x: 0,   y: -20 },
    left:   { x: 20,  y: 0 },
    right:  { x: -20, y: 0 },
  };
  /* variants de la légende (valeurs asymétriques du composant original) */
  const TXT = {
    top:    { x: 0,  y: -20 },
    bottom: { x: 0,  y: 2 },
    left:   { x: -2, y: 0 },
    right:  { x: 20, y: 0 },
  };
  const NAMES = ["top", "right", "bottom", "left"];

  /* getDirection() du composant, repris tel quel */
  function getDirection(ev, obj) {
    const r = obj.getBoundingClientRect();
    const w = r.width, h = r.height;
    const x = ev.clientX - r.left - (w / 2) * (w > h ? h / w : 1);
    const y = ev.clientY - r.top - (h / 2) * (h > w ? w / h : 1);
    const d = Math.round(Math.atan2(y, x) / 1.57079633 + 5) % 4;
    return NAMES[d] || "left";
  }

  function set(el, dir, on) {
    const i = on ? IMG[dir] : { x: 0, y: 0 };
    const t = on ? TXT[dir] : { x: 0, y: 0 };
    el.style.setProperty("--dah-x", i.x + "px");
    el.style.setProperty("--dah-y", i.y + "px");
    el.style.setProperty("--dah-tx", t.x + "px");
    el.style.setProperty("--dah-ty", t.y + "px");
    el.classList.toggle("is-hover", on);
  }

  function bind(el) {
    if (el.dataset.dahBound) return;
    el.dataset.dahBound = "1";
    let dir = "left";
    el.addEventListener("mouseenter", function (e) {
      dir = getDirection(e, el);
      set(el, dir, true);
    });
    el.addEventListener("mouseleave", function (e) {
      /* on sort par le bord le plus proche : la légende repart du bon côté */
      set(el, getDirection(e, el), false);
    });
    /* le clavier ne connaît pas de direction : entrée par le bas, comme un focus */
    el.addEventListener("focusin", () => set(el, "bottom", true));
    el.addEventListener("focusout", () => set(el, "bottom", false));
  }

  function scan(root) {
    (root || document).querySelectorAll(".dah").forEach(bind);
  }

  window.DirectionAwareHover = { scan: scan, bind: bind, getDirection: getDirection };

  document.addEventListener("DOMContentLoaded", function () {
    scan();
    /* les cartes produits sont injectées dynamiquement : on observe le DOM */
    if ("MutationObserver" in window) {
      new MutationObserver(function (muts) {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (n.classList && n.classList.contains("dah")) bind(n);
            if (n.querySelectorAll) scan(n);
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
  });
})();
