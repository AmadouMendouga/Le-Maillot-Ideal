// Porté depuis la section EXPORT de admin.html et js/admin.js (lignes
// ~732-936 : téléchargements, ZIP, publication en un clic, réinitialisation).
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useDraftState } from "../../state/useDraftState.jsx";
import { crossFieldSiteErrors, productsAreValid, siteFieldError } from "../../lib/validation.js";
import { buildConfigJs, buildDataJs } from "../../lib/exportBuilders.js";
import { dataUrlToBytes, makeZip } from "../../lib/zip.js";
import StatefulButton from "../shared/StatefulButton.jsx";

function download(name, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime || "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

// Valide l'ensemble des champs [data-site] réels (contraintes HTML natives +
// règles métier de validation.js) — possible parce que tous les onglets
// restent montés en permanence (voir App.jsx), exactement comme l'original
// où tous les <input data-site> existent dans le DOM quel que soit l'onglet
// affiché.
function validateSiteNow(state, showError, onSwitchTab) {
  let invalid = null;
  document.querySelectorAll("[data-site]").forEach((el) => {
    if (invalid) return;
    const message = siteFieldError(el.dataset.site, el.value, state.site);
    if (typeof el.setCustomValidity === "function") el.setCustomValidity(message);
    if (message || !el.checkValidity()) {
      invalid = { el, message: message || el.validationMessage || "Ce champ est invalide." };
    }
  });
  if (!invalid) {
    const crossError = crossFieldSiteErrors({ site: state.site, testimonials: state.testimonials, gallery: state.gallery });
    if (crossError) {
      invalid = { el: document.querySelector('[data-site="' + crossError.field + '"]'), message: crossError.message };
    }
  }
  if (invalid && showError) {
    flushSync(() => onSwitchTab("textes"));
    alert(invalid.message);
    if (invalid.el) {
      invalid.el.focus();
      if (typeof invalid.el.reportValidity === "function") invalid.el.reportValidity();
    }
  }
  return !invalid;
}

function findIncompleteTestimonial(testimonials) {
  return testimonials.find((item) => (
    !String(item.name || "").trim() || !String(item.quote || "").trim() || !String(item.src || "").trim()
  ));
}

export default function ExportTab({ active, onSwitchTab }) {
  const { state, resetDraft } = useDraftState();
  const [publishStatus, setPublishStatus] = useState({ className: "adm-publish-status", html: "" });

  const nImg = Object.keys(state.newImages).length;
  const nProd = Object.keys(state.touched).length;
  const bytes = Object.keys(state.newImages).reduce((a, k) => a + Math.round(state.newImages[k].length * 0.75), 0);
  const mo = (bytes / 1024 / 1024).toFixed(2);

  function guardProductsAndTestimonials(forExport) {
    const bad = productsAreValid(state.products);
    if (bad) {
      alert(
        "Le maillot « " + (bad.name || bad.slug) +
          " » contient des données invalides (nom, description, prix, stock ou tailles). Corrigez-le avant d'" +
          (forExport ? "exporter data.js." : "enregistrer."),
      );
      return false;
    }
    const badTestimonial = findIncompleteTestimonial(state.testimonials);
    if (badTestimonial) {
      alert(
        forExport
          ? "Chaque avis exporté doit contenir au minimum un nom, un texte et une image."
          : "Chaque avis publié doit contenir au minimum un nom, un texte et une image.",
      );
      onSwitchTab("avis");
      return false;
    }
    return true;
  }

  function handleDownloadData() {
    if (!guardProductsAndTestimonials(true)) return;
    download("data.js", buildDataJs(state), "text/javascript");
  }

  function handleDownloadConfig() {
    if (!validateSiteNow(state, true, onSwitchTab)) return;
    download("site-config.js", buildConfigJs(state.site), "text/javascript");
  }

  function handleDownloadImages() {
    const entries = Object.entries(state.newImages);
    if (!entries.length) { alert("Aucune image modifiée pour l'instant."); return; }
    try {
      const files = entries.map(([name, dataUrl]) => ({ name, bytes: dataUrlToBytes(dataUrl) }));
      download("images-le-maillot-ideal.zip", makeZip(files));
    } catch (error) {
      console.error("Impossible de créer l'archive d'images", error);
      alert("Impossible de créer l'archive d'images. Effacez l'image concernée du brouillon ou importez-la de nouveau.");
    }
  }

  function handleReset() {
    if (!confirm("Effacer le brouillon et revenir aux fichiers en ligne ?\nLes fichiers déjà publiés ne sont pas touchés.")) return;
    resetDraft();
  }

  function validatePublish() {
    if (!guardProductsAndTestimonials(false)) return false;
    if (!validateSiteNow(state, true, onSwitchTab)) return false;
    setPublishStatus({ className: "adm-publish-status", html: "" });
    return true;
  }

  async function runPublish() {
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        products: state.products,
        leagues: state.leagues,
        gallery: state.gallery,
        testimonials: state.testimonials,
        site: state.site,
        newImages: state.newImages,
      }),
    });
    let data = {};
    try { data = await res.json(); } catch { /* réponse non-JSON : data reste {} */ }
    if (!res.ok || !data.ok) throw new Error((data && data.error) || "La publication a échoué.");

    const failed = data.failedImages || [];
    if (failed.length) {
      setPublishStatus({
        className: "adm-publish-status is-warning",
        html: "Publié — les prix, stocks et textes sont à jour en ligne. ⚠ " + failed.length +
          (failed.length > 1 ? " photos n'ont" : " photo n'a") + " pas pu être envoyée" + (failed.length > 1 ? "s" : "") +
          ", l'ancienne reste affichée. Réessayez « Publier » dans quelques minutes. " +
          '<a href="' + data.commitUrl + '" target="_blank" rel="noopener">Voir le commit</a>.',
      });
      console.warn("Photos non publiées :", failed);
    } else {
      setPublishStatus({
        className: "adm-publish-status is-ok",
        html: "Publié — le site sera à jour dans environ une minute. " +
          '<a href="' + data.commitUrl + '" target="_blank" rel="noopener">Voir le commit</a>.',
      });
    }
  }

  function handlePublishError(error) {
    console.error("Publication échouée :", error);
    const message = /resource not accessible|401|403/i.test(error.message || "")
      ? "La publication n'est pas encore configurée correctement côté serveur. Contactez le développeur avant de réessayer."
      : (error.message || "La publication a échoué. Réessayez dans quelques minutes.");
    setPublishStatus({ className: "adm-publish-status is-error", html: message });
  }

  async function handlePublishRun() {
    try {
      await runPublish();
    } catch (error) {
      handlePublishError(error);
      throw error; // StatefulButton doit voir l'échec pour jouer son animation d'erreur
    }
  }

  return (
    <section className={"adm-panel" + (active ? " active" : "")} data-panel="export">
      <div className="adm-diff" style={{ marginBottom: 20 }}>
        <b>{nProd}</b> maillot{nProd > 1 ? "s" : ""} modifié{nProd > 1 ? "s" : ""} · <b>{nImg}</b> image{nImg > 1 ? "s" : ""} remplacée{nImg > 1 ? "s" : ""}
        {nImg ? " (" + mo + " Mo)" : ""} · <b>{state.gallery.length}</b> photo{state.gallery.length > 1 ? "s" : ""} en photothèque · <b>{state.testimonials.length}</b> avis
      </div>

      <div className="adm-step adm-step-publish">
        <div>
          <h4>Publier en ligne</h4>
          <p>
            Envoie directement vos modifications sur le site — aucun fichier à télécharger ni à
            déposer. Le site public reflète le changement en ligne sous environ une minute.
          </p>
          <StatefulButton id="admPublish" className="btn btn-primary btn-sm" validate={validatePublish} onRun={handlePublishRun}>
            <svg className="icon icon-sm" aria-hidden="true"><use href="#i-publish"></use></svg>Publier en ligne maintenant
          </StatefulButton>
          <p
            id="admPublishStatus"
            className={publishStatus.className}
            role="status"
            aria-live="polite"
            // eslint-disable-next-line react/no-danger -- lien vers le commit GitHub, construit uniquement à partir de data.commitUrl
            dangerouslySetInnerHTML={{ __html: publishStatus.html }}
          />
        </div>
      </div>

      <div className="adm-warn" style={{ marginTop: 24 }}>
        <svg className="icon" aria-hidden="true"><use href="#i-error"></use></svg>
        <div>
          <strong>Solution de secours hors ligne.</strong> Si la publication en ligne ci-dessus est
          indisponible, vous pouvez toujours télécharger les fichiers ci-dessous et les déposer
          manuellement chez votre hébergeur.
        </div>
      </div>

      <div className="adm-steps">
        <div className="adm-step">
          <div>
            <h4>Télécharger les données</h4>
            <p>Contient les produits, la photothèque et les avis. À placer dans le dossier <code>js/</code>.</p>
            <button type="button" id="dlData" className="btn btn-primary btn-sm" onClick={handleDownloadData}>
              <svg className="icon icon-sm" aria-hidden="true"><use href="#i-save"></use></svg>data.js
            </button>
          </div>
        </div>
        <div className="adm-step">
          <div>
            <h4>Télécharger les textes</h4>
            <p>Contient les coordonnées, les textes d'accueil et les réglages. À placer dans <code>js/</code>.</p>
            <button type="button" id="dlConfig" className="btn btn-primary btn-sm" onClick={handleDownloadConfig}>
              <svg className="icon icon-sm" aria-hidden="true"><use href="#i-save"></use></svg>site-config.js
            </button>
          </div>
        </div>
        <div className="adm-step">
          <div>
            <h4>Télécharger les images modifiées</h4>
            <p>
              {nImg ? nImg + " image(s) à envoyer, déjà redimensionnées (" + mo + " Mo au total)." : "Aucune image modifiée pour l'instant."}
            </p>
            <button type="button" id="dlImages" className="btn btn-primary btn-sm" onClick={handleDownloadImages}>
              <svg className="icon icon-sm" aria-hidden="true"><use href="#i-image"></use></svg>images.zip
            </button>
          </div>
        </div>
        <div className="adm-step">
          <div>
            <h4>Régénérer les fiches produit</h4>
            <p>
              Décompressez l'archive à la racine du site en conservant les dossiers
              (<code>images/photos/</code>, <code>images/gallery/</code>, <code>images/testimonials/</code>),
              puis remplacez <code>js/data.js</code> et <code>js/site-config.js</code>. À la racine,
              exécutez ensuite <code>npm run generate:products</code> : cette étape met à jour
              les fiches indexables du dossier <code>produits/</code> et le <code>sitemap.xml</code>.
            </p>
          </div>
        </div>
        <div className="adm-step">
          <div>
            <h4>Mettre en ligne manuellement</h4>
            <p>
              Envoyez les fichiers remplacés, le dossier <code>produits/</code> régénéré et{" "}
              <code>sitemap.xml</code> chez votre hébergeur. Si vous ne pouvez pas exécuter
              Node.js, transmettez les exports au mainteneur du site.
              Rechargez le site avec <strong>Ctrl+F5</strong> pour vider le cache.
            </p>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: "1rem", margin: "34px 0 12px" }}>Réinitialiser</h3>
      <p style={{ fontSize: ".85rem", color: "var(--on-surface-variant)", maxWidth: 600 }}>
        Efface votre brouillon local et revient aux fichiers actuellement en ligne.
        Les fichiers déjà publiés ne sont pas touchés.
      </p>
      <button type="button" id="admReset" className="btn btn-outline btn-sm" onClick={handleReset}>
        <svg className="icon icon-sm" aria-hidden="true"><use href="#i-refresh"></use></svg>Effacer le brouillon
      </button>
    </section>
  );
}
