/* ===========================================================
   Container Text Flip — portage vanilla du composant Aceternity UI
   ui.aceternity.com/components/container-text-flip

   Séquence d'origine : le conteneur mesure le mot suivant
   (scrollWidth + 30px), anime sa largeur (durée par défaut 700ms,
   ease-in-out), puis chaque lettre apparaît avec un flou
   (blur 10px→0, opacity 0→1) décalée de 20ms par lettre.
   Rotation toutes les 3000ms par défaut.
   =========================================================== */
(function () {
  "use strict";

  function measure(word) {
    const probe = document.createElement("span");
    probe.className = "ctf-text";
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;";
    probe.textContent = word;
    document.body.appendChild(probe);
    const width = probe.getBoundingClientRect().width + 30;
    probe.remove();
    return width;
  }

  function upgrade(el) {
    if (el.dataset.ctfReady) return;

    let words = [];
    try { words = JSON.parse(el.dataset.ctf || "[]"); } catch (e) {}
    if (!words.length) return; /* pas encore de contenu réel : on retentera au prochain scan() */
    el.dataset.ctfReady = "1";

    const interval = Number(el.dataset.ctfInterval) || 3000;
    const duration = Number(el.dataset.ctfDuration) || 700;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    el.classList.add("ctf-pill");
    el.style.transition = reduce ? "none" : "width " + duration + "ms ease-in-out";

    let i = 0;
    function render(word) {
      el.style.width = measure(word) + "px";
      const inner = document.createElement("span");
      inner.className = "ctf-text";
      Array.from(word).forEach(function (ch, idx) {
        const letter = document.createElement("span");
        letter.className = "ctf-letter";
        letter.textContent = ch === " " ? " " : ch;
        if (!reduce) letter.style.animationDelay = (idx * 20) + "ms";
        inner.appendChild(letter);
      });
      el.innerHTML = "";
      el.appendChild(inner);
    }

    render(words[0]);
    if (!reduce && words.length > 1) {
      setInterval(function () {
        i = (i + 1) % words.length;
        render(words[i]);
      }, interval);
    }
  }

  function scan(root) {
    (root || document).querySelectorAll("[data-ctf]").forEach(upgrade);
  }

  document.addEventListener("DOMContentLoaded", function () { scan(); });
  window.ContainerTextFlip = { scan: scan };
})();
