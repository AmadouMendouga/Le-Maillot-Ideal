// Génération pure du site public (fiches produit, pages configurables,
// sitemap) à partir de données déjà chargées et de gabarits HTML fournis en
// mémoire — aucun accès à fs/path ici. Utilisé par scripts/generate-product-pages.mjs
// (lecture locale) et par api/publish.js (lecture via l'API GitHub).

const money = (value) => Number(value).toLocaleString("fr-FR") + " FCFA";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);
const jsonLd = (data) => JSON.stringify(data).replace(/</g, "\\u003c");
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function replaceConfiguredText(html, key, value) {
  const pattern = new RegExp(
    `(<([a-z][\\w-]*)\\b[^>]*\\bdata-cfg=["']${escapeRegExp(key)}["'][^>]*>)[\\s\\S]*?(<\\/\\2>)`,
    "gi",
  );
  return html.replace(pattern, (match, opening, tag, closing) => `${opening}${escapeHtml(value)}${closing}`);
}

function setMarkerHidden(html, attribute, value, hidden) {
  const pattern = new RegExp(
    `<([a-z][\\w-]*)([^>]*\\b${escapeRegExp(attribute)}=["']${escapeRegExp(value)}["'][^>]*)>`,
    "gi",
  );
  return html.replace(pattern, (match, tag, attributes) => {
    const clean = attributes.replace(/\s+hidden(?:=["'][^"']*["'])?/gi, "");
    return `<${tag}${clean}${hidden ? " hidden" : ""}>`;
  });
}

function setDemoNoticeHidden(html, hidden) {
  return html.replace(/<([a-z][\w-]*)([^>]*\bclass=["'][^"']*\bdemo-note\b[^"']*["'][^>]*)>/gi, (match, tag, attributes) => {
    const clean = attributes.replace(/\s+hidden(?:=["'][^"']*["'])?/gi, "");
    return `<${tag}${clean}${hidden ? " hidden" : ""}>`;
  });
}

function syncSocialLinks(html, SITE) {
  for (const key of ["instagram", "facebook", "tiktok"]) {
    let url = "";
    try {
      const parsed = new URL(String(SITE[key] || ""));
      if (parsed.protocol === "https:" || parsed.protocol === "http:") url = parsed.href;
    } catch (error) {
      url = "";
    }
    const pattern = new RegExp(`<a([^>]*\\bdata-social=["']${key}["'][^>]*)>`, "gi");
    html = html.replace(pattern, (match, attributes) => {
      const clean = attributes
        .replace(/\s+hidden(?:=["'][^"']*["'])?/gi, "")
        .replace(/\s+href=["'][^"']*["']/gi, "")
        .replace(/\s+target=["'][^"']*["']/gi, "")
        .replace(/\s+rel=["'][^"']*["']/gi, "");
      return `<a${clean}${url ? ` href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"` : " hidden"}>`;
    });
  }
  return html;
}

function syncConfiguredFallbacks(source, { SITE, GALLERY, TESTIMONIALS }) {
  let html = source;
  const whatsapp = String(SITE.whatsapp || "").replace(/\D/g, "") || "237655634265";
  const configuredDisplay = String(SITE.whatsappDisplay || "");
  const display = configuredDisplay.replace(/\D/g, "") === whatsapp ? configuredDisplay : `+${whatsapp}`;

  for (const [key, value] of Object.entries(SITE)) {
    if (typeof value === "string" || typeof value === "number") {
      html = replaceConfiguredText(html, key, key === "whatsappDisplay" ? display : value);
    }
  }
  html = html.replace(/https:\/\/wa\.me\/\d+/g, `https://wa.me/${whatsapp}`);
  if (String(SITE.email || "").trim()) {
    html = html.replace(/mailto:[^"']*/g, `mailto:${escapeHtml(String(SITE.email).trim())}`);
  }
  html = syncSocialLinks(html, SITE);

  const galleryVisible = SITE.showGallery === true && Array.isArray(GALLERY) && GALLERY.length > 0;
  const testimonialsVisible = SITE.showTestimonials === true && Array.isArray(TESTIMONIALS) && TESTIMONIALS.length > 0;
  html = setMarkerHidden(html, "data-site-visible", "showGallery", !galleryVisible);
  html = setMarkerHidden(html, "data-site-visible", "showTestimonials", !testimonialsVisible);
  html = setMarkerHidden(html, "data-site-empty-when", "showGallery showTestimonials", galleryVisible || testimonialsVisible);
  html = setMarkerHidden(html, "data-site-unverified", "catalogDataVerified", SITE.catalogDataVerified === true);
  html = setDemoNoticeHidden(html, SITE.showDemoNotice === false);

  const galleryMarkup = GALLERY.map((photo, index) =>
    `<a class="photo-item dah" href="${escapeHtml(photo.src)}" aria-label="Ouvrir la photo ${index + 1}">` +
      `<span class="dah-img"><img src="${escapeHtml(photo.thumb)}" alt="Photo ${index + 1}" loading="lazy"></span>` +
      '<span class="dah-overlay"></span>' +
      `<span class="dah-caption"><span class="t">Photo ${index + 1}</span><span class="s">Ouvrir l'image</span></span></a>`,
  ).join("");
  html = html.replace(/<div class="photo-grid" id="photoGrid">[\s\S]*?<\/div>/, `<div class="photo-grid" id="photoGrid">${galleryMarkup}</div>`);

  const testimonialMarkup = TESTIMONIALS.map((item) =>
    `<figure class="testimonial-static"><blockquote>${escapeHtml(item.quote || "")}</blockquote>` +
      `<figcaption>${escapeHtml(item.name || "")}${item.designation ? ` — ${escapeHtml(item.designation)}` : ""}</figcaption></figure>`,
  ).join("");
  html = html.replace(/(<div id="at(?:Home|Photo)"[^>]*>)[\s\S]*?(<\/div>)/g, `$1${testimonialMarkup}$2`);

  const deliveryRows = SITE.commercialTermsVerified === true && Array.isArray(SITE.deliveryRows) && SITE.deliveryRows.length
    ? SITE.deliveryRows
    : [{ zone: "À confirmer", delay: "À confirmer sur WhatsApp", cost: "À confirmer", payment: "À confirmer" }];
  const deliveryMarkup = deliveryRows.map((row) =>
    `              <tr><td>${escapeHtml(row.zone ?? "À confirmer")}</td><td>${escapeHtml(row.delay ?? "À confirmer")}</td>` +
      `<td>${escapeHtml(row.cost ?? "À confirmer")}</td><td>${escapeHtml(row.payment ?? "À confirmer")}</td></tr>`,
  ).join("\n");
  html = html.replace(/(<tbody[^>]*data-delivery-rows[^>]*>)[\s\S]*?(<\/tbody>)/, `$1\n${deliveryMarkup}\n            $2`);
  return html;
}

function publicProductDescription(product, SITE) {
  if (SITE.catalogDataVerified === true && product.description) return String(product.description);
  const season = product.season ? `, saison ${product.season}` : "";
  return `${product.name || "Maillot"}${season}. Caractéristiques, prix, tailles et disponibilité à confirmer sur WhatsApp.`;
}

function stockInfo(product, SITE) {
  if (SITE.catalogDataVerified !== true) {
    return { className: "badge-stock-low", label: "Disponibilité à confirmer", available: true };
  }
  if (product.stock === 0) return { className: "badge-stock-out", label: "Rupture de stock", available: false };
  if (product.stock <= 5) return { className: "badge-stock-low", label: `Plus que ${product.stock} en stock`, available: true };
  return { className: "badge-stock-ok", label: "En stock", available: true };
}

function whatsappLink(product, size, SITE) {
  const message = [
    "*Le Maillot Idéal* — demande de commande",
    "",
    `• 1 x ${product.name} (taille ${size}) — ${money(product.price)}`,
    "",
    `*${SITE.catalogDataVerified === true ? "Total" : "Total indicatif"} : ${money(product.price)}*`,
    SITE.commercialTermsVerified !== true
      ? "Modalités de paiement et de livraison à confirmer sur WhatsApp."
      : "Paiement et livraison selon les modalités applicables à votre zone.",
    "",
    "Merci de me confirmer le prix, la disponibilité et le délai de livraison.",
  ].join("\n");
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}

function productMarkup(product, SITE) {
  const stock = stockInfo(product, SITE);
  const description = publicProductDescription(product, SITE);
  const defaultSize = product.sizes.includes("M") ? "M" : product.sizes[0];
  const catalogVerified = SITE.catalogDataVerified === true;
  const termsVerified = SITE.commercialTermsVerified === true;
  const priceNote = !catalogVerified
    ? '<p class="form-note catalog-unverified">Prix et stock indicatifs — confirmation sur WhatsApp avant toute livraison.</p>'
    : "";
  const deliveryText = termsVerified
    ? "Livraison et paiement selon les modalités indiquées sur le site."
    : "Le délai, les frais, la disponibilité et le moyen de paiement sont confirmés sur WhatsApp avant toute commande.";
  const action = stock.available
    ? `<a class="btn btn-whatsapp btn-lg" id="pdWhatsapp" data-stateful data-stateful-delay="600" href="${escapeHtml(whatsappLink(product, defaultSize, SITE))}" target="_blank" rel="noopener"><svg class="icon"><use href="#i-chat"></use></svg>Commander sur WhatsApp</a>`
    : '<span class="btn btn-whatsapp btn-lg disabled" id="pdWhatsapp" role="link" aria-disabled="true"><svg class="icon"><use href="#i-chat"></use></svg>Indisponible</span>';

  return `<div class="product-detail" id="productDetail" data-static-product>
      <div class="pd-media lens" data-lens data-lens-zoom="1.5" data-lens-size="170">
        <div class="lens-img"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}, saison ${escapeHtml(product.season)}" width="500" height="500"></div>
        <div class="lens-glass" aria-hidden="true"></div>
      </div>
      <div class="pd-info">
        <h1 class="pd-title">${escapeHtml(product.name)}</h1>
        <p class="pd-meta"><svg class="icon icon-sm"><use href="#i-soccer"></use></svg>${escapeHtml(product.leagueLabel)} · ${escapeHtml(product.kit)} · Saison ${escapeHtml(product.season)}</p>
        <div class="pd-price"><span class="price-now">${escapeHtml(money(product.price))}</span>${catalogVerified && product.discountPct > 0 ? `<span class="price-old">${escapeHtml(money(product.priceOriginal))}</span><span class="discount-pill">-${product.discountPct}%</span>` : ""}</div>
        <span class="badge ${stock.className}">${escapeHtml(stock.label)}</span>
        ${priceNote}
        <p class="pd-desc" style="margin-top:14px">${escapeHtml(description)}</p>
        <div class="pd-section"><h3>Taille</h3><div class="size-grid" id="sizeGrid">${product.sizes.map((size) => `<button type="button" class="size-opt${size === defaultSize ? " selected" : ""}" data-size="${escapeHtml(size)}" disabled aria-disabled="true">${escapeHtml(size)}</button>`).join("")}</div></div>
        <div class="pd-section"><h3>Quantité</h3><div class="qty-stepper" id="qtyStepper"><button type="button" data-act="dec" aria-label="Diminuer" disabled><svg class="icon"><use href="#i-remove"></use></svg></button><span id="qtyValue">1</span><button type="button" data-act="inc" aria-label="Augmenter" disabled><svg class="icon"><use href="#i-add"></use></svg></button></div></div>
        ${stock.available ? `<p class="form-note">Sans JavaScript, la demande WhatsApp ci-dessous est préparée pour 1 article en taille ${escapeHtml(defaultSize)}. Vous pourrez modifier le message dans WhatsApp.</p>` : ""}
        <div class="pd-ctas"><button type="button" class="btn btn-primary btn-lg" id="addToCartBtn" disabled aria-disabled="true"><svg class="icon"><use href="#i-cart"></use></svg>${stock.available ? "Panier disponible avec JavaScript" : "Indisponible"}</button>${action}</div>
        <p class="form-note"><svg class="icon icon-sm"><use href="#i-hourglass"></use></svg> <span data-cfg="responseTime">${escapeHtml(SITE.responseTime || "Délai de réponse à confirmer")}</span></p>
        <div class="pd-section">
          <details class="accordion-mini" open><summary><svg class="icon"><use href="#i-shipping"></use></svg>Livraison &amp; paiement</summary><p>${escapeHtml(deliveryText)}</p></details>
          <details class="accordion-mini"><summary><svg class="icon"><use href="#i-ruler"></use></svg>Guide des tailles</summary><p>Les coupes peuvent varier selon le modèle. Envoyez votre taille habituelle ou vos mesures sur WhatsApp afin de confirmer le choix avant la commande.</p></details>
          <details class="accordion-mini"><summary><svg class="icon"><use href="#i-swap"></use></svg>Retours &amp; échanges</summary><p>Les conditions d'échange sont confirmées avant la commande. Contactez le vendeur dès réception en cas de problème.</p></details>
        </div>
      </div>
    </div>`;
}

function createPage(product, { template, SITE, siteUrl }) {
  const relativeUrl = `produits/${product.slug}.html`;
  const canonical = siteUrl + relativeUrl;
  const description = publicProductDescription(product, SITE);
  const breadcrumb = `<nav class="breadcrumb" aria-label="Fil d'ariane" id="pdBreadcrumb">
      <a href="index.html">Accueil</a><span class="sep"><svg class="icon"><use href="#i-chevron-right"></use></svg></span>
      <a href="shop.html">Boutique</a><span class="sep"><svg class="icon"><use href="#i-chevron-right"></use></svg></span>
      <a href="shop.html?league=${escapeHtml(product.league)}">${escapeHtml(product.leagueLabel)}</a><span class="sep"><svg class="icon"><use href="#i-chevron-right"></use></svg></span>
      <span aria-current="page">${escapeHtml(product.name)}</span>
    </nav>`;
  const productData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: [siteUrl + product.image],
    description,
    sku: product.slug,
  };
  if (SITE.catalogDataVerified === true) {
    productData.offers = {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "XAF",
      price: product.price,
      availability: `https://schema.org/${product.stock > 0 ? "InStock" : "OutOfStock"}`,
    };
  }
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Boutique", item: siteUrl + "shop.html" },
      { "@type": "ListItem", position: 3, name: product.leagueLabel, item: `${siteUrl}shop.html?league=${product.league}` },
      { "@type": "ListItem", position: 4, name: product.name, item: canonical },
    ],
  };

  let page = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(product.name)} | Le Maillot Idéal</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="index,follow,max-image-preview:large">')
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonical}">`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(product.name)} | Le Maillot Idéal">`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(description)}">`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${canonical}">`)
    .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${siteUrl + escapeHtml(product.image)}">`)
    .replace(/<meta property="og:image:width"[^>]*>\s*/, "")
    .replace(/<meta property="og:image:height"[^>]*>\s*/, "")
    .replace(/<body([^>]*)>/, `<body$1 data-product-slug="${escapeHtml(product.slug)}">`)
    .replace('href="#main"', `href="${relativeUrl}#main"`)
    .replace(/<nav class="breadcrumb"[\s\S]*?id="pdBreadcrumb">[\s\S]*?<\/nav>/, breadcrumb)
    .replace(/<div class="product-detail" id="productDetail">[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/, `${productMarkup(product, SITE)}\n    </div>\n  </section>`);

  page = page.replace(/href="#i-/g, `href="${relativeUrl}#i-`);

  page = page.replace(
    /(<meta name="viewport"[^>]*>)/,
    `$1\n<base href="../">`,
  );
  const structuredData = [
    SITE.catalogDataVerified === true
      ? `<script type="application/ld+json" data-static-ld="product">${jsonLd(productData)}</script>`
      : "",
    `<script type="application/ld+json" data-static-ld="breadcrumb">${jsonLd(breadcrumbData)}</script>`,
  ].filter(Boolean).join("\n");
  page = page.replace("</head>", `${structuredData}\n</head>`);
  return page;
}

/**
 * @param {object} args
 * @param {any[]} args.PRODUCTS
 * @param {Record<string, any>} args.SITE
 * @param {any[]} args.GALLERY
 * @param {any[]} args.TESTIMONIALS
 * @param {object} args.templates gabarits sources : product, shop, phototheque, index, merci, confidentialite, notFound
 */
export function generateSite({ PRODUCTS, SITE, GALLERY, TESTIMONIALS, templates }) {
  const siteUrl = String(SITE.siteUrl || "https://le-maillot-ideal.com/").replace(/\/?$/, "/");
  const ctx = { SITE, GALLERY, TESTIMONIALS };

  for (const product of PRODUCTS) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(product.slug || ""))) {
      throw new Error(`Slug produit non sûr : ${product.slug}`);
    }
  }

  const template = syncConfiguredFallbacks(templates.product, ctx);
  const shopTemplate = syncConfiguredFallbacks(templates.shop, ctx);
  const photothequeTemplate = syncConfiguredFallbacks(templates.phototheque, ctx);
  const otherPublicPages = new Map([
    ["index.html", syncConfiguredFallbacks(templates.index, ctx)],
    ["merci.html", syncConfiguredFallbacks(templates.merci, ctx)],
    ["confidentialite.html", syncConfiguredFallbacks(templates.confidentialite, ctx)],
    ["404.html", syncConfiguredFallbacks(templates.notFound, ctx)],
  ]);

  const generated = new Map(PRODUCTS.map((product) => [`${product.slug}.html`, createPage(product, { template, SITE, siteUrl })]));
  if (generated.size !== PRODUCTS.length) {
    throw new Error("Les slugs produit doivent être uniques.");
  }

  const productLinksBlock = `<!-- GENERATED_PRODUCT_LINKS_START -->
          <noscript class="static-product-links">
            <p>Activez JavaScript pour utiliser les filtres. Les fiches restent accessibles ci-dessous.</p>
            <ul>
${PRODUCTS.map((product) => `              <li><a href="produits/${product.slug}.html">${escapeHtml(product.name)}</a></li>`).join("\n")}
            </ul>
          </noscript>
          <!-- GENERATED_PRODUCT_LINKS_END -->`;
  const generatedShop = shopTemplate.replace(
    /<!-- GENERATED_PRODUCT_LINKS_START -->[\s\S]*?<!-- GENERATED_PRODUCT_LINKS_END -->/,
    productLinksBlock,
  );

  const photothequeIndexable =
    (SITE.showGallery === true && Array.isArray(GALLERY) && GALLERY.length > 0) ||
    (SITE.showTestimonials === true && Array.isArray(TESTIMONIALS) && TESTIMONIALS.length > 0);
  const generatedPhototheque = photothequeTemplate.replace(
    /<meta name="robots"[^>]*>/,
    `<meta name="robots" content="${photothequeIndexable ? "index,follow,max-image-preview:large" : "noindex,follow"}">`,
  );

  const synchronizedPublicPages = new Map(otherPublicPages);
  synchronizedPublicPages.set("product.html", template);

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}</loc></url>
  <url><loc>${siteUrl}shop.html</loc></url>
${photothequeIndexable ? `  <url><loc>${siteUrl}phototheque.html</loc></url>\n` : ""}${PRODUCTS.map((product) => `  <url><loc>${siteUrl}produits/${product.slug}.html</loc></url>`).join("\n")}
  <url><loc>${siteUrl}confidentialite.html</loc></url>
</urlset>
`;

  return {
    produits: generated,
    shopHtml: generatedShop,
    photothequeHtml: generatedPhototheque,
    sitemapXml: sitemap,
    files: synchronizedPublicPages, // product.html, index.html, merci.html, confidentialite.html, 404.html
  };
}

export function buildDataJs({ PRODUCTS, LEAGUES, GALLERY, TESTIMONIALS }) {
  return "// Données du site — publié depuis admin.html le " + new Date().toLocaleString("fr-FR") + "\n" +
    "window.PRODUCTS = " + JSON.stringify(PRODUCTS, null, 2) + ";\n\n" +
    "window.LEAGUES = " + JSON.stringify(LEAGUES, null, 2) + ";\n\n" +
    "window.GALLERY = " + JSON.stringify(GALLERY, null, 2) + ";\n\n" +
    "window.TESTIMONIALS = " + JSON.stringify(TESTIMONIALS, null, 2) + ";\n";
}

export function buildConfigJs(SITE) {
  return "/* Textes du site — publié depuis admin.html le " + new Date().toLocaleString("fr-FR") + " */\n" +
    "window.SITE = " + JSON.stringify(SITE, null, 2) + ";\n";
}
