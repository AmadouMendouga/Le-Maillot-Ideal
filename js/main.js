/* ===========================================================
   Le Maillot Idéal — logique front-end
   Comportements repris de flutter_billing_app :
   panier + facture WhatsApp, badges de stock, thème clair/sombre,
   SnackBar flottant, barre d'action basse.
   =========================================================== */
(function () {
  "use strict";

  const DEFAULT_WHATSAPP_NUMBER = "237655634265";
  const DEFAULT_FREE_SHIPPING_THRESHOLD = 15000;
  const MAX_UNVERIFIED_QTY = 99;
  const FCFA = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString("fr-FR") + " FCFA";
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  function localFragment(id) {
    const slug = document.body && document.body.dataset.productSlug;
    return (slug ? "produits/" + encodeURIComponent(slug) + ".html" : "") + "#" + id;
  }
  const ic = (name, cls) =>
    '<svg class="icon' + (cls ? " " + esc(cls) : "") + '" aria-hidden="true"><use href="' + esc(localFragment("i-" + name)) + '"></use></svg>';
  const leagueBadgeInner = (info, iconCls) =>
    ic("soccer", iconCls) +
    (info.logo
      ? '<img class="league-logo-img" src="' + esc(info.logo) + '" alt="" loading="lazy" onerror="this.remove()">'
      : "");

  const PRODUCTS = window.PRODUCTS || [];
  const LEAGUES = window.LEAGUES || {};

  function siteConfig() { return window.SITE || {}; }
  function whatsappNumber() {
    const configured = String(siteConfig().whatsapp || "").replace(/\D/g, "");
    return configured || DEFAULT_WHATSAPP_NUMBER;
  }
  function freeShippingThreshold() {
    const configured = Number(siteConfig().freeShippingThreshold);
    return Number.isFinite(configured) && configured >= 0
      ? configured
      : DEFAULT_FREE_SHIPPING_THRESHOLD;
  }
  function catalogDataVerified() { return siteConfig().catalogDataVerified === true; }
  function commercialTermsVerified() { return siteConfig().commercialTermsVerified === true; }
  function catalogNoticeHTML() {
    return catalogDataVerified()
      ? ""
      : '<p class="form-note">Prix/stock indicatifs, à confirmer sur WhatsApp.</p>';
  }
  function publicProductDescription(product) {
    if (catalogDataVerified() && product && product.description) return String(product.description);
    const name = product && product.name ? String(product.name) : "Maillot";
    const season = product && product.season ? ", saison " + String(product.season) : "";
    return name + season + ". Caractéristiques, prix, tailles et disponibilité à confirmer sur WhatsApp.";
  }
  function productForSlug(slug) { return PRODUCTS.find((p) => p.slug === slug); }
  function productStock(product) {
    if (!catalogDataVerified()) return MAX_UNVERIFIED_QTY;
    return product && Number.isFinite(Number(product.stock))
      ? Math.max(0, Math.floor(Number(product.stock)))
      : 0;
  }
  function safeColor(value) {
    const color = String(value || "");
    return /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#6259f5";
  }

  /* ---------------- Thème (AppTheme light / dark) ---------------- */
  const THEME_KEY = "lmi_theme";
  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
  }
  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
    $$(".theme-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        applyTheme(next);
        showToast(next === "dark" ? "Thème sombre activé" : "Thème clair activé", "dark-mode");
      });
    });
  }

  /* ---------------- Navigation mobile ---------------- */
  function initNav() {
    const toggle = $(".nav-toggle");
    const nav = $(".main-nav");
    const backdrop = $(".nav-backdrop");
    const header = $(".site-header");

    if (header) {
      const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
    if (!toggle || !nav) return;
    nav.id = nav.id || "mobileNav";
    nav.setAttribute("aria-hidden", "true");
    nav.inert = true;
    toggle.setAttribute("aria-controls", nav.id);
    const close = (restoreFocus) => {
      const wasOpen = nav.classList.contains("open");
      nav.classList.remove("open");
      nav.setAttribute("aria-hidden", "true");
      nav.inert = true;
      backdrop && backdrop.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Ouvrir le menu");
      if (wasOpen && restoreFocus !== false) toggle.focus();
    };
    const open = () => {
      nav.inert = false;
      nav.classList.add("open");
      nav.setAttribute("aria-hidden", "false");
      backdrop && backdrop.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Fermer le menu");
      requestAnimationFrame(function () {
        const firstLink = $("a", nav);
        if (firstLink) firstLink.focus();
      });
    };
    toggle.addEventListener("click", () => (nav.classList.contains("open") ? close(true) : open()));
    backdrop && backdrop.addEventListener("click", () => close(true));
    $$(".main-nav a").forEach((a) => a.addEventListener("click", () => close(false)));
    document.addEventListener("keydown", (e) => {
      if (!nav.classList.contains("open")) return;
      if (e.key === "Escape") { e.preventDefault(); close(true); return; }
      if (e.key !== "Tab") return;
      const links = $$("a[href], button:not([disabled])", nav).filter((el) => el.getClientRects().length > 0);
      const focusable = [toggle].concat(links);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    if (window.matchMedia) {
      const mobile = window.matchMedia("(max-width: 1040px)");
      const onViewportChange = (event) => { if (!event.matches) close(false); };
      if (mobile.addEventListener) mobile.addEventListener("change", onViewportChange);
      else if (mobile.addListener) mobile.addListener(onViewportChange);
    }
  }

  /* ---------------- Stock (product_list_page.dart) ---------------- */
  function stockInfo(p) {
    if (!catalogDataVerified()) {
      return { cls: "badge-stock-low", label: "Disponibilité à confirmer", icon: "info", available: true };
    }
    const s = p && Number.isFinite(Number(p.stock))
      ? Math.max(0, Math.floor(Number(p.stock)))
      : 0;
    if (s === 0) return { cls: "badge-stock-out", label: "Rupture de stock", icon: "error", available: false };
    if (s <= 5) return { cls: "badge-stock-low", label: "Plus que " + s + " en stock", icon: "hourglass", available: true };
    return { cls: "badge-stock-ok", label: "En stock", icon: "check-circle", available: true };
  }

  /* ---------------- Panier (localStorage) ---------------- */
  const CART_KEY = "lmi_cart_v3";
  const LEGACY_CART_KEYS = ["lmi_cart_v2", "lmi_cart"];

  function normalizeCart(raw) {
    if (!Array.isArray(raw)) return [];
    const normalized = [];
    const usedBySlug = Object.create(null);

    raw.forEach(function (item) {
      if (!item || typeof item !== "object" || typeof item.slug !== "string") return;
      const slug = item.slug.trim();
      const product = productForSlug(slug);
      if (!product) return;

      const size = typeof item.size === "string" ? item.size.trim() : "";
      const sizes = Array.isArray(product.sizes) ? product.sizes.map(String) : [];
      if (!size || !sizes.includes(size)) return;

      const requestedQty = Math.floor(Number(item.qty));
      if (!Number.isFinite(requestedQty) || requestedQty < 1) return;

      const remaining = productStock(product) - (usedBySlug[slug] || 0);
      if (remaining < 1) return;
      const qty = Math.min(requestedQty, remaining);
      const existing = normalized.find((entry) => entry.slug === slug && entry.size === size);
      if (existing) existing.qty += qty;
      else normalized.push({ slug: slug, size: size, qty: qty });
      usedBySlug[slug] = (usedBySlug[slug] || 0) + qty;
    });

    return normalized;
  }

  function writeCart(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      LEGACY_CART_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch (e) {}
  }

  function getCart() {
    try {
      let sourceKey = CART_KEY;
      let raw = localStorage.getItem(CART_KEY);
      if (raw == null) {
        sourceKey = LEGACY_CART_KEYS.find((key) => localStorage.getItem(key) != null) || CART_KEY;
        raw = localStorage.getItem(sourceKey);
      }
      if (raw == null) return [];

      let parsed;
      let parseFailed = false;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = []; parseFailed = true; }
      const normalized = normalizeCart(parsed);
      if (parseFailed || sourceKey !== CART_KEY || JSON.stringify(parsed) !== JSON.stringify(normalized)) writeCart(normalized);
      return normalized;
    } catch (e) {
      return [];
    }
  }
  function saveCart(cart) {
    const normalized = normalizeCart(cart);
    writeCart(normalized);
    updateCartBadge();
    return normalized;
  }
  function cartDetails(cart) {
    return (cart || getCart()).map(function (item) {
      return { slug: item.slug, size: item.size, qty: item.qty, product: productForSlug(item.slug) };
    }).filter((item) => !!item.product);
  }
  function addToCart(slug, size, qty, srcEl) {
    const product = productForSlug(slug);
    if (!product) return false;
    const st = stockInfo(product);
    if (!st.available) { showToast(product.name + " est en rupture de stock", "error", true); return false; }

    size = String(size || "").trim();
    qty = Math.floor(Number(qty));
    if (!Array.isArray(product.sizes) || !product.sizes.map(String).includes(size) || !Number.isFinite(qty) || qty < 1) {
      showToast("Choisissez une taille et une quantité valides", "error", true);
      return false;
    }

    const cart = getCart();
    const existing = cart.find((i) => i.slug === slug && i.size === size);
    const inCart = cart.filter((i) => i.slug === slug).reduce((sum, item) => sum + item.qty, 0);
    const max = productStock(product);
    if (inCart + qty > max) {
      showToast("Stock limité : " + max + " disponible(s) pour " + product.name, "error", true);
      return false;
    }
    if (existing) existing.qty += qty;
    else cart.push({ slug: slug, size: size, qty: qty });
    saveCart(cart);
    renderCart(true);
    if (srcEl) animateAdd(srcEl, product);
    else showToast(product.name + " (" + size + ") ajouté au panier", "check-circle");
    return true;
  }

  function removeFromCart(index) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
    renderCart(false);
  }
  function changeQty(index, delta) {
    const cart = getCart();
    if (!cart[index]) return;
    const product = productForSlug(cart[index].slug);
    if (!product) return;
    const max = productStock(product);
    const next = cart[index].qty + delta;
    const otherSizesQty = cart.reduce((sum, item, itemIndex) =>
      sum + (itemIndex !== index && item.slug === cart[index].slug ? item.qty : 0), 0);
    if (otherSizesQty + next > max) { showToast("Stock limité : " + max + " disponible(s)", "error", true); return; }
    cart[index].qty = Math.max(1, next);
    saveCart(cart);
    renderCart(false);
  }
  function updateCartBadge() {
    const count = getCart().reduce((s, i) => s + i.qty, 0);
    $$(".cart-count").forEach((el) => (el.textContent = count));
  }
  function cartTotal() {
    return cartDetails().reduce((sum, item) => sum + Number(item.product.price || 0) * item.qty, 0);
  }
  /* ---------- Barre flottante + panneau (voir vidéo de référence) ---------- */
  let deliveryTimer = null;

  function cartCount() { return getCart().reduce((s, i) => s + i.qty, 0); }

  function renderCart(bump) {
    const cart = getCart();
    const details = cartDetails(cart);
    const bar = $("#cartBar");
    const panel = $("#cartPanel");
    updateCartBadge();

    /* --- la barre --- */
    if (bar) {
      if (cart.length === 0) {
        bar.classList.remove("show");
        bar.setAttribute("aria-expanded", "false");
        document.body.classList.remove("cart-bar-visible");
        if (panel) {
          panel.classList.remove("open");
          panel.setAttribute("aria-hidden", "true");
        }
      } else {
        const panelOpen = !!(panel && panel.classList.contains("open"));
        document.body.classList.toggle("cart-bar-visible", !panelOpen);
        const thumbs = details.slice(0, 3).map((item) =>
          '<img src="' + esc(item.product.image) + '" alt="">').join("") +
          (cart.length > 3 ? '<span class="more">+' + (cart.length - 3) + "</span>" : "");
        const n = cartCount();
        $("#cartBarThumbs").innerHTML = thumbs;
        $("#cartBarCount").textContent = n + (n > 1 ? " articles" : " article");
        if (panelOpen) {
          bar.classList.remove("show");
        } else if (!bar.classList.contains("show")) {
          bar.classList.add("show");
        } else if (bump) {
          bar.classList.remove("bump");
          void bar.offsetWidth;
          bar.classList.add("bump");
        }
      }
    }

    /* --- le panneau --- */
    const items = $("#cartPanelItems");
    if (items) {
      items.innerHTML = cart.length === 0
        ? '<div class="cart-empty">' + ic("basket") + "<div>Votre panier est vide.</div></div>"
        : details.map(function (item, idx) {
            const product = item.product;
            return (
              '<div class="cp-item">' +
                '<img src="' + esc(product.image) + '" alt="">' +
                '<div class="cp-info">' +
                  '<div class="cp-cat">' + esc(product.leagueLabel || "Maillot") + " · " + esc(item.size) + "</div>" +
                  '<div class="cp-name">' + esc(product.name) + "</div>" +
                  '<div class="cp-qty">' +
                    '<button type="button" data-act="dec" data-idx="' + idx + '" aria-label="Diminuer la quantité de ' + esc(product.name) + '">' + ic("remove", "icon-sm") + "</button>" +
                    "<span>" + item.qty + "</span>" +
                    '<button type="button" data-act="inc" data-idx="' + idx + '" aria-label="Augmenter la quantité de ' + esc(product.name) + '">' + ic("add", "icon-sm") + "</button>" +
                    '<button type="button" data-act="rm" data-idx="' + idx + '" aria-label="Retirer ' + esc(product.name) + ' du panier">' + ic("delete", "icon-sm") + "</button>" +
                  "</div>" +
                "</div>" +
                '<span class="cp-price">' + FCFA(Number(product.price || 0) * item.qty) + "</span>" +
              "</div>"
            );
          }).join("");
    }
    const chip = $("#cartPanelCount");
    if (chip) chip.textContent = cartCount();
    const sub = $("#cartSubtotal");
    if (sub) sub.textContent = FCFA(cartTotal());
    const subtotalLabel = $(".cp-subtotal span:first-child");
    if (subtotalLabel) subtotalLabel.textContent = catalogDataVerified() ? "Sous-total" : "Sous-total indicatif";
    const co = $("#cartCheckoutAmount");
    if (co) co.textContent = FCFA(cartTotal());
    const waBtn = $("#cartCheckout");
    if (waBtn) waBtn.href = buildWhatsappCartLink();
  }

  /* Vérification « livraison offerte » : shimmer puis résultat (comme la vidéo) */
  function runDeliveryCheck() {
    const el = $("#cartDelivery");
    if (!el) return;
    clearTimeout(deliveryTimer);
    if (!catalogDataVerified() || !commercialTermsVerified()) {
      el.className = "cp-delivery eligible";
      el.innerHTML = ic("info", "icon-sm") + "Frais et délais de livraison à confirmer sur WhatsApp";
      return;
    }
    el.className = "cp-delivery checking";
    el.textContent = "Vérification du seuil tarifaire…";
    deliveryTimer = setTimeout(function () {
      if (!catalogDataVerified() || !commercialTermsVerified()) {
        el.className = "cp-delivery eligible";
        el.innerHTML = ic("info", "icon-sm") + "Frais et délais de livraison à confirmer sur WhatsApp";
        return;
      }
      const threshold = freeShippingThreshold();
      const total = cartTotal();
      const free = total >= threshold;
      el.className = "cp-delivery eligible";
      el.innerHTML = free
        ? ic("check-circle", "icon-sm") + "Seuil tarifaire atteint — éligibilité selon la zone"
        : ic("shipping", "icon-sm") + "Plus que " + FCFA(Math.max(0, threshold - total)) + " pour atteindre le seuil tarifaire";
    }, 1400);
  }

  /* ---------- Vignette qui vole de la carte vers la barre ---------- */
  function animateAdd(srcEl, product) {
    const card = srcEl.closest(".product-card") || srcEl.closest(".pd-info") || srcEl.closest(".product-detail");
    const media = card ? card.querySelector(".product-media, .pd-media") : null;
    const img = media ? media.querySelector("img") : null;
    const bar = $("#cartBar");

    /* la carte se soulève */
    if (card && card.classList.contains("product-card")) {
      card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
      setTimeout(() => card.classList.remove("pop"), 600);
    }

    /* le bouton passe en « Ajouté » puis revient */
    if (srcEl.classList.contains("add-btn") && !srcEl.dataset.sbReady) {
      srcEl.classList.add("added");
      srcEl.innerHTML = ic("check-circle") + "Ajouté";
      clearTimeout(srcEl._t);
      srcEl._t = setTimeout(function () {
        srcEl.classList.remove("added");
        srcEl.innerHTML = ic("add") + "Ajouter";
      }, 1600);
    }

    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!img || !bar || reduce || typeof img.animate !== "function") {
      showToast(product.name + " ajouté au panier", "check-circle");
      return;
    }

    /* on fait voler une copie ronde de l'image jusqu'à la barre */
    /* l'image est zoomée à 1.15 dans le conteneur : on part du cadre visible */
    const from = media.getBoundingClientRect();
    if (!from.width) { showToast(product.name + " ajouté au panier", "check-circle"); return; }
    const barBox = bar.getBoundingClientRect();
    const toX = barBox.left + 34;
    const toY = barBox.top + barBox.height / 2;

    const fly = document.createElement("img");
    fly.src = img.currentSrc || img.src;
    fly.className = "fly-item";
    fly.alt = "";
    const size = Math.min(from.width, from.height);
    fly.style.width = size + "px";
    fly.style.height = size + "px";
    fly.style.left = (from.left + (from.width - size) / 2) + "px";
    fly.style.top = (from.top + (from.height - size) / 2) + "px";
    document.body.appendChild(fly);

    /* l'image quitte la carte */
    if (media) {
      media.classList.add("emptied");
      setTimeout(function () {
        media.classList.remove("emptied");
        media.classList.add("returning");
        setTimeout(() => media.classList.remove("returning"), 520);
      }, 430);
    }

    const dx = toX - (from.left + from.width / 2);
    const dy = toY - (from.top + from.height / 2);
    const scaleEnd = 30 / size;

    /* trajectoire en arc : le point médian remonte avant de redescendre */
    const anim = fly.animate(
      [
        { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
        { transform: "translate(" + dx * 0.45 + "px," + (dy * 0.28 - 70) + "px) scale(.62) rotate(-12deg)", opacity: 1, offset: .55 },
        { transform: "translate(" + dx + "px," + dy + "px) scale(" + scaleEnd + ") rotate(6deg)", opacity: .55, offset: 1 },
      ],
      { duration: 720, easing: "cubic-bezier(.4,.05,.35,1)", fill: "forwards" }
    );
    anim.onfinish = function () {
      fly.remove();
      bar.classList.remove("bump"); void bar.offsetWidth; bar.classList.add("bump");
    };
  }

  /* Facture WhatsApp — même structure que InvoiceMessageBuilder */
  function buildWhatsappCartLink() {
    const cart = cartDetails();
    let msg = "*Le Maillot Idéal* — nouvelle commande\n\n";
    cart.forEach((item) => {
      msg += "• " + item.qty + " x " + item.product.name + " (taille " + item.size + ") — " +
        FCFA(Number(item.product.price || 0) * item.qty) + "\n";
    });
    msg += "\n*" + (catalogDataVerified() ? "Total" : "Total indicatif") + " : " + FCFA(cartTotal()) + "*\n";
    if (!catalogDataVerified()) msg += "Prix/stock indicatifs, à confirmer sur WhatsApp.\n";
    msg += commercialTermsVerified()
      ? "Paiement et livraison selon les modalités applicables à votre zone.\n\n"
      : "Modalités de paiement et de livraison à confirmer sur WhatsApp.\n\n";
    msg += "Merci de me confirmer la disponibilité et le délai de livraison.";
    return "https://wa.me/" + whatsappNumber() + "?text=" + encodeURIComponent(msg);
  }
  function initCart() {
    const bar = $("#cartBar");
    const panel = $("#cartPanel");
    if (!bar || !panel) return;
    const closeButton = $("#cartPanelClose");
    const panelItems = $("#cartPanelItems");
    const checkout = $("#cartCheckout");
    let lastCartFocus = null;

    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("tabindex", "-1");
    bar.setAttribute("aria-controls", "cartPanel");
    bar.setAttribute("aria-expanded", "false");
    $$(".cart-btn").forEach(function (button) {
      button.setAttribute("aria-controls", "cartPanel");
      button.setAttribute("aria-expanded", "false");
    });

    function setCartExpanded(expanded) {
      bar.setAttribute("aria-expanded", expanded ? "true" : "false");
      $$(".cart-btn").forEach((button) => button.setAttribute("aria-expanded", expanded ? "true" : "false"));
    }

    const openPanel = function (trigger) {
      lastCartFocus = trigger && trigger.nodeType === 1 ? trigger : document.activeElement;
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
      setCartExpanded(true);
      bar.classList.remove("show");
      document.body.classList.remove("cart-bar-visible");
      runDeliveryCheck();
      requestAnimationFrame(function () { (closeButton || panel).focus(); });
    };
    const closePanel = function (restoreFocus) {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
      setCartExpanded(false);
      if (getCart().length) {
        bar.classList.add("show");
        document.body.classList.add("cart-bar-visible");
      }
      if (restoreFocus !== false) {
        let target = lastCartFocus;
        if (!target || !target.isConnected || (target === bar && getCart().length === 0)) target = $(".cart-btn");
        if (target && typeof target.focus === "function") target.focus();
      }
    };

    bar.addEventListener("click", () => openPanel(bar));
    $$(".cart-btn").forEach((b) => b.addEventListener("click", function () {
      if (getCart().length === 0) { showToast("Votre panier est vide", "basket"); return; }
      openPanel(b);
    }));
    closeButton && closeButton.addEventListener("click", () => closePanel(true));
    document.addEventListener("keydown", function (e) {
      if (!panel.classList.contains("open")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel(true);
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = $$(
        'a[href]:not([aria-disabled="true"]), button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        panel
      ).filter((el) => !el.hidden);
      if (!focusable.length) { e.preventDefault(); panel.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (!panel.classList.contains("open")) return;
      /* +/- dans le panneau réécrit #cartPanelItems pendant que le clic remonte encore :
         le bouton cliqué est alors détaché du DOM et panel.contains(e.target) ment.
         composedPath() capture le chemin au moment du clic, avant toute mutation. */
      const path = typeof e.composedPath === "function" ? e.composedPath() : [e.target];
      const insideCart = path.some(function (el) {
        return el === panel || el === bar ||
          (el.classList && (el.classList.contains("cart-btn") || el.classList.contains("quick-add"))) ||
          el.id === "addToCartBtn";
      });
      if (insideCart) return;
      closePanel(true);
    });

    panelItems && panelItems.addEventListener("click", function (e) {
      const btn = e.target.closest("button");
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      const action = btn.dataset.act;
      if (action === "inc") changeQty(idx, 1);
      if (action === "dec") changeQty(idx, -1);
      if (action === "rm") removeFromCart(idx);
      runDeliveryCheck();
      const remaining = getCart();
      if (remaining.length === 0) { closePanel(true); return; }
      requestAnimationFrame(function () {
        const nextIndex = Math.min(idx, remaining.length - 1);
        const target = panelItems.querySelector('button[data-act="' + action + '"][data-idx="' + nextIndex + '"]') || closeButton;
        if (target) target.focus();
      });
    });

    checkout && checkout.addEventListener("click", function (e) {
      if (getCart().length === 0) { e.preventDefault(); showToast("Votre panier est vide", "error", true); return; }
    });

    renderCart(false);
  }

  /* ---------------- SnackBar flottant ---------------- */
  let toastTimer;
  function showToast(text, iconName, isError) {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.setAttribute("role", isError ? "alert" : "status");
    el.setAttribute("aria-live", isError ? "assertive" : "polite");
    el.className = "toast" + (isError ? " error" : "");
    el.innerHTML = ic(iconName || "check-circle");
    const label = document.createElement("span");
    label.textContent = String(text == null ? "" : text);
    el.appendChild(label);
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  /* ---------------- Carte produit ---------------- */
  function ratingHTML(p) {
    const parsedRating = p.rating;
    const reviews = Number.isFinite(Number(p.reviews)) ? Math.max(0, Math.floor(Number(p.reviews))) : 0;
    if (typeof parsedRating !== "number" || !Number.isFinite(parsedRating) || reviews <= 0) return "";
    const r = Math.max(0, Math.min(5, parsedRating));
    let out = "";
    for (let i = 1; i <= 5; i++) {
      const on = i <= Math.round(r);
      out += '<svg class="icon' + (on ? "" : " off") + '" aria-hidden="true"><use href="' +
        esc(localFragment("i-" + (on ? "star-fill" : "star"))) + '"></use></svg>';
    }
    return '<div class="product-rating"><span class="rstars">' + out + "</span>" +
           "<span>" + r.toFixed(1) + " (" + reviews + ")</span></div>";
  }

  function productCardHTML(p) {
    const st = stockInfo(p);
    const verified = catalogDataVerified();
    const slug = String(p.slug || "");
    const productHref = productPagePath(p);
    return (
      '<article class="product-card" data-slug="' + esc(slug) + '">' +
        '<a class="product-media dah" href="' + esc(productHref) + '" aria-label="Voir ' + esc(p.name) + '">' +
          '<div class="product-badges">' +
            (verified && p.isNew ? '<span class="badge badge-new">' + ic("bolt", "icon-sm") + "Nouveau</span>" : "") +
            (verified && Number(p.discountPct) > 0 ? '<span class="badge badge-promo">' + ic("percent", "icon-sm") + "-" + Math.max(0, Math.round(Number(p.discountPct))) + "%</span>" : "") +
            (!st.available ? '<span class="badge badge-stock-out">' + ic("error", "icon-sm") + "Rupture</span>" : "") +
          "</div>" +
          '<div class="dah-img"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + ", saison " + esc(p.season) + '" loading="lazy" width="300" height="300"></div>' +
          '<div class="dah-overlay"></div>' +
          '<div class="dah-caption">' +
            '<p class="t">' + esc(p.team) + "</p>" +
            '<p class="s">' + esc(p.kit) + " · " + esc(p.season) + ic("arrow-forward") + "</p>" +
          "</div>" +
        "</a>" +
        '<div class="product-body">' +
          '<span class="product-league">' + esc(p.leagueLabel) + " · " + esc(p.kit) + "</span>" +
          '<h3 class="product-title"><a href="' + esc(productHref) + '">' + esc(p.name) + "</a></h3>" +
          ratingHTML(p) +
          catalogNoticeHTML() +
          '<div class="product-foot">' +
            '<div class="price-row">' +
              '<span class="price-now">' + FCFA(p.price) + "</span>" +
              (verified && p.discountPct > 0 ? '<span class="price-old">' + FCFA(p.priceOriginal) + "</span>" : "") +
            "</div>" +
            '<button type="button" class="add-btn quick-add" data-slug="' + esc(slug) + '" aria-label="' +
              esc(st.available ? "Ajouter " + p.name + " au panier" : p.name + " indisponible") + '"' +
              (st.available ? "" : " disabled") + ">" +
              ic("add") + (st.available ? "Ajouter" : "Épuisé") +
            "</button>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  /* ---------------- Accueil ---------------- */
  function initHome() {
    const leagueGrid = $("#leagueGrid");
    if (leagueGrid) {
      leagueGrid.innerHTML = Object.entries(LEAGUES).map(function ([key, info]) {
        const count = PRODUCTS.filter((p) => p.league === key).length;
        return (
          '<a class="league-card" href="shop.html?league=' + encodeURIComponent(key) + '">' +
            '<span class="league-dot" style="background:' + esc(safeColor(info.color)) + '">' + leagueBadgeInner(info, "icon-lg") + "</span>" +
            "<div><h3>" + esc(info.label) + "</h3>" +
            "<span>" + count + " maillot" + (count > 1 ? "s" : "") + " au catalogue</span></div>" +
            '<span class="chev">' + ic("chevron-right") + "</span>" +
          "</a>"
        );
      }).join("");
    }
    const newArrivals = $("#newArrivals");
    if (newArrivals) {
      const selection = catalogDataVerified() ? PRODUCTS.filter((p) => p.isNew) : PRODUCTS;
      newArrivals.innerHTML = selection.slice(0, 8).map(productCardHTML).join("");
    }
    const totalCountEl = $("#totalProductCount");
    if (totalCountEl) totalCountEl.textContent = PRODUCTS.length;

    const flipEl = $("#heroClubFlip");
    if (flipEl) {
      const teams = Array.from(new Set(PRODUCTS.map((p) => p.team).filter(Boolean))).slice(0, 10);
      if (teams.length) {
        flipEl.dataset.ctf = JSON.stringify(teams);
        if (window.ContainerTextFlip) window.ContainerTextFlip.scan();
      } else {
        flipEl.closest(".hero-flip-line") && flipEl.closest(".hero-flip-line").remove();
      }
    }

    const marquee = $("#leagueMarquee");
    if (marquee) {
      const items = Object.entries(LEAGUES).map(function ([key, info]) {
        const count = PRODUCTS.filter((p) => p.league === key).length;
        return (
          '<li class="imc-item">' +
            '<span class="imc-dot" style="background:' + esc(safeColor(info.color)) + '">' + leagueBadgeInner(info, "icon-sm") + "</span>" +
            "<strong>" + esc(info.label) + "</strong><span>" + count + " maillot" + (count > 1 ? "s" : "") + "</span>" +
          "</li>"
        );
      }).join("");
      marquee.innerHTML = items;
      if (window.InfiniteMovingCards) window.InfiniteMovingCards.scan();
    }
  }

  function initConfiguredContactLink() {
    const form = $("#contactForm");
    const button = $("#contactWaBtn");
    if (!form || !button) return;
    function updateLink() {
      const name = $("#cName") ? $("#cName").value : "";
      const phone = $("#cPhone") ? $("#cPhone").value : "";
      const message = $("#cMsg") ? $("#cMsg").value : "";
      const text = "Bonjour Le Maillot Idéal, je m'appelle " + name + " (" + phone + "). " + message;
      button.href = "https://wa.me/" + whatsappNumber() + "?text=" + encodeURIComponent(text);
    }
    document.addEventListener("input", function (event) {
      if (form.contains(event.target)) updateLink();
    });
    updateLink();
  }

  /* ---------------- FAQ ---------------- */
  function initFAQ() {
    const items = $$(".faq-item");
    function setOpen(item, open) {
      const q = $(".faq-question", item);
      const answer = $(".faq-answer", item);
      item.classList.toggle("open", open);
      if (q) q.setAttribute("aria-expanded", open ? "true" : "false");
      if (answer) answer.hidden = !open;
    }

    items.forEach((item, index) => {
      const q = $(".faq-question", item);
      const answer = $(".faq-answer", item);
      if (!q || !answer) return;
      const qId = q.id || "faq-question-" + (index + 1);
      const answerId = answer.id || "faq-answer-" + (index + 1);
      q.id = qId;
      q.type = "button";
      q.setAttribute("aria-controls", answerId);
      answer.id = answerId;
      answer.setAttribute("role", "region");
      answer.setAttribute("aria-labelledby", qId);
      setOpen(item, item.classList.contains("open"));
      q && q.addEventListener("click", () => {
        const isOpen = item.classList.contains("open");
        items.forEach((entry) => setOpen(entry, false));
        if (!isOpen) setOpen(item, true);
      });
    });
  }

  /* ---------------- Boutique ---------------- */
  function initShop() {
    const grid = $("#shopGrid");
    if (!grid) return;

    const params = new URLSearchParams(location.search);
    const state = {
      leagues: params.get("league") ? [params.get("league")] : [],
      sort: params.get("tri") === "prix-asc" ? "price-asc"
           : params.get("tri") === "prix-desc" ? "price-desc" : "default",
      search: (params.get("q") || "").trim().toLowerCase(),
      onlyPromo: params.get("promo") === "1",
      inStockOnly: params.get("stock") === "1",
      page: 1,
      perPage: 12,
    };

    const leagueFilterWrap = $("#leagueFilters");
    if (leagueFilterWrap) {
      leagueFilterWrap.innerHTML = Object.entries(LEAGUES).map(function ([key, info]) {
        const count = PRODUCTS.filter((p) => p.league === key).length;
        const checked = state.leagues.includes(key) ? "checked" : "";
        return (
          '<label class="filter-option"><input type="checkbox" value="' + esc(key) + '" ' + checked + ">" +
          esc(info.label) + '<span class="count">' + count + "</span></label>"
        );
      }).join("");
      leagueFilterWrap.addEventListener("change", () => {
        state.leagues = $$('input[type="checkbox"]', leagueFilterWrap).filter((c) => c.checked).map((c) => c.value);
        state.page = 1;
        render();
      });
    }

    const promoToggle = $("#promoFilter");
    if (promoToggle) {
      if (!catalogDataVerified()) {
        state.onlyPromo = false;
        promoToggle.closest(".filter-option")?.setAttribute("hidden", "");
      }
      promoToggle.checked = state.onlyPromo;
      promoToggle.addEventListener("change", () => { state.onlyPromo = promoToggle.checked; state.page = 1; render(); });
    }
    const stockToggle = $("#stockFilter");
    if (stockToggle) {
      if (!catalogDataVerified()) {
        state.inStockOnly = false;
        stockToggle.closest(".filter-option")?.setAttribute("hidden", "");
      }
      stockToggle.checked = state.inStockOnly;
      stockToggle.addEventListener("change", () => { state.inStockOnly = stockToggle.checked; state.page = 1; render(); });
    }
    const availabilityFilters = $("#availabilityFilters");
    if (availabilityFilters) availabilityFilters.hidden = !catalogDataVerified();

    const searchInput = $("#shopSearch");
    if (searchInput) {
      searchInput.value = params.get("q") || "";
      searchInput.addEventListener("input", () => { state.search = searchInput.value.trim().toLowerCase(); state.page = 1; render(); });
    }

    const sortSelect = $("#sortSelect");
    if (sortSelect) {
      sortSelect.value = state.sort;
      sortSelect.addEventListener("change", () => { state.sort = sortSelect.value; render(); });
    }

    function filtered() {
      let list = PRODUCTS.slice();
      if (state.leagues.length) list = list.filter((p) => state.leagues.includes(p.league));
      if (state.onlyPromo) list = list.filter((p) => p.discountPct > 0);
      if (state.inStockOnly) list = list.filter((p) => stockInfo(p).available);
      if (state.search) list = list.filter((p) => p.name.toLowerCase().includes(state.search) || p.team.toLowerCase().includes(state.search));
      if (state.sort === "price-asc") list.sort((a, b) => a.price - b.price);
      else if (state.sort === "price-desc") list.sort((a, b) => b.price - a.price);
      else list.sort((a, b) => Number(a.id) - Number(b.id));
      return list;
    }

    function render() {
      const list = filtered();
      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / state.perPage));
      state.page = Math.min(state.page, totalPages);
      const start = (state.page - 1) * state.perPage;
      const pageItems = list.slice(start, start + state.perPage);

      $("#resultCount").textContent = total + " maillot" + (total !== 1 ? "s" : "") + " trouvé" + (total !== 1 ? "s" : "");

      grid.innerHTML = pageItems.length
        ? pageItems.map(productCardHTML).join("")
        : '<div class="empty-state">' + ic("search") +
          "<div>Aucun maillot ne correspond à votre recherche.<br>Essayez d'autres filtres ou écrivez-nous sur WhatsApp.</div></div>";

      const pag = $("#pagination");
      if (pag) {
        pag.setAttribute("role", "navigation");
        pag.setAttribute("aria-label", "Pagination des produits");
        let html = '<button type="button" ' + (state.page === 1 ? "disabled" : "") + ' data-page="' + (state.page - 1) + '" aria-label="Page précédente">' + ic("chevron-left") + "</button>";
        for (let i = 1; i <= totalPages; i++) {
          html += '<button type="button" class="' + (i === state.page ? "active" : "") + '" data-page="' + i + '" aria-label="Page ' + i + '"' +
            (i === state.page ? ' aria-current="page"' : "") + ">" + i + "</button>";
        }
        html += '<button type="button" ' + (state.page === totalPages ? "disabled" : "") + ' data-page="' + (state.page + 1) + '" aria-label="Page suivante">' + ic("chevron-right") + "</button>";
        pag.innerHTML = html;
      }
      bindQuickAdd();
    }

    $("#pagination") && $("#pagination").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      if (!btn || btn.disabled) return;
      state.page = Number(btn.dataset.page);
      render();
      const current = $("#pagination [aria-current=\"page\"]");
      if (current) current.focus();
      window.scrollTo({ top: grid.offsetTop - 110, behavior: "smooth" });
    });

    render();
  }

  function bindQuickAdd() {
    $$(".quick-add").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const product = productForSlug(btn.dataset.slug);
        const sizes = product && Array.isArray(product.sizes) ? product.sizes.map(String) : [];
        const defaultSize = sizes.includes("M") ? "M" : (sizes[0] || "");
        addToCart(btn.dataset.slug, defaultSize, 1, btn);
      });
    });
  }

  /* ---------------- SEO fiche produit ---------------- */
  const SITE_URL = String(siteConfig().siteUrl || "https://le-maillot-ideal.com/").replace(/\/?$/, "/");
  function absUrl(path) { return SITE_URL + path.replace(/^\//, ""); }
  function productPagePath(product) {
    return "produits/" + encodeURIComponent(String(product.slug || "")) + ".html";
  }

  function updateProductMeta(product) {
    const url = absUrl(productPagePath(product));
    const image = absUrl(product.image);
    const setMeta = (attr, key, content) => {
      let el = document.querySelector('meta[' + attr + '="' + key + '"]');
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) { canon = document.createElement("link"); canon.setAttribute("rel", "canonical"); document.head.appendChild(canon); }
    canon.setAttribute("href", url);
    setMeta("property", "og:title", product.name + " | Le Maillot Idéal");
    setMeta("property", "og:description", publicProductDescription(product));
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", image);
  }

  function updateProductBreadcrumb(product) {
    const nav = $("#pdBreadcrumb");
    if (!nav) return;
    nav.innerHTML =
      '<a href="index.html">Accueil</a><span class="sep">' + ic("chevron-right") + "</span>" +
      '<a href="shop.html">Boutique</a><span class="sep">' + ic("chevron-right") + "</span>" +
      '<a href="shop.html?league=' + encodeURIComponent(product.league) + '">' + esc(product.leagueLabel) + "</a><span class=\"sep\">" + ic("chevron-right") + "</span>" +
      '<span aria-current="page">' + esc(product.name) + "</span>";
  }

  function injectProductJsonLd(product) {
    $$('script[data-ld="product"], script[data-static-ld]').forEach((n) => n.remove());
    const st = stockInfo(product);
    const url = absUrl(productPagePath(product));
    const productLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: [absUrl(product.image)],
      description: publicProductDescription(product),
      sku: product.slug,
    };
    if (catalogDataVerified()) {
      productLd.offers = {
        "@type": "Offer",
        url: url,
        priceCurrency: "XAF",
        price: product.price,
        availability: "https://schema.org/" + (st.available ? "InStock" : "OutOfStock"),
      };
    }
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Boutique", item: absUrl("shop.html") },
        { "@type": "ListItem", position: 3, name: product.leagueLabel, item: absUrl("shop.html?league=" + product.league) },
        { "@type": "ListItem", position: 4, name: product.name, item: url },
      ],
    };
    const structuredData = catalogDataVerified() ? [productLd, breadcrumbLd] : [breadcrumbLd];
    structuredData.forEach((data) => {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.dataset.ld = "product";
      s.textContent = JSON.stringify(data);
      document.head.appendChild(s);
    });
  }

  /* ---------------- Fiche produit ---------------- */
  function initProductPage() {
    const wrap = $("#productDetail");
    if (!wrap) return;
    const params = new URLSearchParams(location.search);
    const embeddedSlug = document.body.dataset.productSlug || "";
    const requestedSlug = embeddedSlug || params.get("slug");
    const product = requestedSlug ? productForSlug(requestedSlug) : null;
    if (!product) {
      document.title = "Produit introuvable | Le Maillot Idéal";
      wrap.innerHTML = '<div class="empty-state">' + ic("error") +
        '<div>Ce produit est introuvable.<br><a class="btn btn-tonal" href="shop.html">Retour à la boutique</a></div></div>';
      try { window.location.replace(new URL("404.html", document.baseURI).href); } catch (e) {}
      return;
    }

    /* Compatibilité avec les anciens favoris en product.html?slug=... */
    if (!embeddedSlug && params.has("slug")) {
      try {
        window.location.replace(new URL(productPagePath(product), document.baseURI).href);
        return;
      } catch (e) {}
    }

    document.title = product.name + " | Le Maillot Idéal";
    const metaDesc = $('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", publicProductDescription(product));
    updateProductMeta(product);
    updateProductBreadcrumb(product);
    injectProductJsonLd(product);

    const st = stockInfo(product);
    const sizes = Array.isArray(product.sizes)
      ? Array.from(new Set(product.sizes.map((size) => String(size).trim()).filter(Boolean)))
      : [];
    let selectedSize = sizes.includes("M") ? "M" : (sizes[0] || "");
    const canOrder = st.available && !!selectedSize;
    const deliveryPolicy = commercialTermsVerified()
      ? "Les délais, frais et moyens de paiement applicables dépendent de la zone indiquée dans la rubrique Livraison. Ils sont repris avec vous sur WhatsApp avant validation."
      : "Les modalités, délais, frais de livraison et moyens de paiement sont confirmés avec vous sur WhatsApp avant toute commande.";
    const returnsPolicy = commercialTermsVerified()
      ? "Les conditions de retour ou d'échange validées avec le vendeur sont rappelées sur WhatsApp avant la commande."
      : "Les conditions de retour ou d'échange sont à confirmer sur WhatsApp avant la commande.";
    const paymentPolicy = commercialTermsVerified()
      ? "Le site n'encaisse aucun paiement. Le moyen et le moment du règlement applicables à votre zone sont convenus sur WhatsApp."
      : "Les modalités de paiement sont à confirmer sur WhatsApp avant la commande.";
    let qty = 1;

    function waLink() {
      let msg = "*Le Maillot Idéal* — nouvelle commande\n\n";
      msg += "• " + qty + " x " + product.name + " (taille " + selectedSize + ") — " + FCFA(product.price * qty) + "\n";
      msg += "\n*" + (catalogDataVerified() ? "Total" : "Total indicatif") + " : " + FCFA(product.price * qty) + "*\n";
      if (!catalogDataVerified()) msg += "Prix/stock indicatifs, à confirmer sur WhatsApp.\n";
      msg += commercialTermsVerified()
        ? "Paiement et livraison selon les modalités applicables à votre zone.\n\n"
        : "Modalités de paiement et de livraison à confirmer sur WhatsApp.\n\n";
      msg += "Merci de me confirmer la disponibilité et le délai de livraison.";
      return "https://wa.me/" + whatsappNumber() + "?text=" + encodeURIComponent(msg);
    }

    wrap.innerHTML =
      '<div class="pd-media lens" data-lens data-lens-zoom="1.5" data-lens-size="170">' +
        '<div class="lens-img"><img src="' + esc(product.image) + '" alt="' + esc(product.name) + ", saison " + esc(product.season) + '" width="500" height="500"></div>' +
        '<div class="lens-glass" aria-hidden="true"></div>' +
      "</div>" +
      '<div class="pd-info">' +
        '<h1 class="pd-title">' + esc(product.name) + "</h1>" +
        '<p class="pd-meta">' + ic("soccer", "icon-sm") + esc(product.leagueLabel) + " · " + esc(product.kit) + " · Saison " + esc(product.season) + "</p>" +
        '<div class="pd-price">' +
          '<span class="price-now">' + FCFA(product.price) + "</span>" +
          (catalogDataVerified() && Number(product.discountPct) > 0
            ? '<span class="price-old">' + FCFA(product.priceOriginal) + '</span><span class="discount-pill">-' + Math.max(0, Math.round(Number(product.discountPct))) + "%</span>"
            : "") +
        "</div>" +
        '<span class="badge ' + esc(st.cls) + '">' + ic(st.icon, "icon-sm") + esc(st.label) + "</span>" +
        catalogNoticeHTML() +
        '<p class="pd-desc" style="margin-top:14px">' + esc(publicProductDescription(product)) + "</p>" +

        '<div class="pd-section"><h3>Taille</h3><div class="size-grid" id="sizeGrid">' +
          (sizes.length
            ? sizes.map((size) => '<button type="button" class="size-opt' + (size === selectedSize ? " selected" : "") +
              '" data-size="' + esc(size) + '" aria-pressed="' + (size === selectedSize ? "true" : "false") + '">' + esc(size) + "</button>").join("")
            : '<p class="form-note">Aucune taille disponible.</p>') +
        "</div>" +
        (catalogDataVerified() && product.kidsAvailable ? '<p class="form-note">Tailles enfant disponibles — précisez l\'âge sur WhatsApp.</p>' : "") +
        "</div>" +

        '<div class="pd-section"><h3>Quantité</h3>' +
          '<div class="qty-stepper" id="qtyStepper">' +
            '<button type="button" data-act="dec" aria-label="Diminuer"' + (canOrder ? "" : " disabled") + ">" + ic("remove") + "</button>" +
            '<span id="qtyValue" aria-live="polite">1</span>' +
            '<button type="button" data-act="inc" aria-label="Augmenter"' + (canOrder ? "" : " disabled") + ">" + ic("add") + "</button>" +
          "</div>" +
        "</div>" +

        '<div class="pd-ctas">' +
          '<button type="button" class="btn btn-primary btn-lg" id="addToCartBtn"' + (canOrder ? "" : " disabled") + ">" +
            ic("cart") + (canOrder ? "Ajouter au panier" : "Indisponible") + "</button>" +
          '<a class="btn btn-whatsapp btn-lg" id="pdWhatsapp" ' +
            (canOrder
              ? 'data-stateful data-stateful-delay="600" href="' + esc(waLink()) + '" target="_blank" rel="noopener"'
              : 'aria-disabled="true" tabindex="-1"') + ">" + ic("chat") + (canOrder ? "Commander sur WhatsApp" : "Indisponible") + "</a>" +
        "</div>" +
        '<p class="form-note">' + ic("hourglass", "icon-sm") + ' <span data-cfg="responseTime">' +
          esc(siteConfig().responseTime || "Délai de réponse à confirmer") + "</span></p>" +

        '<div class="pd-section">' +
          '<details class="accordion-mini" open><summary>' + ic("shipping") + "Livraison &amp; paiement</summary>" +
            "<p>" + esc(deliveryPolicy) + "</p></details>" +
          '<details class="accordion-mini"><summary>' + ic("ruler") + "Guide des tailles</summary>" +
            "<p>Les coupes peuvent varier selon le modèle. Envoyez votre taille habituelle ou vos mesures sur WhatsApp afin de confirmer le choix avant la commande.</p></details>" +
          '<details class="accordion-mini"><summary>' + ic("swap") + "Retours &amp; échanges</summary>" +
            "<p>" + esc(returnsPolicy) + "</p></details>" +
          '<details class="accordion-mini"><summary>' + ic("shield") + "Paiement</summary>" +
            "<p>" + esc(paymentPolicy) + "</p></details>" +
        "</div>" +
      "</div>";

    $$("#sizeGrid .size-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("#sizeGrid .size-opt").forEach((b) => {
          b.classList.remove("selected");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("selected");
        btn.setAttribute("aria-pressed", "true");
        selectedSize = btn.dataset.size;
        if (canOrder) $("#pdWhatsapp").href = waLink();
      });
    });
    $("#qtyStepper").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const max = productStock(product);
      if (btn.dataset.act === "inc") {
        if (qty >= max) { showToast("Stock limité : " + max + " disponible(s)", "error", true); return; }
        qty += 1;
      } else qty = Math.max(1, qty - 1);
      $("#qtyValue").textContent = qty;
      if (canOrder) $("#pdWhatsapp").href = waLink();
    });
    const addBtn = $("#addToCartBtn");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        if (addBtn.dataset.sbBusy) return;
        const ok = addToCart(product.slug, selectedSize, qty, addBtn);
        if (ok && window.StatefulButton) {
          window.StatefulButton.run(addBtn, () => new Promise((r) => setTimeout(r, 420)));
        }
      });
    }
    const pdWa = $("#pdWhatsapp");
    if (pdWa && !canOrder) {
      pdWa.addEventListener("click", function (e) {
        e.preventDefault();
        showToast(product.name + " est indisponible", "error", true);
      });
    }

    const relatedWrap = $("#relatedProducts");
    if (relatedWrap) {
      const related = PRODUCTS.filter((p) => p.league === product.league && p.slug !== product.slug).slice(0, 4);
      relatedWrap.innerHTML = related.map(productCardHTML).join("");
      bindQuickAdd();
    }
  }

  /* ---------------- Init ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNav();
    initCart();
    updateCartBadge();
    initFAQ();
    initHome();
    initConfiguredContactLink();
    initShop();
    initProductPage();
    bindQuickAdd();
    const yearEl = $("#currentYear");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  });

  /* validateur utilisé par le bouton de commande (data-stateful-validate) */
  window.lmiCartNotEmpty = function () {
    if (getCart().length === 0) { showToast("Votre panier est vide", "error", true); return false; }
    return true;
  };
  window.lmiContactValid = function () {
    const form = $("#contactForm");
    if (!form) return false;
    const name = $("#cName");
    const phone = $("#cPhone");
    const message = $("#cMsg");
    if (name) name.setCustomValidity(name.value.trim().length >= 2 ? "" : "Saisissez un nom d'au moins 2 caractères.");
    if (phone) {
      const digits = phone.value.replace(/\D/g, "");
      phone.setCustomValidity(digits.length >= 8 && digits.length <= 15 ? "" : "Saisissez un numéro contenant 8 à 15 chiffres.");
    }
    if (message) message.setCustomValidity(message.value.trim().length >= 5 ? "" : "Saisissez un message d'au moins 5 caractères.");
    const valid = form.checkValidity();
    if (!valid) {
      form.reportValidity();
      showToast("Vérifiez les champs du formulaire", "error", true);
    }
    return valid;
  };

  window.LMI = {
    showToast: showToast,
    icon: ic,
    productCard: productCardHTML,
    productPagePath: productPagePath,
    bindQuickAdd: bindQuickAdd,
  };
})();
