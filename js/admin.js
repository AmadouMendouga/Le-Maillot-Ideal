/* ===========================================================
   Console d'administration — Le Maillot Idéal
   ---------------------------------------------------------
   Le site est statique : cette page ne peut rien écrire sur le
   serveur. Elle travaille sur un brouillon local (localStorage)
   puis EXPORTE les fichiers à déposer chez l'hébergeur.
   Aucune donnée ne sort du navigateur.
   =========================================================== */
(function () {
  "use strict";

  var DRAFT_KEY = "lmi_admin_draft_v2";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var ic = function (n, c) {
    return '<svg class="icon' + (c ? " " + c : "") + '" aria-hidden="true"><use href="#i-' + n + '"></use></svg>';
  };
  var FCFA = function (n) { return Number(n || 0).toLocaleString("fr-FR") + " FCFA"; };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  };

  /* ---------- état ---------- */
  var state = {
    products: JSON.parse(JSON.stringify(window.PRODUCTS || [])),
    leagues: JSON.parse(JSON.stringify(window.LEAGUES || {})),
    gallery: JSON.parse(JSON.stringify(window.GALLERY || [])),
    testimonials: JSON.parse(JSON.stringify(window.TESTIMONIALS || [])),
    site: JSON.parse(JSON.stringify(window.SITE || {})),
    /* images remplacées : { "images/photos/photo-01.jpg": "data:image/jpeg;base64,…" } */
    newImages: {},
    touched: {},          // slugs de produits modifiés
    siteTouched: false,
  };

  /* ---------- brouillon ---------- */
  var saveTimer;
  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
        var d = new Date();
        $("#admSaved").textContent =
          "Brouillon enregistré à " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      } catch (e) {
        $("#admSaved").textContent = "Brouillon trop volumineux pour être enregistré — exportez vos changements";
      }
      refreshCounters();
    }, 400);
  }
  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      ["products", "gallery", "testimonials", "site", "newImages", "touched"].forEach(function (k) {
        if (d[k]) state[k] = d[k];
      });
      $("#admSaved").textContent = "Brouillon restauré";
    } catch (e) {}
  }

  /* ---------- redimensionnement d'image (canvas, sans dépendance) ---------- */
  function reportImageError(error, file) {
    var name = file && file.name ? " « " + file.name + " »" : "";
    var detail = error && error.message ? "\n" + error.message : "";
    console.error("Impossible de traiter l'image" + name, error);
    alert("Impossible de traiter l'image" + name + "." + detail +
      "\nEssayez un fichier JPEG, PNG ou WebP valide.");
  }

  function readImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error("Aucun fichier n'a été sélectionné.")); return; }
      if (!file.type || file.type.indexOf("image/") !== 0) {
        reject(new Error("Le fichier sélectionné n'est pas une image reconnue."));
        return;
      }
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          if (!img.naturalWidth || !img.naturalHeight) {
            reject(new Error("L'image ne contient aucune dimension exploitable."));
            return;
          }
          resolve(img);
        };
        img.onerror = function () { reject(new Error("Le navigateur ne parvient pas à décoder cette image.")); };
        img.src = fr.result;
      };
      fr.onerror = function () { reject(new Error("Le fichier n'a pas pu être lu.")); };
      fr.onabort = function () { reject(new Error("La lecture du fichier a été interrompue.")); };
      try { fr.readAsDataURL(file); }
      catch (e) { reject(e); }
    });
  }

  function canvasDataUrl(canvas, quality) {
    var out = canvas.toDataURL("image/jpeg", quality);
    if (!out || out === "data:,") throw new Error("La conversion de l'image a échoué.");
    return out;
  }

  /* carré rogné au centre */
  function toSquare(img, size, quality) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var ctx = c.getContext("2d");
    if (!ctx) throw new Error("Le traitement d'image n'est pas disponible dans ce navigateur.");
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    var s = Math.min(w, h);
    ctx.drawImage(img, (w - s) / 2, (h - s) / 2 * 0.8, s, s, 0, 0, size, size);
    return canvasDataUrl(c, quality);
  }
  /* redimensionné en gardant les proportions */
  function toWide(img, maxW, quality) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    var r = Math.min(1, maxW / w);
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * r));
    c.height = Math.max(1, Math.round(h * r));
    var ctx = c.getContext("2d");
    if (!ctx) throw new Error("Le traitement d'image n'est pas disponible dans ce navigateur.");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return canvasDataUrl(c, quality);
  }

  /* ---------- onglets ---------- */
  $$(".adm-tab").forEach(function (t) {
    t.addEventListener("click", function () {
      $$(".adm-tab").forEach(function (x) { x.classList.remove("active"); });
      $$(".adm-panel").forEach(function (x) { x.classList.remove("active"); });
      t.classList.add("active");
      $('[data-panel="' + t.dataset.tab + '"]').classList.add("active");
      if (t.dataset.tab === "export") renderDiff();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  $("#admGoExport").addEventListener("click", function () {
    $('.adm-tab[data-tab="export"]').click();
  });

  /* thème */
  $$(".theme-toggle").forEach(function (b) {
    b.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("lmi_theme", next); } catch (e) {}
    });
  });

  /* ---------- compteurs ---------- */
  function refreshCounters() {
    $("#cntProducts").textContent = state.products.length;
    $("#cntGallery").textContent = state.gallery.length;
    $("#cntTesti").textContent = state.testimonials.length;
  }

  /* ---------- image affichée (brouillon prioritaire) ---------- */
  function src(path) { return state.newImages[path] || path; }

  /* =========================================================
     PRODUITS
     ========================================================= */
  var filters = { q: "", league: "", status: "" };

  function initLeagueSelect() {
    var sel = $("#admLeague");
    sel.innerHTML = '<option value="">Tous les championnats</option>' +
      Object.keys(state.leagues).map(function (k) {
        return '<option value="' + k + '">' + esc(state.leagues[k].label) + "</option>";
      }).join("");
  }

  function filtered() {
    return state.products.filter(function (p) {
      if (filters.league && p.league !== filters.league) return false;
      if (filters.q) {
        var q = filters.q.toLowerCase();
        if (p.name.toLowerCase().indexOf(q) < 0 && p.team.toLowerCase().indexOf(q) < 0) return false;
      }
      if (filters.status === "modified" && !state.touched[p.slug]) return false;
      if (filters.status === "out" && p.stock !== 0) return false;
      if (filters.status === "low" && !(p.stock > 0 && p.stock <= 5)) return false;
      if (filters.status === "promo" && !(p.discountPct > 0)) return false;
      return true;
    });
  }

  function stockLabel(p) {
    if (p.stock === 0) return '<span class="badge badge-stock-out">' + ic("error", "icon-sm") + "Rupture</span>";
    if (p.stock <= 5) return '<span class="badge badge-stock-low">' + ic("hourglass", "icon-sm") + p.stock + " restants</span>";
    return '<span class="badge badge-stock-ok">' + ic("check-circle", "icon-sm") + p.stock + "</span>";
  }

  function renderProducts() {
    var list = filtered();
    $("#admCount").textContent = list.length + " maillot" + (list.length > 1 ? "s" : "");
    if (!list.length) {
      $("#admRows").innerHTML = '<tr><td colspan="6"><div class="adm-empty">' + ic("search") +
        "<div>Aucun maillot ne correspond à ce filtre.</div></div></td></tr>";
      return;
    }
    $("#admRows").innerHTML = list.map(function (p) {
      return '<tr class="' + (state.touched[p.slug] ? "adm-edited" : "") + '">' +
        '<td><img class="adm-thumb" src="' + esc(src(p.image)) + '" alt="" data-img="' + esc(p.slug) + '" title="Changer la photo"></td>' +
        '<td><div class="name">' + esc(p.name) + "</div>" +
          '<div class="sub">' + esc(p.leagueLabel) + " · " + esc(p.kit) + " · " + esc(p.season) + "</div></td>" +
        "<td><strong>" + FCFA(p.price) + "</strong>" +
          (p.discountPct > 0 ? '<div class="sub">-' + p.discountPct + "% · " + FCFA(p.priceOriginal) + "</div>" : "") + "</td>" +
        "<td>" + stockLabel(p) + "</td>" +
        "<td>" + (p.isNew ? '<span class="badge badge-new">' + ic("bolt", "icon-sm") + "Nouveau</span>" : '<span class="sub">—</span>') + "</td>" +
        '<td><div class="adm-row-actions">' +
          '<button class="icon-btn" data-edit="' + esc(p.slug) + '" aria-label="Modifier">' + ic("edit", "icon-sm") + "</button>" +
        "</div></td></tr>";
    }).join("");
  }

  $("#admSearch").addEventListener("input", function (e) { filters.q = e.target.value.trim(); renderProducts(); });
  $("#admLeague").addEventListener("change", function (e) { filters.league = e.target.value; renderProducts(); });
  $("#admStatus").addEventListener("change", function (e) { filters.status = e.target.value; renderProducts(); });

  $("#admRows").addEventListener("click", function (e) {
    var edit = e.target.closest("[data-edit]");
    if (edit) { openProduct(edit.dataset.edit); return; }
    var img = e.target.closest("[data-img]");
    if (img) { pickProductImage(img.dataset.img); }
  });

  /* --- changer la photo d'un produit --- */
  function pickProductImage(slug) {
    var p = state.products.find(function (x) { return x.slug === slug; });
    if (!p) return;
    var input = $("#admFile");
    input.value = "";
    input.onchange = function () {
      var f = input.files[0];
      if (!f) return;
      readImage(f).then(function (img) {
        /* on force le chemin en .jpg : les placeholders d'origine sont en .svg */
        var target = "images/photos/" + slug + ".jpg";
        var imageData = toSquare(img, 600, 0.82);
        state.newImages[target] = imageData;
        p.image = target;
        p.imageWide = target;
        state.touched[slug] = true;
        saveDraft(); renderProducts();
      }).catch(function (error) { reportImageError(error, f); });
    };
    input.click();
  }

  /* --- panneau d'édition --- */
  var editingSlug = null;
  var lastDrawerFocus = null;
  function wireFieldLabels(root) {
    $$(".adm-field", root || document).forEach(function (field, index) {
      var label = $("label", field);
      var control = $("input, select, textarea", field);
      if (!label || !control) return;
      if (!control.id) control.id = "admField" + index;
      label.setAttribute("for", control.id);
    });
  }
  function openProduct(slug) {
    var p = state.products.find(function (x) { return x.slug === slug; });
    if (!p) return;
    editingSlug = slug;
    $("#admDrawerTitle").textContent = p.name;
    $("#admDrawerBody").innerHTML =
      '<img class="adm-preview" id="edPreview" src="' + esc(src(p.image)) + '" alt="">' +
      '<div class="adm-drop" id="edDrop" role="button" tabindex="0">' + ic("image") +
        "<p><strong>Changer la photo</strong><br>Cliquez ou déposez une image ici</p></div>" +

      '<div class="adm-field" style="margin-top:18px"><label>Nom affiché</label>' +
        '<input id="edName" value="' + esc(p.name) + '"></div>' +

      '<div class="adm-grid2">' +
        '<div class="adm-field"><label>Équipe</label><input id="edTeam" value="' + esc(p.team) + '"></div>' +
        '<div class="adm-field"><label>Type de maillot</label>' +
          '<select id="edKit">' +
            ["Domicile", "Extérieur", "Third"].map(function (k) {
              return '<option ' + (p.kit === k ? "selected" : "") + ">" + k + "</option>";
            }).join("") +
          "</select></div>" +
      "</div>" +

      '<div class="adm-grid3">' +
        '<div class="adm-field"><label>Prix de vente</label><input id="edPrice" type="number" min="1" step="100" required value="' + p.price + '"></div>' +
        '<div class="adm-field"><label>Prix barré</label><input id="edOrig" type="number" min="1" step="100" required value="' + p.priceOriginal + '"></div>' +
        '<div class="adm-field"><label>Stock</label><input id="edStock" type="number" min="0" step="1" required value="' + p.stock + '"></div>' +
      "</div>" +
      '<p class="hint" id="edDiscount" style="margin:-6px 0 14px;font-size:.78rem;color:var(--on-surface-variant)"></p>' +

      '<div class="adm-field"><label>Saison</label><input id="edSeason" value="' + esc(p.season) + '"></div>' +

      '<div class="adm-field"><label>Description</label><textarea id="edDesc">' + esc(p.description) + "</textarea></div>" +

      '<div class="adm-field"><label>Tailles disponibles</label><div style="display:flex;gap:8px;flex-wrap:wrap">' +
        ["S", "M", "L", "XL", "2XL"].map(function (s) {
          var on = (p.sizes || []).indexOf(s) > -1;
          return '<label class="adm-check" style="padding:0"><input type="checkbox" class="edSize" value="' + s + '" ' +
                 (on ? "checked" : "") + "> " + s + "</label>";
        }).join("") +
      "</div></div>" +

      '<label class="adm-check"><input type="checkbox" id="edKids" ' + (p.kidsAvailable ? "checked" : "") + "> Tailles enfant disponibles</label>" +
      '<label class="adm-check"><input type="checkbox" id="edNew" ' + (p.isNew ? "checked" : "") + '> Afficher le badge « Nouveau »</label>';

    updateDiscountHint();
    wireFieldLabels($("#admDrawerBody"));
    ["edPrice", "edOrig"].forEach(function (id) {
      $("#" + id).addEventListener("input", updateDiscountHint);
    });

    /* dépôt d'image */
    var drop = $("#edDrop");
    drop.addEventListener("click", function () { pickInto(); });
    drop.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      pickInto();
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
    });
    drop.addEventListener("drop", function (e) {
      var f = e.dataTransfer.files[0];
      if (f) applyImage(f);
    });

    function pickInto() {
      var input = $("#admFile");
      input.value = "";
      input.onchange = function () { if (input.files[0]) applyImage(input.files[0]); };
      input.click();
    }
    function applyImage(f) {
      readImage(f).then(function (img) {
        var target = "images/photos/" + slug + ".jpg";
        var imageData = toSquare(img, 600, 0.82);
        state.newImages[target] = imageData;
        var pr = state.products.find(function (x) { return x.slug === slug; });
        pr.image = target; pr.imageWide = target;
        state.touched[slug] = true;
        $("#edPreview").src = imageData;
        saveDraft();
      }).catch(function (error) { reportImageError(error, f); });
    }

    lastDrawerFocus = document.activeElement;
    $("#admDrawer").inert = false;
    $("#admDrawer").classList.add("open");
    $("#admDrawer").setAttribute("aria-hidden", "false");
    $("#admOverlay").classList.add("open");
    requestAnimationFrame(function () { $("#admDrawerClose").focus(); });
  }

  function updateDiscountHint() {
    var price = Number($("#edPrice").value) || 0;
    var orig = Number($("#edOrig").value) || 0;
    var pct = orig > price && orig > 0 ? Math.round((1 - price / orig) * 100) : 0;
    $("#edDiscount").textContent = pct > 0
      ? "Remise calculée : -" + pct + "%"
      : "Aucune remise affichée (le prix barré doit être supérieur au prix de vente).";
  }

  function closeDrawer() {
    var wasOpen = $("#admDrawer").classList.contains("open");
    var closedSlug = editingSlug;
    $("#admDrawer").classList.remove("open");
    $("#admDrawer").setAttribute("aria-hidden", "true");
    $("#admDrawer").inert = true;
    $("#admOverlay").classList.remove("open");
    editingSlug = null;
    if (wasOpen) {
      var target = lastDrawerFocus && lastDrawerFocus.isConnected ? lastDrawerFocus : null;
      if (!target && closedSlug) {
        target = $$('[data-edit]').find(function (button) { return button.dataset.edit === closedSlug; });
      }
      if (target && typeof target.focus === "function") target.focus();
    }
  }
  $("#admDrawerClose").addEventListener("click", closeDrawer);
  $("#admOverlay").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    var drawer = $("#admDrawer");
    if (!drawer.classList.contains("open")) return;
    if (e.key === "Escape") { e.preventDefault(); closeDrawer(); return; }
    if (e.key !== "Tab") return;
    var focusable = $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', drawer)
      .filter(function (el) { return el.getClientRects().length > 0; });
    if (!focusable.length) { e.preventDefault(); drawer.focus(); return; }
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  $("#admSave").addEventListener("click", function () {
    if (!editingSlug) return;
    var p = state.products.find(function (x) { return x.slug === editingSlug; });
    if (!p) return;
    var priceInput = $("#edPrice");
    var originalInput = $("#edOrig");
    var stockInput = $("#edStock");
    var price = Number(priceInput.value);
    var priceOriginal = Number(originalInput.value);
    var stock = Number(stockInput.value);
    var sizes = $$(".edSize").filter(function (c) { return c.checked; }).map(function (c) { return c.value; });

    if (!Number.isInteger(price) || price <= 0) {
      alert("Le prix de vente doit être supérieur à 0 FCFA.");
      priceInput.focus();
      return;
    }
    if (!Number.isInteger(priceOriginal) || priceOriginal < price) {
      alert("Le prix barré doit être supérieur ou égal au prix de vente.");
      originalInput.focus();
      return;
    }
    if (!stockInput.value.trim() || !Number.isInteger(stock) || stock < 0) {
      alert("Le stock doit être un nombre entier positif ou nul.");
      stockInput.focus();
      return;
    }
    if (!sizes.length) {
      alert("Sélectionnez au moins une taille disponible.");
      var firstSize = $(".edSize");
      if (firstSize) firstSize.focus();
      return;
    }

    p.name = $("#edName").value.trim() || p.name;
    p.team = $("#edTeam").value.trim() || p.team;
    p.kit = $("#edKit").value;
    p.price = price;
    p.priceOriginal = priceOriginal;
    p.stock = stock;
    p.season = $("#edSeason").value.trim();
    p.description = $("#edDesc").value.trim();
    p.sizes = sizes;
    p.kidsAvailable = $("#edKids").checked;
    p.isNew = $("#edNew").checked;
    p.discountPct = p.priceOriginal > p.price ? Math.round((1 - p.price / p.priceOriginal) * 100) : 0;
    state.touched[p.slug] = true;
    saveDraft(); renderProducts(); closeDrawer();
  });

  /* =========================================================
     PHOTOTHÈQUE
     ========================================================= */
  function renderGallery() {
    var html = state.gallery.map(function (g, i) {
      return '<div class="adm-gcard">' +
        '<img src="' + esc(src(g.thumb)) + '" alt="">' +
        '<div class="bar"><span class="num">#' + (i + 1) + "</span>" +
          '<button class="icon-btn" data-gup="' + i + '" aria-label="Monter" ' + (i === 0 ? "disabled" : "") + ">" + ic("arrow-back", "icon-sm") + "</button>" +
          '<button class="icon-btn" data-gdown="' + i + '" aria-label="Descendre" ' + (i === state.gallery.length - 1 ? "disabled" : "") + ">" + ic("arrow-forward", "icon-sm") + "</button>" +
          '<button class="icon-btn" data-gswap="' + i + '" aria-label="Remplacer">' + ic("image", "icon-sm") + "</button>" +
          '<button class="icon-btn danger" data-gdel="' + i + '" aria-label="Supprimer">' + ic("delete", "icon-sm") + "</button>" +
        "</div></div>";
    }).join("");
    html += '<div class="adm-gadd" id="admGAdd">' + ic("add") + "<span>Ajouter des photos</span></div>";
    $("#admGallery").innerHTML = html;
    $("#admGAdd").addEventListener("click", addGalleryPhotos);
  }

  function nextGalleryIndex() {
    var max = 0;
    state.gallery.forEach(function (g) {
      var m = /gallery-(\d+)\./.exec(g.src || "");
      if (m) max = Math.max(max, Number(m[1]));
    });
    return max + 1;
  }

  function addGalleryPhotos() {
    var input = $("#admFiles");
    input.value = "";
    input.onchange = function () {
      var files = Array.prototype.slice.call(input.files);
      if (!files.length) return;
      var n = nextGalleryIndex();
      var chain = Promise.resolve();
      var failed = [];
      var added = 0;
      files.forEach(function (f, k) {
        chain = chain.then(function () {
          return readImage(f).then(function (img) {
            var id = String(n + k).padStart(2, "0");
            var thumb = "images/photos/photo-" + id + ".jpg";
            var wide = "images/gallery/gallery-" + id + ".jpg";
            var thumbData = toSquare(img, 600, 0.82);
            var wideData = toWide(img, 1400, 0.8);
            state.newImages[thumb] = thumbData;
            state.newImages[wide] = wideData;
            state.gallery.push({ src: wide, thumb: thumb });
            added += 1;
          }).catch(function (error) {
            console.error("Impossible de traiter l'image « " + f.name + " »", error);
            failed.push(f.name || "fichier sans nom");
          });
        });
      });
      chain.then(function () {
        if (added) { saveDraft(); renderGallery(); }
        if (failed.length) {
          alert(failed.length + " image(s) ignorée(s), car elles n'ont pas pu être lues ou converties :\n• " +
            failed.join("\n• ") + "\n\nEssayez des fichiers JPEG, PNG ou WebP valides.");
        }
      });
    };
    input.click();
  }

  $("#admGallery").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var i;
    if (b.dataset.gup !== undefined) {
      i = +b.dataset.gup;
      var t = state.gallery[i - 1]; state.gallery[i - 1] = state.gallery[i]; state.gallery[i] = t;
    } else if (b.dataset.gdown !== undefined) {
      i = +b.dataset.gdown;
      var t2 = state.gallery[i + 1]; state.gallery[i + 1] = state.gallery[i]; state.gallery[i] = t2;
    } else if (b.dataset.gdel !== undefined) {
      i = +b.dataset.gdel;
      if (!confirm("Retirer cette photo de la photothèque ?")) return;
      state.gallery.splice(i, 1);
    } else if (b.dataset.gswap !== undefined) {
      i = +b.dataset.gswap;
      var input = $("#admFile"); input.value = "";
      input.onchange = function () {
        var f = input.files[0]; if (!f) return;
        readImage(f).then(function (img) {
          var g = state.gallery[i];
          var thumbData = toSquare(img, 600, 0.82);
          var wideData = toWide(img, 1400, 0.8);
          state.newImages[g.thumb] = thumbData;
          state.newImages[g.src] = wideData;
          saveDraft(); renderGallery();
        }).catch(function (error) { reportImageError(error, f); });
      };
      input.click();
      return;
    } else return;
    saveDraft(); renderGallery();
  });

  /* =========================================================
     AVIS
     ========================================================= */
  function renderTesti() {
    if (!state.testimonials.length) {
      $("#admTesti").innerHTML = '<div class="adm-empty">' + ic("star") +
        "<div>Aucun avis publié. Ajoutez uniquement un retour client réel et autorisé.</div></div>";
      return;
    }
    $("#admTesti").innerHTML = state.testimonials.map(function (t, i) {
      return '<div class="adm-tcard">' +
        '<div class="top"><img src="' + esc(src(t.src)) + '" alt="" data-timg="' + i + '" title="Changer le portrait">' +
          '<div style="flex:1"><div class="adm-field" style="margin:0 0 6px">' +
            '<input data-tname="' + i + '" value="' + esc(t.name) + '" placeholder="Nom du client"></div>' +
            '<div class="adm-field" style="margin:0"><input data-trole="' + i + '" value="' + esc(t.designation) + '" placeholder="Ville · Maillot acheté"></div>' +
          "</div>" +
          '<button class="icon-btn danger" data-tdel="' + i + '" aria-label="Supprimer">' + ic("delete", "icon-sm") + "</button>" +
        "</div>" +
        '<div class="adm-field" style="margin:0"><textarea data-tquote="' + i + '" placeholder="Ce que dit le client…">' + esc(t.quote) + "</textarea></div>" +
      "</div>";
    }).join("");
  }

  $("#admTesti").addEventListener("input", function (e) {
    var el = e.target, i;
    if ((i = el.dataset.tname) !== undefined) state.testimonials[+i].name = el.value;
    else if ((i = el.dataset.trole) !== undefined) state.testimonials[+i].designation = el.value;
    else if ((i = el.dataset.tquote) !== undefined) state.testimonials[+i].quote = el.value;
    else return;
    saveDraft();
  });
  $("#admTesti").addEventListener("click", function (e) {
    var del = e.target.closest("[data-tdel]");
    if (del) {
      if (!confirm("Supprimer cet avis ?")) return;
      state.testimonials.splice(+del.dataset.tdel, 1);
      saveDraft(); renderTesti(); refreshCounters(); return;
    }
    var img = e.target.closest("[data-timg]");
    if (img) {
      var i = +img.dataset.timg;
      var input = $("#admFile"); input.value = "";
      input.onchange = function () {
        var f = input.files[0]; if (!f) return;
        readImage(f).then(function (im) {
          var target = "images/testimonials/t" + (i + 1) + ".jpg";
          var imageData = toSquare(im, 600, 0.82);
          state.newImages[target] = imageData;
          state.testimonials[i].src = target;
          saveDraft(); renderTesti();
        }).catch(function (error) { reportImageError(error, f); });
      };
      input.click();
    }
  });
  $("#admAddTesti").addEventListener("click", function () {
    state.testimonials.push({
      quote: "", name: "", designation: "",
      src: "images/testimonials/t" + (state.testimonials.length + 1) + ".svg",
    });
    saveDraft(); renderTesti(); refreshCounters();
  });

  /* =========================================================
     TEXTES DU SITE
     ========================================================= */
  var SOCIAL_FIELDS = ["instagram", "facebook", "tiktok"];

  function isHttpUrl(value) {
    try {
      var url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname;
    } catch (e) { return false; }
  }

  function siteFieldError(key, value) {
    var raw = String(value == null ? "" : value);
    var text = raw.trim();
    if (key === "whatsapp" && (raw !== text || !/^[1-9]\d{7,14}$/.test(text))) {
      return "Le numéro WhatsApp doit contenir 8 à 15 chiffres au format international, sans +.";
    }
    if (key === "whatsappDisplay") {
      var expected = String(state.site.whatsapp || "").replace(/\D/g, "");
      var displayed = text.replace(/\D/g, "");
      if (!displayed || displayed !== expected) {
        return "Le numéro affiché doit contenir les mêmes chiffres que le numéro WhatsApp.";
      }
    }
    if (SOCIAL_FIELDS.indexOf(key) > -1 && text && (raw !== text || !isHttpUrl(text))) {
      return "L'URL doit commencer par http:// ou https:// et être valide.";
    }
    return "";
  }

  function updateSiteFieldValidity(el) {
    if (!el || typeof el.setCustomValidity !== "function") return "";
    var message = siteFieldError(el.dataset.site, el.value);
    el.setCustomValidity(message);
    return message;
  }

  function validateSite(showError) {
    var invalid = null;
    $$("[data-site]").forEach(function (el) {
      var message = updateSiteFieldValidity(el);
      if (!invalid && (message || !el.checkValidity())) {
        invalid = { el: el, message: message || el.validationMessage || "Ce champ est invalide." };
      }
    });
    var incompleteTestimonial = state.testimonials.find(function (item) {
      return !String(item.name || "").trim() || !String(item.quote || "").trim() || !String(item.src || "").trim();
    });
    if (!invalid && state.site.showTestimonials === true && (state.testimonials.length === 0 || incompleteTestimonial)) {
      invalid = {
        el: $('[data-site="showTestimonials"]'),
        message: state.testimonials.length === 0
          ? "Ajoutez au moins un avis réel avant d'afficher les témoignages."
          : "Complétez le nom, le texte et l'image de chaque avis avant de les afficher.",
      };
    }
    if (!invalid && state.site.showGallery === true && state.gallery.length === 0) {
      invalid = { el: $('[data-site="showGallery"]'), message: "Ajoutez au moins une photo avant d'afficher la photothèque." };
    }
    if (invalid && showError) {
      $('.adm-tab[data-tab="textes"]').click();
      alert(invalid.message);
      invalid.el.focus();
      invalid.el.reportValidity();
    }
    return !invalid;
  }

  function syncDeliveryThreshold() {
    var threshold = Number(state.site.freeShippingThreshold);
    if (!Number.isFinite(threshold) || threshold < 0 || !Array.isArray(state.site.deliveryRows)) return;
    var formatted = Math.round(threshold).toLocaleString("fr-FR") + " FCFA";
    state.site.deliveryRows.forEach(function (row) {
      if (row && /^\s*Gratuit\s+dès\b/i.test(String(row.cost || ""))) row.cost = "Gratuit dès " + formatted;
    });
  }

  function renderSite() {
    syncDeliveryThreshold();
    $$("[data-site]").forEach(function (el) {
      var k = el.dataset.site;
      var v = state.site[k];
      if (el.type === "checkbox") el.checked = !!v;
      else el.value = v == null ? "" : v;
      updateSiteFieldValidity(el);
      el.addEventListener("input", function () {
        state.site[k] = el.type === "checkbox" ? el.checked
                      : el.type === "number" ? Number(el.value)
                      : el.value;
        if (k === "freeShippingThreshold") syncDeliveryThreshold();
        updateSiteFieldValidity(el);
        if (k === "whatsapp") updateSiteFieldValidity($('[data-site="whatsappDisplay"]'));
        state.siteTouched = true;
        saveDraft();
      });
      el.addEventListener("blur", function () {
        if (updateSiteFieldValidity(el)) el.reportValidity();
      });
      if (el.type === "checkbox") {
        el.addEventListener("change", function () {
          state.site[k] = el.checked; state.siteTouched = true; saveDraft();
        });
      }
    });
  }

  /* =========================================================
     EXPORT
     ========================================================= */
  function download(name, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  function buildDataJs() {
    return "// Données du site — exporté depuis admin.html le " + new Date().toLocaleString("fr-FR") + "\n" +
      "window.PRODUCTS = " + JSON.stringify(state.products, null, 2) + ";\n\n" +
      "window.LEAGUES = " + JSON.stringify(state.leagues, null, 2) + ";\n\n" +
      "window.GALLERY = " + JSON.stringify(state.gallery, null, 2) + ";\n\n" +
      "window.TESTIMONIALS = " + JSON.stringify(state.testimonials, null, 2) + ";\n";
  }
  function buildConfigJs() {
    syncDeliveryThreshold();
    return "/* Textes du site — exporté depuis admin.html le " + new Date().toLocaleString("fr-FR") + " */\n" +
      "window.SITE = " + JSON.stringify(state.site, null, 2) + ";\n";
  }

  function productsAreValid(showError) {
    var bad = state.products.find(function (p) {
      return !Number.isInteger(Number(p.price)) || Number(p.price) <= 0 ||
        !Number.isInteger(Number(p.priceOriginal)) || Number(p.priceOriginal) < Number(p.price) ||
        !Number.isInteger(Number(p.stock)) || Number(p.stock) < 0 ||
        !String(p.name || "").trim() || !String(p.description || "").trim() ||
        !Array.isArray(p.sizes) || p.sizes.length === 0;
    });
    if (bad && showError) {
      alert("Le maillot « " + (bad.name || bad.slug) + " » contient des données invalides (nom, description, prix, stock ou tailles). Corrigez-le avant d'exporter data.js.");
    }
    return !bad;
  }

  $("#dlData").addEventListener("click", function () {
    if (!productsAreValid(true)) return;
    var badTestimonial = state.testimonials.find(function (item) {
      return !String(item.name || "").trim() || !String(item.quote || "").trim() || !String(item.src || "").trim();
    });
    if (badTestimonial) {
      alert("Chaque avis exporté doit contenir au minimum un nom, un texte et une image.");
      $('.adm-tab[data-tab="avis"]').click();
      return;
    }
    download("data.js", buildDataJs(), "text/javascript");
  });
  $("#dlConfig").addEventListener("click", function () {
    if (!validateSite(true)) return;
    download("site-config.js", buildConfigJs(), "text/javascript");
  });

  /* --- ZIP « stocké » (sans compression), écrit à la main pour éviter
         toute dépendance externe. Les JPEG sont déjà compressés. --- */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    var c = 0xffffffff;
    for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function dataUrlToBytes(url) {
    if (typeof url !== "string" || url.indexOf(",") < 0) {
      throw new Error("Une image du brouillon est illisible.");
    }
    var b64 = url.split(",")[1];
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function makeZip(files) {                       // files : [{name, bytes}]
    var enc = new TextEncoder();
    var chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var nameB = enc.encode(f.name);
      var crc = crc32(f.bytes), size = f.bytes.length;
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0, true);
      lh.setUint16(8, 0, true);                    // stocké
      lh.setUint16(10, 0, true); lh.setUint16(12, 0, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
      lh.setUint16(26, nameB.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), nameB, f.bytes);

      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
      ch.setUint16(28, nameB.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameB);
      offset += 30 + nameB.length + size;
    });
    var cSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cSize, true); end.setUint32(16, offset, true);
    end.setUint16(20, 0, true);
    return new Blob(chunks.concat(central, [new Uint8Array(end.buffer)]), { type: "application/zip" });
  }

  $("#dlImages").addEventListener("click", function () {
    var names = Object.keys(state.newImages);
    if (!names.length) { alert("Aucune image modifiée pour l'instant."); return; }
    try {
      var files = names.map(function (n) { return { name: n, bytes: dataUrlToBytes(state.newImages[n]) }; });
      download("images-le-maillot-ideal.zip", makeZip(files));
    } catch (error) {
      console.error("Impossible de créer l'archive d'images", error);
      alert("Impossible de créer l'archive d'images. Effacez l'image concernée du brouillon ou importez-la de nouveau.");
    }
  });

  function renderDiff() {
    var nImg = Object.keys(state.newImages).length;
    var nProd = Object.keys(state.touched).length;
    var bytes = Object.keys(state.newImages).reduce(function (a, k) {
      return a + Math.round(state.newImages[k].length * 0.75);
    }, 0);
    $("#admDiff").innerHTML =
      "<b>" + nProd + "</b> maillot" + (nProd > 1 ? "s" : "") + " modifié" + (nProd > 1 ? "s" : "") + " · " +
      "<b>" + nImg + "</b> image" + (nImg > 1 ? "s" : "") + " remplacée" + (nImg > 1 ? "s" : "") +
      (nImg ? " (" + (bytes / 1024 / 1024).toFixed(2) + " Mo)" : "") + " · " +
      "<b>" + state.gallery.length + "</b> photo" + (state.gallery.length > 1 ? "s" : "") + " en photothèque · " +
      "<b>" + state.testimonials.length + "</b> avis";
    $("#imgCountLabel").textContent = nImg
      ? nImg + " image(s) à envoyer, déjà redimensionnées (" + (bytes / 1024 / 1024).toFixed(2) + " Mo au total)."
      : "Aucune image modifiée pour l'instant.";
  }

  $("#admReset").addEventListener("click", function () {
    if (!confirm("Effacer le brouillon et revenir aux fichiers en ligne ?\nLes fichiers déjà publiés ne sont pas touchés.")) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    location.reload();
  });

  /* ---------- démarrage ---------- */
  loadDraft();
  initLeagueSelect();
  renderProducts();
  renderGallery();
  renderTesti();
  renderSite();
  wireFieldLabels(document);
  refreshCounters();
  renderDiff();
})();
