/* ===========================================================
   Animated Testimonials — portage vanilla (sans React/Framer Motion)
   du composant Aceternity UI : ui.aceternity.com/components/animated-testimonials
   Reproduit : pile d'images en perspective, rotations aléatoires,
   saut vertical de l'image active, citation révélée mot à mot avec flou.
   =========================================================== */
(function () {
  "use strict";

  function escapeAttr(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function setEmptyState(root, empty) {
    root.hidden = empty;
    root.setAttribute("aria-hidden", empty ? "true" : "false");

    /* Les deux instances publiques occupent chacune une section dédiée.
       La masquer évite de laisser un titre « Avis clients » sans contenu. */
    const section = root.closest("section");
    if (section) {
      section.hidden = empty;
      section.setAttribute("aria-hidden", empty ? "true" : "false");
    }
  }

  function AnimatedTestimonials(root, testimonials, opts) {
    testimonials = Array.isArray(testimonials) ? testimonials : [];
    if (!root || testimonials.length === 0) {
      if (root) setEmptyState(root, true);
      return { next: function () {}, prev: function () {}, go: function () {}, stop: function () {}, start: function () {} };
    }

    setEmptyState(root, false);
    opts = opts || {};
    const autoplay = opts.autoplay !== false;
    const interval = opts.interval || 5200;
    const n = testimonials.length;
    let active = 0;
    let timer = null;
    let userPaused = false;

    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const icon = (name, cls) =>
      '<svg class="icon' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';

    /* rotation aléatoire entre -10 et 10 degrés (identique à randomRotateY) */
    const randomRotate = () => Math.floor(Math.random() * 21) - 10;

    root.classList.add("at");
    root.setAttribute("role", "region");
    if (!root.hasAttribute("aria-label") && !root.hasAttribute("aria-labelledby")) {
      root.setAttribute("aria-label", "Témoignages clients");
    }
    root.innerHTML =
      '<div class="at-grid">' +
        '<div class="at-stack" id="' + root.id + '-stack">' +
          testimonials.map(function (t, i) {
            return '<div class="at-card" data-i="' + i + '" aria-hidden="' + (i === 0 ? "false" : "true") + '"><img src="' + escapeAttr(t.src) + '" alt="' + escapeAttr(t.name) + '" draggable="false"></div>';
          }).join("") +
        "</div>" +
        '<div class="at-body">' +
          "<div>" +
            '<h3 class="at-name"></h3>' +
            '<p class="at-role"></p>' +
            '<p class="at-quote"></p>' +
            '<p class="sr-only at-status" aria-live="polite" aria-atomic="true"></p>' +
          "</div>" +
          '<div class="at-nav">' +
            '<button class="at-prev" aria-label="Témoignage précédent">' + icon("arrow-back") + "</button>" +
            '<button class="at-next" aria-label="Témoignage suivant">' + icon("arrow-forward") + "</button>" +
            (autoplay && !reduce ? '<button class="at-toggle" type="button" aria-label="Mettre le défilement en pause">Pause</button>' : "") +
            '<div class="at-dots" aria-hidden="true">' + testimonials.map(() => "<span></span>").join("") + "</div>" +
          "</div>" +
        "</div>" +
      "</div>";

    const cards = Array.prototype.slice.call(root.querySelectorAll(".at-card"));
    const nameEl = root.querySelector(".at-name");
    const roleEl = root.querySelector(".at-role");
    const quoteEl = root.querySelector(".at-quote");
    const statusEl = root.querySelector(".at-status");
    const toggleEl = root.querySelector(".at-toggle");
    const dots = Array.prototype.slice.call(root.querySelectorAll(".at-dots span"));

    /* état courant de chaque carte, pour animer depuis la bonne position */
    const state = cards.map(() => ({ z: -100, rot: randomRotate(), scale: 0.95, opacity: 0.7, y: 0 }));

    function tf(s) {
      return "translateZ(" + s.z + "px) translateY(" + s.y + "px) rotate(" + s.rot + "deg) scale(" + s.scale + ")";
    }

    function renderStack() {
      cards.forEach(function (card, i) {
        const isActive = i === active;
        const from = state[i];
        const to = {
          z: isActive ? 0 : -100,
          rot: isActive ? 0 : randomRotate(),
          scale: isActive ? 1 : 0.95,
          opacity: isActive ? 1 : 0.7,
          y: 0,
        };
        card.style.zIndex = isActive ? 40 : n + 2 - i;
        card.setAttribute("aria-hidden", isActive ? "false" : "true");

        if (reduce || typeof card.animate !== "function") {
          card.style.transform = tf(to);
          card.style.opacity = to.opacity;
          state[i] = to;
          return;
        }

        /* l'image active fait un petit saut : y = [0, -80, 0] */
        const frames = isActive
          ? [
              { transform: tf(from), opacity: from.opacity },
              {
                transform: tf({ z: to.z / 2, rot: (from.rot + to.rot) / 2, scale: (from.scale + to.scale) / 2, y: -80 }),
                opacity: (from.opacity + to.opacity) / 2,
                offset: 0.5,
              },
              { transform: tf(to), opacity: to.opacity },
            ]
          : [
              { transform: tf(from), opacity: from.opacity },
              { transform: tf(to), opacity: to.opacity },
            ];

        card.animate(frames, { duration: 400, easing: "ease-in-out", fill: "forwards" });
        state[i] = to;
      });
    }

    function renderText() {
      const t = testimonials[active];

      /* nom + rôle : glissent de 20px vers le haut en apparaissant */
      [nameEl, roleEl].forEach(function (el, k) {
        el.textContent = String(k === 0 ? (t.name || "") : (t.designation || ""));
        if (reduce || typeof el.animate !== "function") return;
        el.animate(
          [{ transform: "translateY(20px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }],
          { duration: 200, easing: "ease-in-out", fill: "backwards" }
        );
      });
      statusEl.textContent = [t.name, t.designation, t.quote].filter(Boolean).join(". ");

      /* citation : chaque mot apparaît avec un flou, décalé de 20 ms */
      quoteEl.textContent = "";
      String(t.quote || "").split(/\s+/).filter(Boolean).forEach(function (word) {
        var span = document.createElement("span");
        span.className = "w";
        span.textContent = word + " ";
        quoteEl.appendChild(span);
      });
      if (reduce) return;
      Array.prototype.forEach.call(quoteEl.querySelectorAll(".w"), function (span, i) {
        if (typeof span.animate !== "function") return;
        span.animate(
          [
            { filter: "blur(10px)", opacity: 0, transform: "translateY(5px)" },
            { filter: "blur(0px)", opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 200, easing: "ease-in-out", delay: 20 * i, fill: "backwards" }
        );
      });
    }

    function renderDots() {
      dots.forEach((d, i) => d.classList.toggle("on", i === active));
    }

    function go(i) {
      active = (i + n) % n;
      renderStack();
      renderText();
      renderDots();
    }
    const next = () => go(active + 1);
    const prev = () => go(active - 1);

    root.querySelector(".at-next").addEventListener("click", () => { next(); restart(); });
    root.querySelector(".at-prev").addEventListener("click", () => { prev(); restart(); });
    cards.forEach((c) => c.addEventListener("click", () => { go(Number(c.dataset.i)); restart(); }));

    /* navigation au clavier quand le composant a le focus */
    root.setAttribute("tabindex", "0");
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { next(); restart(); }
      if (e.key === "ArrowLeft") { prev(); restart(); }
    });

    /* défilement auto, en pause au survol et hors écran */
    function syncToggle() {
      if (!toggleEl) return;
      toggleEl.textContent = userPaused ? "Reprendre" : "Pause";
      toggleEl.setAttribute("aria-label", userPaused ? "Reprendre le défilement" : "Mettre le défilement en pause");
      toggleEl.setAttribute("aria-pressed", userPaused ? "true" : "false");
    }
    function start() {
      if (!autoplay || reduce || userPaused || timer !== null) return;
      timer = setInterval(next, interval);
    }
    function stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
    }
    function restart() { stop(); start(); }
    if (toggleEl) {
      toggleEl.addEventListener("click", function () {
        userPaused = !userPaused;
        if (userPaused) stop();
        else start();
        syncToggle();
      });
      syncToggle();
    }
    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
    root.addEventListener("focusin", stop);
    root.addEventListener("focusout", start);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach((e) => (e.isIntersecting ? start() : stop()));
      }, { threshold: 0.25 }).observe(root);
    } else start();

    /* état initial */
    cards.forEach(function (card, i) {
      card.style.transform = tf(state[i]);
      card.style.opacity = state[i].opacity;
    });
    go(0);

    return { next: next, prev: prev, go: go, stop: stop, start: start };
  }

  window.AnimatedTestimonials = AnimatedTestimonials;

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-animated-testimonials]").forEach(function (el) {
      AnimatedTestimonials(el, window.TESTIMONIALS || [], { autoplay: el.dataset.autoplay !== "false" });
    });
  });
})();
