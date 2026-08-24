/* ===========================================================
   Navbar Menu — portage vanilla du composant Aceternity UI
   ui.aceternity.com/components/navbar-menu

   L'effet clé du composant original est le `layoutId="active"` de
   Framer Motion : une SEULE carte, partagée entre tous les items du
   menu, qui se déplace et se redimensionne en ressort quand on passe
   d'un item à l'autre — au lieu de disparaître puis réapparaître.
   Reproduit ici en FLIP + Web Animations API, avec le ressort exact
   du composant (mass 0.5 · damping 11.5 · stiffness 100).
   =========================================================== */
(function () {
  "use strict";

  function localFragment(id) {
    const slug = document.body && document.body.dataset.productSlug;
    return (slug ? "produits/" + encodeURIComponent(slug) + ".html" : "") + "#" + id;
  }
  const ic = (name, cls) =>
    '<svg class="icon' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="' + localFragment("i-" + name) + '"></use></svg>';

  /* ---------- Contenu des menus ---------- */
  function leaguePanel() {
    const L = window.LEAGUES || {};
    const P = window.PRODUCTS || [];
    const entries = Object.entries(L);
    if (!entries.length) return '<div class="am-links"><a href="shop.html">Toute la boutique</a></div>';
    return (
      '<div class="am-products">' +
      entries.map(function ([key, info]) {
        const count = P.filter((p) => p.league === key).length;
        return (
          '<a class="am-product" href="shop.html?league=' + key + '">' +
            '<span class="thumb" style="background:' + info.color + '">' + ic("soccer", "icon-lg") +
              (info.logo ? '<img class="league-logo-img" src="' + info.logo + '" alt="" loading="lazy" onerror="this.remove()">' : "") +
            "</span>" +
            "<div><h4>" + info.label + "</h4>" +
            "<p>" + count + " maillot" + (count > 1 ? "s" : "") + " en catalogue, saison 2026/2027</p></div>" +
          "</a>"
        );
      }).join("") +
      "</div>"
    );
  }

  const MENUS = [
    { id: "boutique", label: "Boutique", panel: function () {
        const verified = !!(window.SITE && window.SITE.catalogDataVerified === true);
        return '<div class="am-links">' +
          '<a href="shop.html">' + ic("grid", "icon-sm") + "Tout le catalogue</a>" +
          (verified
            ? '<a href="shop.html?promo=1">' + ic("percent", "icon-sm") + "Maillots en promotion</a>" +
              '<a href="shop.html?stock=1">' + ic("check-circle", "icon-sm") + "Disponibles immédiatement</a>"
            : '<a href="shop.html">' + ic("info", "icon-sm") + "Prix et disponibilités à confirmer</a>") +
          '<div class="am-sep"></div>' +
          '<a href="https://wa.me/237655634265" target="_blank" rel="noopener">' + ic("chat", "icon-sm") + "Commander sur WhatsApp</a>" +
          "</div>";
      } },
    { id: "championnats", label: "Championnats", panel: leaguePanel },
    { id: "aide", label: "Aide", panel: function () {
        return '<div class="am-links">' +
          '<a href="index.html#faq">' + ic("info", "icon-sm") + "Questions fréquentes</a>" +
          '<a href="index.html#faq">' + ic("shipping", "icon-sm") + "Livraison &amp; paiement</a>" +
          '<a href="index.html#faq">' + ic("ruler", "icon-sm") + "Guide des tailles</a>" +
          '<a href="index.html#faq">' + ic("swap", "icon-sm") + "Retours &amp; échanges</a>" +
          '<div class="am-sep"></div>' +
          '<a href="index.html#contact">' + ic("person", "icon-sm") + "Nous contacter</a>" +
          "</div>";
      } },
  ];

  const PLAIN = [
    { href: "index.html", label: "Accueil", icon: "storefront" },
    { href: "phototheque.html", label: "Photothèque", icon: "photo-library" },
  ];

  function init() {
    const shell = document.querySelector(".am-shell");
    if (!shell) return;

    const itemsWrap = shell.querySelector(".am-items");
    const card = shell.querySelector(".am-card");
    const inner = card.querySelector(".am-card-inner");
    const ghost = shell.querySelector(".am-ghost");
    card.id = card.id || "desktopMenuPanel";
    const page = (location.pathname.split("/").pop() || "index.html");

    /* liens simples + items à menu */
    itemsWrap.innerHTML =
      PLAIN.slice(0, 1).map((l) =>
        '<div class="am-item"><a class="am-trigger' + (page === l.href ? " current" : "") + '" href="' + l.href + '">' + l.label + "</a></div>"
      ).join("") +
      MENUS.map((m) =>
        '<div class="am-item" data-menu="' + m.id + '">' +
          '<button class="am-trigger" aria-haspopup="true" aria-expanded="false">' + m.label +
            ic("expand", "icon-sm chev") +
          "</button>" +
        "</div>"
      ).join("") +
      PLAIN.slice(1).map((l) =>
        '<div class="am-item"><a class="am-trigger' + (page === l.href ? " current" : "") + '" href="' + l.href + '">' + l.label + "</a></div>"
      ).join("");

    const items = Array.prototype.slice.call(itemsWrap.querySelectorAll(".am-item[data-menu]"));
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SPRING = getComputedStyle(document.documentElement).getPropertyValue("--am-spring").trim() || "ease-out";
    const DUR = 616;

    let openId = null;
    let closeTimer = null;
    let box = { x: 0, w: 0, h: 0 };   // position/taille courantes de la carte

    /* mesure la taille naturelle d'un contenu sans l'afficher */
    function measure(html) {
      ghost.innerHTML = html;
      const r = ghost.getBoundingClientRect();
      const size = { w: Math.ceil(r.width), h: Math.ceil(r.height) };
      ghost.innerHTML = "";
      return size;
    }

    function openMenu(id) {
      clearTimeout(closeTimer);
      const menu = MENUS.find((m) => m.id === id);
      const item = items.find((el) => el.dataset.menu === id);
      if (!menu || !item) return;

      const html = menu.panel();
      const size = measure(html);

      /* centre la carte sous l'item survolé, sans déborder de la barre */
      const shellBox = shell.getBoundingClientRect();
      const itemBox = item.getBoundingClientRect();
      let x = itemBox.left - shellBox.left + itemBox.width / 2 - size.w / 2;
      x = Math.max(0, Math.min(x, shellBox.width - size.w));

      const first = openId !== null;   // déjà ouverte -> on la transforme (layoutId)
      items.forEach((el) => {
        const on = el.dataset.menu === id;
        el.classList.toggle("open", on);
        const t = el.querySelector(".am-trigger");
        t.classList.toggle("active", on);
        t.setAttribute("aria-expanded", on ? "true" : "false");
      });
      openId = id;

      if (!first) {
        /* première ouverture : opacity 0→1, scale .85→1, y 10→0 */
        inner.innerHTML = html;
        card.style.width = size.w + "px";
        card.style.height = size.h + "px";
        card.style.transform = "translateX(" + x + "px) translateY(10px) scale(.85)";
        card.classList.add("open");
        requestAnimationFrame(function () {
          card.style.transform = "translateX(" + x + "px) translateY(0) scale(1)";
        });
        box = { x: x, w: size.w, h: size.h };
        return;
      }

      /* transformation d'un item à l'autre : la carte glisse et se redimensionne */
      if (reduce || typeof card.animate !== "function") {
        inner.innerHTML = html;
        card.style.width = size.w + "px";
        card.style.height = size.h + "px";
        card.style.transform = "translateX(" + x + "px)";
        box = { x: x, w: size.w, h: size.h };
        return;
      }

      card.classList.add("morphing");
      card.animate(
        [
          { transform: "translateX(" + box.x + "px)", width: box.w + "px", height: box.h + "px" },
          { transform: "translateX(" + x + "px)", width: size.w + "px", height: size.h + "px" },
        ],
        { duration: DUR, easing: SPRING, fill: "forwards" }
      );
      /* le contenu est échangé au milieu du mouvement, en fondu */
      setTimeout(function () {
        if (openId !== id) return;
        inner.innerHTML = html;
        card.classList.remove("morphing");
      }, 130);

      card.style.width = size.w + "px";
      card.style.height = size.h + "px";
      card.style.transform = "translateX(" + x + "px)";
      box = { x: x, w: size.w, h: size.h };
    }

    function closeMenu() {
      openId = null;
      card.classList.remove("open", "morphing");
      card.style.transform = card.style.transform.replace(/translateY\([^)]*\)\s*scale\([^)]*\)/, "") +
                             " translateY(10px) scale(.85)";
      items.forEach((el) => {
        el.classList.remove("open");
        const t = el.querySelector(".am-trigger");
        t.classList.remove("active");
        t.setAttribute("aria-expanded", "false");
      });
    }

    /* survol : ouvre / transforme. Sortie de la barre entière : ferme. */
    items.forEach(function (el) {
      const id = el.dataset.menu;
      const trigger = el.querySelector(".am-trigger");
      trigger.setAttribute("aria-controls", card.id);
      trigger.setAttribute("aria-haspopup", "true");
      el.addEventListener("mouseenter", () => openMenu(id));
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        openId === id ? closeMenu() : openMenu(id);
      });
      trigger.addEventListener("focus", () => openMenu(id));
      trigger.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowDown") return;
        event.preventDefault();
        openMenu(id);
        setTimeout(function () {
          const firstLink = inner.querySelector("a[href]");
          if (firstLink) firstLink.focus();
        }, 160);
      });
    });
    itemsWrap.querySelectorAll(".am-item:not([data-menu]) .am-trigger").forEach(function (a) {
      a.addEventListener("mouseenter", closeMenu);
    });

    shell.addEventListener("mouseleave", function () {
      closeTimer = setTimeout(closeMenu, 120);
    });
    shell.addEventListener("mouseenter", () => clearTimeout(closeTimer));
    card.addEventListener("mouseenter", () => clearTimeout(closeTimer));
    shell.addEventListener("focusout", function (event) {
      const next = event.relatedTarget;
      if (next && shell.contains(next)) return;
      closeMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !openId) return;
      const currentId = openId;
      closeMenu();
      const trigger = shell.querySelector('[data-menu="' + currentId + '"] .am-trigger');
      if (trigger) trigger.focus();
    });
    window.addEventListener("scroll", function () { if (openId) closeMenu(); }, { passive: true });
    window.addEventListener("resize", function () { if (openId) closeMenu(); });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
