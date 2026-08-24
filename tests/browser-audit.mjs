import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, "http://127.0.0.1");
      const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const target = path.resolve(root, `.${relative}`);
      if (!target.startsWith(`${root}${path.sep}`) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      response.writeHead(200, { "Content-Type": mime[path.extname(target)] || "application/octet-stream" });
      fs.createReadStream(target).pipe(response);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const server = await startServer();
const address = server.address();
const base = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true });
let failures = 0;

function check(condition, message) {
  if (condition) return;
  failures += 1;
  console.error(`ÉCHEC — ${message}`);
}

try {
  const routes = [
    "index.html",
    "shop.html",
    "produits/maillot-domicile-cameroun.html",
    "phototheque.html",
    "merci.html",
    "confidentialite.html",
    "404.html",
    "admin.html",
  ];

  for (const route of routes) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const errors = [];
    const external = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname !== "127.0.0.1" && url.protocol !== "data:") external.push(url.href);
    });
    const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    check(response?.status() === 200, `${route} ne répond pas en 200`);
    check(errors.length === 0, `${route} produit des erreurs : ${errors.join(" | ")}`);
    check(external.length === 0, `${route} charge des ressources externes`);
    const audit = await page.evaluate(() => ({
      brokenImages: [...document.images].filter((image) =>
        image.getClientRects().length > 0 && image.complete && image.naturalWidth === 0 && image.src
      ).length,
      missingIcons: [...document.querySelectorAll("use")].filter((use) => {
        const id = (use.getAttribute("href") || "").split("#").pop();
        return id && !document.getElementById(id);
      }).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      unrenderedIcons: [...document.querySelectorAll("svg.icon")].filter((icon) => {
        if (icon.getClientRects().length === 0) return false;
        try {
          const box = icon.getBBox();
          return box.width === 0 && box.height === 0;
        } catch (error) {
          return true;
        }
      }).length,
      duplicateIds: [...document.querySelectorAll("[id]")]
        .map((element) => element.id)
        .filter((id, index, ids) => id && ids.indexOf(id) !== index),
      h1Count: document.querySelectorAll("h1").length,
    }));
    check(audit.brokenImages === 0, `${route} contient des images cassées`);
    check(audit.missingIcons === 0, `${route} contient des icônes absentes`);
    check(audit.unrenderedIcons === 0, `${route} contient des icônes non rendues`);
    check(audit.duplicateIds.length === 0, `${route} contient des identifiants dupliqués : ${audit.duplicateIds.join(", ")}`);
    check(audit.h1Count === 1, `${route} doit contenir exactement un titre h1`);
    check(audit.overflow <= 0, `${route} déborde sur mobile`);
    if (route.startsWith("produits/")) {
      const beforePath = new URL(page.url()).pathname;
      await page.locator(".skip-link").focus();
      await page.keyboard.press("Enter");
      check(new URL(page.url()).pathname === beforePath, `${route} a un lien d'évitement qui quitte la fiche`);
      check(new URL(page.url()).hash === "#main", `${route} a un lien d'évitement qui ne cible pas le contenu`);
    }
    if (route === "index.html") {
      const closedNav = await page.locator(".main-nav").evaluate((nav) => ({
        hidden: nav.getAttribute("aria-hidden"),
        inert: nav.inert,
      }));
      check(closedNav.hidden === "true" && closedNav.inert, "le menu mobile fermé reste accessible au clavier");
      await page.locator(".nav-toggle").click();
      check(
        await page.locator(".main-nav").evaluate((nav) => nav.getAttribute("aria-hidden") === "false" && !nav.inert),
        "le menu mobile ouvert reste masqué aux technologies d'assistance",
      );
      await page.keyboard.press("Escape");
      check(
        await page.evaluate(() => document.activeElement === document.querySelector(".nav-toggle")),
        "la fermeture du menu mobile ne restaure pas le focus",
      );
      check(await page.evaluate(() => window.lmiContactValid() === false), "le formulaire de contact vide est accepté");
      await page.locator("#cName").fill("Client test");
      await page.locator("#cPhone").fill("--------");
      await page.locator("#cMsg").fill("Question test");
      check(
        await page.evaluate(() => window.lmiContactValid() === false),
        "un téléphone sans chiffre est accepté",
      );
      await page.locator("#cName").fill("  ");
      await page.locator("#cPhone").fill("+237 699 999 999");
      await page.locator("#cMsg").fill("     ");
      check(
        await page.evaluate(() => window.lmiContactValid() === false),
        "des champs de contact composés d'espaces sont acceptés",
      );
      await page.locator("#cName").fill("Client test");
      await page.locator("#cPhone").fill("+237 699 999 999");
      await page.locator("#cMsg").fill("Je souhaite vérifier un maillot.");
      check(await page.evaluate(() => window.lmiContactValid() === true), "le formulaire de contact valide est refusé");
      const contactHref = decodeURIComponent(await page.locator("#contactWaBtn").getAttribute("href") || "");
      check(
        contactHref.includes("Client test") &&
          contactHref.includes("699 999 999") &&
          contactHref.includes("Je souhaite vérifier un maillot."),
        "le lien de contact WhatsApp n'intègre pas les champs saisis",
      );
    }
    if (route === "shop.html") {
      const labels = await page.locator(".quick-add").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") || ""));
      check(labels.length > 0 && labels.every((label) => /Ajouter .+ au panier|indisponible/i.test(label)), "les ajouts rapides n'ont pas de nom accessible précis");
    }
    if (route === "admin.html") {
      check(await page.locator("#admDrawer").evaluate((drawer) => drawer.inert), "le tiroir admin fermé reste tabulable");
      await page.locator("[data-edit]").first().click();
      check(
        await page.locator("#admDrawer").evaluate((drawer) => !drawer.inert && drawer.getAttribute("aria-hidden") === "false"),
        "le tiroir admin ouvert reste inerte",
      );
      await page.keyboard.press("Escape");
      check(await page.locator("#admDrawer").evaluate((drawer) => drawer.inert), "le tiroir admin fermé reste actif");
      check(
        await page.evaluate(() => document.activeElement?.hasAttribute("data-edit")),
        "le tiroir admin ne restaure pas le focus",
      );
      await page.locator('.adm-tab[data-tab="avis"]').click();
      await page.locator("#admAddTesti").click();
      await page.locator('.adm-tab[data-tab="textes"]').click();
      await page.locator('[data-site="showTestimonials"]').check();
      await page.locator('.adm-tab[data-tab="export"]').click();
      let validationMessage = "";
      page.once("dialog", async (dialog) => {
        validationMessage = dialog.message();
        await dialog.dismiss();
      });
      await page.locator("#dlConfig").click();
      check(/Complétez le nom, le texte et l'image/i.test(validationMessage), "la configuration autorise un avis vide à être publié");
    }
    const themeBefore = await page.locator("html").getAttribute("data-theme");
    await page.locator(".theme-toggle").first().click();
    check(
      await page.locator("html").getAttribute("data-theme") !== themeBefore,
      `${route} ne change pas de thème`,
    );
    await page.close();
  }

  for (const route of ["index.html", "shop.html", "produits/maillot-domicile-cameroun.html"]) {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
      hasTouch: false,
      isMobile: false,
    });
    const errors = [];
    const external = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname !== "127.0.0.1" && url.protocol !== "data:") external.push(url.href);
    });
    await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    check(errors.length === 0, `${route} produit des erreurs en vrai contexte desktop : ${errors.join(" | ")}`);
    check(external.length === 0, `${route} charge des ressources externes en desktop`);
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      `${route} déborde en vrai contexte desktop`,
    );
    check(await page.locator(".nav-toggle").isHidden(), `${route} affiche le bouton du menu mobile en desktop`);
    if (route === "index.html") {
      const menuTrigger = page.locator('[data-menu="boutique"] .am-trigger');
      await menuTrigger.focus();
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(180);
      check(
        await page.evaluate(() => document.activeElement === document.querySelector("#amCard a[href]")),
        "Flèche bas n'entre pas dans le menu desktop",
      );
      const panelLinks = page.locator("#amCard a[href]");
      await panelLinks.nth((await panelLinks.count()) - 1).focus();
      await page.keyboard.press("Tab");
      check(
        await page.locator("#amCard").evaluate((card) => !card.classList.contains("open")),
        "le menu desktop reste ouvert après la sortie du focus",
      );
      check(
        await menuTrigger.getAttribute("aria-expanded") === "false",
        "le déclencheur desktop reste annoncé comme ouvert après la sortie du focus",
      );
    }
    await page.close();
  }

  const noJavaScript = await browser.newPage({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
  });
  await noJavaScript.goto(`${base}index.html`, { waitUntil: "load" });
  check(await noJavaScript.locator(".main-nav").isVisible(), "la navigation disparaît sans JavaScript");
  check(await noJavaScript.locator(".main-nav a").count() >= 5, "le menu sans JavaScript est incomplet");
  await noJavaScript.goto(`${base}shop.html`, { waitUntil: "load" });
  check(await noJavaScript.locator(".static-product-links a").count() === 76, "les fiches ne sont pas accessibles depuis la boutique sans JavaScript");
  await noJavaScript.goto(`${base}produits/maillot-domicile-cameroun.html`, { waitUntil: "load" });
  check((await noJavaScript.locator("h1").textContent())?.trim().length > 0, "la fiche produit est vide sans JavaScript");
  const noJsAction = await noJavaScript.locator("#pdWhatsapp").evaluate((element) => ({
    href: element.getAttribute("href"),
    disabled: element.getAttribute("aria-disabled"),
  }));
  check(!!noJsAction.href || noJsAction.disabled === "true", "l'état de commande de la fiche disparaît sans JavaScript");
  await noJavaScript.close();

  const corrupt = await browser.newPage();
  await corrupt.addInitScript(() => localStorage.setItem("lmi_cart_v3", "{"));
  const corruptErrors = [];
  corrupt.on("pageerror", (error) => corruptErrors.push(error.message));
  await corrupt.goto(`${base}shop.html`, { waitUntil: "networkidle" });
  check(corruptErrors.length === 0, "un panier corrompu fait planter le catalogue");
  check(await corrupt.locator(".product-card").count() > 0, "le catalogue ne se rend pas après réparation du panier");
  check(await corrupt.evaluate(() => localStorage.getItem("lmi_cart_v3") === "[]"), "un panier v3 invalide n'est pas réparé dans le stockage");
  await corrupt.close();

  const unverifiedShop = await browser.newPage();
  await unverifiedShop.route("**/js/site-config.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `window.SITE = {
        siteUrl: "https://le-maillot-ideal.com/", whatsapp: "237655634265",
        responseTime: "Réponse à confirmer", instagram: "", facebook: "", tiktok: "",
        showDemoNotice: true, catalogDataVerified: false, commercialTermsVerified: false
      };`,
    });
  });
  await unverifiedShop.goto(`${base}shop.html`, { waitUntil: "networkidle" });
  check(await unverifiedShop.locator("#availabilityFilters").isHidden(), "les filtres de stock non vérifié restent affichés");
  check(await unverifiedShop.locator("#sortSelect").inputValue() === "default", "le catalogue non vérifié se présente comme des nouveautés");
  await unverifiedShop.close();

  const cart = await browser.newPage();
  await cart.route("**/js/site-config.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `window.SITE = {
        siteUrl: "https://le-maillot-ideal.com/", whatsapp: "237655634265",
        responseTime: "Réponse à confirmer", instagram: "", facebook: "", tiktok: "",
        showDemoNotice: true, catalogDataVerified: false, commercialTermsVerified: false
      };`,
    });
  });
  await cart.route("**/js/data.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `window.PRODUCTS = [{
        id: 1, slug: "maillot-domicile-psg", name: "Produit test panier",
        team: "Équipe test", league: "test", leagueLabel: "Championnat test",
        kit: "Domicile", season: "2026", description: "Description de test.",
        image: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%2210%22%3E%3C%2Fsvg%3E", sizes: ["M", "L"], kidsAvailable: false,
        price: 12800, priceOriginal: 17000, discountPct: 25, stock: 17,
        isNew: false, rating: null, reviews: 0
      }];
      window.LEAGUES = { test: { label: "Championnat test", color: "#075e54" } };
      window.GALLERY = [];
      window.TESTIMONIALS = [];`,
    });
  });
  await cart.addInitScript(() => {
    localStorage.removeItem("lmi_cart_v3");
    localStorage.setItem("lmi_cart_v2", JSON.stringify([{
      slug: "maillot-domicile-psg",
      size: "M",
      qty: 1,
      name: "PRIX ALTÉRÉ",
      price: 1,
    }]));
  });
  await cart.goto(`${base}shop.html`, { waitUntil: "networkidle" });
  const cartState = await cart.evaluate(() => ({
    subtotal: document.querySelector("#cartSubtotal")?.textContent || "",
    href: document.querySelector("#cartCheckout")?.href || "",
  }));
  const decodedCartHref = decodeURIComponent(cartState.href);
  check(
    Number(cartState.subtotal.replace(/\D/g, "")) === 12800,
    "le panier n'utilise pas le prix du catalogue",
  );
  check(decodedCartHref.includes("Produit test panier"), "le lien WhatsApp n'utilise pas le nom du catalogue");
  check(!cartState.subtotal.includes("1 FCFA"), "le panier fait confiance à un prix local altéré");
  check(!decodedCartHref.includes("PRIX ALTÉRÉ"), "le panier fait confiance à un nom local altéré");
  await cart.evaluate(() => {
    const checkout = document.querySelector("#cartCheckout");
    checkout.addEventListener("click", (event) => event.preventDefault(), true);
    checkout.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  check(await cart.evaluate(() => JSON.parse(localStorage.getItem("lmi_cart_v3")).length === 1), "le panier est vidé avant confirmation réelle");
  await cart.close();

  const unavailable = await browser.newPage();
  await unavailable.route("**/js/site-config.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `window.SITE = {
        siteUrl: "https://le-maillot-ideal.com/",
        whatsapp: "237655634265",
        freeShippingThreshold: 15000,
        responseTime: "Réponse à confirmer",
        instagram: "", facebook: "", tiktok: "",
        showDemoNotice: true, catalogDataVerified: true, commercialTermsVerified: true
      };`,
    });
  });
  await unavailable.route("**/js/data.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `window.PRODUCTS = [
        {
          id: 1, slug: "maillot-domicile-pays-bas", name: "Produit test indisponible",
          team: "Équipe test", league: "test", leagueLabel: "Championnat test",
          kit: "Domicile", season: "2026", description: "Description de test vérifiée.",
          image: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%2210%22%3E%3C%2Fsvg%3E", sizes: ["M", "L"], kidsAvailable: false,
          price: 15000, priceOriginal: 15000, discountPct: 0, stock: 0,
          isNew: false, rating: null, reviews: 0
        },
        {
          id: 2, slug: "maillot-domicile-psg", name: "Produit test remisé",
          team: "Équipe test", league: "test", leagueLabel: "Championnat test",
          kit: "Domicile", season: "2026", description: "Description de test vérifiée.",
          image: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%2210%22%3E%3C%2Fsvg%3E", sizes: ["M", "L"], kidsAvailable: false,
          price: 12800, priceOriginal: 17000, discountPct: 25, stock: 17,
          isNew: true, rating: null, reviews: 0
        }
      ];
      window.LEAGUES = { test: { label: "Championnat test", color: "#075e54" } };
      window.GALLERY = [];
      window.TESTIMONIALS = [];`,
    });
  });
  await unavailable.goto(`${base}produits/maillot-domicile-pays-bas.html`, { waitUntil: "networkidle" });
  const unavailableState = await unavailable.evaluate(() => {
    const button = document.querySelector("#pdWhatsapp");
    const productData = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => { try { return JSON.parse(script.textContent); } catch (error) { return null; } })
      .find((data) => data && data["@type"] === "Product");
    return {
      href: button?.getAttribute("href"),
      disabled: button?.getAttribute("aria-disabled"),
      offers: productData?.offers || null,
    };
  });
  check(!unavailableState.href && unavailableState.disabled === "true", "une rupture reste commandable sur WhatsApp");
  check(
    unavailableState.offers?.price === 15000 && unavailableState.offers?.priceCurrency === "XAF" &&
      unavailableState.offers?.availability?.endsWith("OutOfStock"),
    "l'offre structurée vérifiée est absente ou invalide",
  );
  await unavailable.goto(`${base}produits/maillot-domicile-psg.html`, { waitUntil: "networkidle" });
  const verifiedDiscount = await unavailable.evaluate(() => {
    const productData = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => { try { return JSON.parse(script.textContent); } catch (error) { return null; } })
      .find((data) => data && data["@type"] === "Product");
    return {
      oldPrice: document.querySelector(".pd-info .price-old")?.textContent || "",
      discount: document.querySelector(".discount-pill")?.textContent || "",
      offer: productData?.offers || null,
      terms: document.querySelector(".accordion-mini p")?.textContent || "",
    };
  });
  check(verifiedDiscount.oldPrice.includes("17") && verifiedDiscount.discount.includes("25"), "une remise vérifiée n'est pas rendue");
  check(
    verifiedDiscount.offer?.price === 12800 && verifiedDiscount.offer?.availability?.endsWith("InStock"),
    "l'offre remisée vérifiée est invalide",
  );
  check(!/à confirmer/i.test(verifiedDiscount.terms), "des modalités vérifiées restent présentées comme non vérifiées");
  await unavailable.close();

  const unverified = await browser.newPage();
  await unverified.route("**/js/site-config.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `window.SITE = {
        siteUrl: "https://le-maillot-ideal.com/", whatsapp: "237655634265",
        responseTime: "Réponse à confirmer", instagram: "", facebook: "", tiktok: "",
        showDemoNotice: true, catalogDataVerified: false, commercialTermsVerified: false
      };`,
    });
  });
  await unverified.route("**/js/data.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `window.PRODUCTS = [{
        id: 1, slug: "maillot-domicile-pays-bas", name: "Produit test non vérifié",
        team: "Équipe test", league: "test", leagueLabel: "Championnat test",
        kit: "Domicile", season: "2026", description: "Affirmation commerciale de test.",
        image: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%2210%22%3E%3C%2Fsvg%3E", sizes: ["M"], kidsAvailable: false,
        price: 10000, priceOriginal: 20000, discountPct: 50, stock: 0,
        isNew: true, rating: 5, reviews: 99
      }];
      window.LEAGUES = { test: { label: "Championnat test", color: "#075e54" } };
      window.GALLERY = [];
      window.TESTIMONIALS = [];`,
    });
  });
  await unverified.goto(`${base}produits/maillot-domicile-pays-bas.html`, { waitUntil: "networkidle" });
  const unverifiedState = await unverified.evaluate(() => ({
    badge: document.querySelector(".pd-info .badge")?.textContent || "",
    oldPrice: document.querySelector(".pd-info .price-old")?.textContent || "",
    whatsapp: document.querySelector("#pdWhatsapp")?.getAttribute("href") || "",
    offers: [...document.querySelectorAll('script[type="application/ld+json"]')]
      .some((script) => script.textContent.includes('"offers"')),
  }));
  check(unverifiedState.badge.includes("confirmer"), "un stock non vérifié est présenté comme certain");
  check(!unverifiedState.oldPrice, "une remise non vérifiée reste affichée");
  check(!!unverifiedState.whatsapp, "un produit non vérifié ne peut pas être demandé sur WhatsApp");
  check(!unverifiedState.offers, "une offre structurée est publiée avec des données non vérifiées");
  await unverified.close();

  const legacyProductUrl = await browser.newPage();
  await legacyProductUrl.goto(`${base}product.html?slug=maillot-domicile-cameroun`, { waitUntil: "networkidle" });
  check(
    new URL(legacyProductUrl.url()).pathname.endsWith("/produits/maillot-domicile-cameroun.html"),
    "une ancienne URL produit n'est pas redirigée vers sa fiche statique",
  );
  await legacyProductUrl.close();

  const missingCatalog = await browser.newPage();
  await missingCatalog.route("**/js/data.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: "window.PRODUCTS = []; window.LEAGUES = {}; window.GALLERY = []; window.TESTIMONIALS = [];",
    });
  });
  await missingCatalog.goto(`${base}produits/maillot-domicile-cameroun.html`, { waitUntil: "domcontentloaded" });
  await missingCatalog.waitForURL("**/404.html");
  check(
    new URL(missingCatalog.url()).pathname === "/404.html",
    "une fiche sans donnée redirige vers un faux /produits/404.html",
  );
  await missingCatalog.close();

  const emptyPublishedContent = await browser.newPage();
  await emptyPublishedContent.route("**/js/site-config.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `window.SITE = {
        siteUrl: "https://le-maillot-ideal.com/", whatsapp: "237655634265",
        responseTime: "Réponse à confirmer", instagram: "", facebook: "", tiktok: "",
        showDemoNotice: true, showGallery: true, showTestimonials: true,
        catalogDataVerified: false, commercialTermsVerified: false
      };`,
    });
  });
  await emptyPublishedContent.route("**/js/data.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: "window.PRODUCTS = []; window.LEAGUES = {}; window.GALLERY = []; window.TESTIMONIALS = [];",
    });
  });
  await emptyPublishedContent.goto(`${base}phototheque.html`, { waitUntil: "networkidle" });
  check(
    await emptyPublishedContent.locator('[data-site-visible="showGallery"]').isHidden(),
    "une photothèque vide est affichée lorsque son indicateur vaut true",
  );
  check(
    await emptyPublishedContent.locator('[data-site-visible="showTestimonials"]').isHidden(),
    "une section d'avis vide est affichée lorsque son indicateur vaut true",
  );
  check(
    await emptyPublishedContent.locator("[data-site-empty-when]").isVisible(),
    "l'état de préparation disparaît alors que tous les contenus publiés sont vides",
  );
  await emptyPublishedContent.close();

  const publishedContent = await browser.newPage();
  await publishedContent.route("**/js/site-config.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `window.SITE = {
        siteUrl: "https://le-maillot-ideal.com/", whatsapp: "237655634265",
        responseTime: "Réponse à confirmer", instagram: "", facebook: "", tiktok: "",
        showDemoNotice: true, showGallery: true, showTestimonials: true,
        catalogDataVerified: false, commercialTermsVerified: false
      };`,
    });
  });
  await publishedContent.route("**/js/data.js", async (route) => {
    const fixtureImage =
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%2210%22%3E%3C%2Fsvg%3E";
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `window.PRODUCTS = []; window.LEAGUES = {};
        window.GALLERY = [{ src: "${fixtureImage}", thumb: "${fixtureImage}", alt: "Photo test", caption: "Galerie test" }];
        window.TESTIMONIALS = [{ quote: "Avis publié test", name: "Cliente test", designation: "Douala", src: "${fixtureImage}" }];`,
    });
  });
  await publishedContent.goto(`${base}phototheque.html`, { waitUntil: "networkidle" });
  check(
    await publishedContent.locator('[data-site-visible="showGallery"]').isVisible(),
    "une galerie publiée reste masquée",
  );
  check(
    await publishedContent.locator('[data-site-visible="showTestimonials"]').isVisible(),
    "des avis publiés restent masqués",
  );
  check(
    (await publishedContent.locator('[data-site-visible="showGallery"] img').count()) > 0,
    "la galerie publiée n'est pas rendue",
  );
  check(
    (await publishedContent.locator('[data-site-visible="showTestimonials"]').textContent()).includes(
      "Cliente test",
    ),
    "les avis publiés ne sont pas rendus",
  );
  check(
    await publishedContent.locator("[data-site-empty-when]").isHidden(),
    "l'état vide reste visible avec du contenu publié",
  );
  await publishedContent.close();

  const configured = await browser.newPage();
  await configured.route("**/js/site-config.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `window.SITE = {
        whatsapp: "237699999999",
        whatsappDisplay: "+237 699 999 999",
        freeShippingThreshold: 999999,
        email: "test@example.com",
        responseTime: "Réponse à confirmer",
        instagram: "", facebook: "", tiktok: "",
        showDemoNotice: true, catalogDataVerified: false
      };`,
    });
  });
  await configured.goto(`${base}shop.html`, { waitUntil: "networkidle" });
  await configured.locator(".quick-add:not([disabled])").first().click();
  const configuredHref = await configured.locator("#cartCheckout").getAttribute("href");
  check(configuredHref?.includes("237699999999"), "le panier ignore le numéro WhatsApp configuré");
  await configured.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (failures) {
  console.error(`\n${failures} contrôle(s) en échec.`);
  process.exitCode = 1;
} else {
  console.log("Audit navigateur réussi.");
}
