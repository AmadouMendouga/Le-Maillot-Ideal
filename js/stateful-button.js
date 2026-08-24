/* ===========================================================
   Stateful Button — portage vanilla du composant Aceternity UI
   ui.aceternity.com/components/stateful-button

   Séquence d'origine :
     clic → le spinner apparaît (width 0→20px, scale 0→1, 0.2s)
          → on attend la promesse du handler
          → le spinner disparaît (0.2s), la coche apparaît (0.2s)
          → la coche reste 2s puis disparaît (0.2s)
   Le `layout` de Framer Motion anime la largeur du bouton pendant
   que les icônes apparaissent : reproduit ici en FLIP sur la largeur.
   =========================================================== */
(function () {
  "use strict";

  /* icônes Tabler du composant, tracés repris tels quels */
  const LOADER =
    '<svg class="sb-loader" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3a9 9 0 1 0 9 9"></path></svg>';
  const CHECK =
    '<svg class="sb-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M5 12l5 5l10 -10"></path></svg>';

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduce = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* anime la largeur du bouton autour d'une mutation (équivalent de `layout`) */
  function flip(btn, mutate) {
    if (reduce() || typeof btn.animate !== "function") { mutate(); return; }
    const w0 = btn.getBoundingClientRect().width;
    mutate();
    const w1 = btn.getBoundingClientRect().width;
    if (Math.abs(w1 - w0) < 0.5) return;
    btn.animate([{ width: w0 + "px" }, { width: w1 + "px" }], { duration: 200, easing: "ease-out" });
  }

  function upgrade(el) {
    if (el.dataset.sbReady) return;
    el.dataset.sbReady = "1";
    el.classList.add("btn-stateful");

    /* on emballe le contenu pour pouvoir insérer les icônes devant le libellé */
    const inner = document.createElement("span");
    inner.className = "sb-inner";
    while (el.firstChild) inner.appendChild(el.firstChild);
    inner.insertAdjacentHTML("afterbegin", LOADER + CHECK);
    el.appendChild(inner);
  }

  function setIcon(el, sel, on) {
    const svg = el.querySelector(sel);
    if (svg) svg.classList.toggle("on", on);
  }

  /* joue la séquence complète autour d'un travail asynchrone */
  async function run(el, work) {
    if (el.dataset.sbBusy) return;
    upgrade(el);
    el.dataset.sbBusy = "1";
    el.classList.add("is-loading");

    flip(el, () => setIcon(el, ".sb-loader", true));
    await wait(200);

    try {
      if (typeof work === "function") await work();
    } catch (e) {
      /* échec : on retire le spinner et on signale l'erreur */
      flip(el, () => setIcon(el, ".sb-loader", false));
      el.classList.remove("is-loading");
      el.classList.add("is-error");
      await wait(1600);
      el.classList.remove("is-error");
      delete el.dataset.sbBusy;
      return;
    }

    /* spinner → coche */
    flip(el, () => setIcon(el, ".sb-loader", false));
    el.classList.remove("is-loading");
    await wait(200);
    flip(el, () => setIcon(el, ".sb-check", true));
    el.classList.add("is-done");

    await wait(2000);                       /* delay: 2 du composant */
    flip(el, () => setIcon(el, ".sb-check", false));
    el.classList.remove("is-done");
    delete el.dataset.sbBusy;
  }

  /* --- montage déclaratif via data-stateful --- */
  function bind(el) {
    if (el.dataset.sbBound) return;
    el.dataset.sbBound = "1";
    upgrade(el);

    el.addEventListener("click", function (e) {
      if (el.dataset.sbBusy) { e.preventDefault(); return; }

      /* un validateur peut annuler l'action (formulaire incomplet…) */
      const check = el.dataset.statefulValidate && window[el.dataset.statefulValidate];
      if (typeof check === "function" && !check(el)) {
        e.preventDefault();
        el.classList.add("is-error");
        setTimeout(() => el.classList.remove("is-error"), 1600);
        return;
      }

      /* Sur un lien on laisse le navigateur ouvrir l'onglet lui-même :
         un window.open après un await serait bloqué comme popup. */
      const delay = Number(el.dataset.statefulDelay || 450);
      run(el, () => wait(delay));
    });
  }

  function scan(root) {
    (root || document).querySelectorAll("[data-stateful]").forEach(bind);
  }

  window.StatefulButton = { run: run, bind: bind, scan: scan, upgrade: upgrade };

  document.addEventListener("DOMContentLoaded", function () {
    scan();
    if ("MutationObserver" in window) {
      new MutationObserver(function (muts) {
        for (const m of muts) for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.matches && n.matches("[data-stateful]")) bind(n);
          if (n.querySelectorAll) scan(n);
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
  });
})();
