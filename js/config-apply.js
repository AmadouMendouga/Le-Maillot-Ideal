/* ===========================================================
   Applique window.SITE aux éléments porteurs d'un attribut data-cfg.
   Le HTML garde ses textes en dur (référencement + repli sans JS) ;
   ce script ne les remplace que si la config diffère.
   =========================================================== */
(function () {
  "use strict";
  var S = window.SITE;
  if (!S) return;

  function get(path) {
    return path.split(".").reduce(function (o, k) {
      return o == null ? undefined : o[k];
    }, S);
  }

  function whatsappDigits() {
    return String(S.whatsapp || "").replace(/\D/g, "");
  }

  function rewriteWhatsappLink(a) {
    if (!a || !a.getAttribute) return;
    var digits = whatsappDigits();
    var href = a.getAttribute("href") || "";
    if (!digits || !/https?:\/\/wa\.me\/\d+/i.test(href)) return;
    var next = href.replace(/(https?:\/\/wa\.me\/)\d+/i, "$1" + digits);
    if (next !== href) a.setAttribute("href", next);
  }

  function rewriteWhatsappLinks(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches('a[href*="wa.me/"]')) rewriteWhatsappLink(root);
    root.querySelectorAll('a[href*="wa.me/"]').forEach(rewriteWhatsappLink);
  }

  function safeExternalUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      var url = new URL(value.trim());
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  function absoluteSiteUrl(path) {
    var base = safeExternalUrl(S.siteUrl) || "https://le-maillot-ideal.com/";
    try { return new URL(path || "", base).href; } catch (e) { return base; }
  }

  function rebaseSiteUrl(value) {
    try {
      var parsed = new URL(value, window.location.href);
      return absoluteSiteUrl(parsed.pathname.replace(/^\/+/, "") + parsed.search + parsed.hash);
    } catch (e) {
      return value;
    }
  }

  function neutralCatalogText(value) {
    return String(value || "")
      .replace(/\bmaillot\s+officiel\s+réplique\b/gi, "maillot réplique")
      .replace(/\bréplique\s+officielle?\b/gi, "réplique");
  }

  function applyStoreJsonLd() {
    var script = document.querySelector('script[data-site-jsonld="store"]');
    if (!script) return;
    try {
      var data = JSON.parse(script.textContent);
      var digits = whatsappDigits();
      if (S.businessName) data.name = S.businessName;
      data.url = absoluteSiteUrl("");
      if (S.shareImage) data.image = absoluteSiteUrl(S.shareImage);
      if (digits) data.telephone = "+" + digits;
      if (S.email) data.email = S.email;
      else delete data.email;
      if (S.commercialTermsVerified === true && Array.isArray(S.paymentAccepted)) {
        data.paymentAccepted = S.paymentAccepted;
      } else {
        delete data.paymentAccepted;
      }
      if (S.commercialTermsVerified === true && Array.isArray(S.areaServed)) {
        data.areaServed = S.areaServed;
      } else {
        delete data.areaServed;
      }
      data.address = data.address || { "@type": "PostalAddress" };
      if (S.addressCountry) data.address.addressCountry = S.addressCountry;
      if (S.addressLocality) data.address.addressLocality = S.addressLocality;
      else delete data.address.addressLocality;
      /* Le texte libre « hours » est éditable dans l'admin, contrairement aux
         champs structurés détaillés : on évite donc toute divergence JSON-LD. */
      delete data.openingHoursSpecification;
      script.textContent = JSON.stringify(data);
    } catch (e) {
      /* Le JSON-LD statique reste utilisable si sa mise à jour échoue. */
    }
  }

  function applyPageMetadata() {
    [document.querySelector('link[rel="canonical"]'), document.querySelector('meta[property="og:url"]')]
      .filter(Boolean)
      .forEach(function (el) {
        var attr = el.tagName === "LINK" ? "href" : "content";
        el.setAttribute(attr, rebaseSiteUrl(el.getAttribute(attr)));
      });
    var image = document.querySelector('meta[property="og:image"]');
    if (image) image.setAttribute("content", rebaseSiteUrl(image.getAttribute("content")));

    document.querySelectorAll('.pd-desc').forEach(function (el) {
      el.textContent = neutralCatalogText(el.textContent);
    });
    ['meta[name="description"]', 'meta[property="og:description"]'].forEach(function (selector) {
      var meta = document.querySelector(selector);
      if (meta) meta.setAttribute("content", neutralCatalogText(meta.getAttribute("content")));
    });
  }

  function applyProductJsonLd() {
    document.querySelectorAll('script[data-ld="product"]').forEach(function (script) {
      try {
        var data = JSON.parse(script.textContent);
        if (data["@type"] === "Product") {
          data.description = neutralCatalogText(data.description);
          if (Array.isArray(data.image)) data.image = data.image.map(rebaseSiteUrl);
          if (data.offers && data.offers.url) data.offers.url = rebaseSiteUrl(data.offers.url);
        }
        if (data["@type"] === "BreadcrumbList" && Array.isArray(data.itemListElement)) {
          data.itemListElement.forEach(function (item) {
            if (item.item) item.item = rebaseSiteUrl(item.item);
          });
        }
        script.textContent = JSON.stringify(data);
      } catch (e) {
        /* Le balisage généré reste inchangé s'il n'est pas exploitable. */
      }
    });
  }

  function applyContentVisibility() {
    function isContentVisible(key) {
      var hasContent = key === "showTestimonials"
        ? Array.isArray(window.TESTIMONIALS) && window.TESTIMONIALS.length > 0
        : key === "showGallery"
          ? Array.isArray(window.GALLERY) && window.GALLERY.length > 0
          : true;
      return get(key) === true && hasContent;
    }
    document.querySelectorAll("[data-site-visible]").forEach(function (el) {
      var key = el.dataset.siteVisible;
      el.hidden = !isContentVisible(key);
    });
    document.querySelectorAll("[data-site-empty-when]").forEach(function (el) {
      var keys = el.dataset.siteEmptyWhen.split(/\s+/).filter(Boolean);
      el.hidden = keys.some(isContentVisible);
    });
    document.querySelectorAll("[data-site-unverified]").forEach(function (el) {
      el.hidden = get(el.dataset.siteUnverified) === true;
    });
  }

  function applyDeliveryRows() {
    var tbody = document.querySelector("[data-delivery-rows]");
    if (!tbody || S.commercialTermsVerified !== true || !Array.isArray(S.deliveryRows) || !S.deliveryRows.length) return;
    tbody.textContent = "";
    S.deliveryRows.forEach(function (row) {
      var tr = document.createElement("tr");
      ["zone", "delay", "cost", "payment"].forEach(function (key) {
        var td = document.createElement("td");
        td.textContent = String(row && row[key] != null ? row[key] : "À confirmer");
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function syncFaq() {
    document.querySelectorAll(".faq-item").forEach(function (item, index) {
      var button = item.querySelector(".faq-question");
      var answer = item.querySelector(".faq-answer");
      if (!button || !answer) return;
      if (!answer.id) answer.id = "faq-answer-" + (index + 1);
      var open = item.classList.contains("open");
      button.setAttribute("aria-controls", answer.id);
      button.setAttribute("aria-expanded", open ? "true" : "false");
      answer.setAttribute("aria-hidden", open ? "false" : "true");
    });
  }

  function installDialog(dialog) {
    var lastFocus = null;
    var wasOpen = false;
    var focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function sync() {
      var open = dialog.classList.contains("open");
      dialog.setAttribute("aria-hidden", open ? "false" : "true");
      if (open && !wasOpen) {
        lastFocus = document.activeElement;
        var first = dialog.querySelector(focusableSelector);
        (first || dialog).focus();
      } else if (!open && wasOpen && lastFocus && document.contains(lastFocus)) {
        lastFocus.focus();
      }
      wasOpen = open;
    }

    dialog.addEventListener("keydown", function (event) {
      if (event.key !== "Tab" || !dialog.classList.contains("open")) return;
      var focusable = Array.prototype.slice.call(dialog.querySelectorAll(focusableSelector))
        .filter(function (el) { return el.getClientRects().length > 0; });
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });

    if ("MutationObserver" in window) {
      new MutationObserver(sync).observe(dialog, { attributes: true, attributeFilter: ["class"] });
    }
    sync();
  }

  function setupResponsiveFilters() {
    var panel = document.querySelector(".filters-panel");
    if (!panel || !window.matchMedia) return;
    var mobile = window.matchMedia("(max-width: 940px)");
    function sync(event) { panel.open = !event.matches; }
    sync(mobile);
    if (mobile.addEventListener) mobile.addEventListener("change", sync);
    else if (mobile.addListener) mobile.addListener(sync);
  }

  document.addEventListener("DOMContentLoaded", function () {
    /* textes */
    document.querySelectorAll("[data-cfg]").forEach(function (el) {
      var v = get(el.dataset.cfg);
      if (v === undefined || v === null) return;
      if (String(el.textContent).trim() !== String(v).trim()) el.textContent = v;
    });

    /* liens WhatsApp : un seul numéro, y compris pour les liens créés ensuite */
    rewriteWhatsappLinks(document);
    /* liens e-mail */
    document.querySelectorAll('a[href^="mailto:"], a[data-cfg="email"]').forEach(function (a) {
      if (S.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(S.email))) {
        a.href = "mailto:" + S.email;
        a.hidden = false;
      } else {
        a.removeAttribute("href");
        var item = a.closest("li");
        if (item) item.hidden = true;
        else a.hidden = true;
      }
    });
    ["address", "hours"].forEach(function (key) {
      if (String(S[key] || "").trim()) return;
      document.querySelectorAll('[data-cfg="' + key + '"]').forEach(function (el) {
        var item = el.closest("li");
        if (item) item.hidden = true;
      });
    });

    /* réseaux sociaux : URL absolue HTTP(S) obligatoire, aucune URL javascript: */
    document.querySelectorAll("[data-social]").forEach(function (a) {
      var url = safeExternalUrl(S[a.dataset.social]);
      a.hidden = !url;
      if (!url) { a.removeAttribute("href"); return; }
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });

    applyStoreJsonLd();
    applyPageMetadata();
    applyProductJsonLd();
    applyContentVisibility();
    applyDeliveryRows();
    syncFaq();
    setupResponsiveFilters();
    document.querySelectorAll(".faq-question").forEach(function (button) {
      button.addEventListener("click", function () { setTimeout(syncFaq, 0); });
    });
    document.querySelectorAll('[role="dialog"][aria-modal="true"]:not(#cartPanel):not(#admDrawer)').forEach(installDialog);

    /* bandeaux « photos de démonstration » */
    if (S.showDemoNotice === false) {
      document.querySelectorAll(".demo-note").forEach(function (n) { n.remove(); });
    }

    if ("MutationObserver" in window) {
      new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.type === "attributes") rewriteWhatsappLink(mutation.target);
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) rewriteWhatsappLinks(node);
          });
        });
      }).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["href"],
      });
    }
  });
})();
