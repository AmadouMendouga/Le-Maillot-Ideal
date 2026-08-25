// Porté depuis la section TEXTES de admin.html et renderSite() dans
// js/admin.js. Chaque champ garde l'attribut data-site="clé" — c'est ce que
// l'onglet Exporter interroge (comme l'original) pour valider l'ensemble
// avant publication/export, puisque tous les onglets restent montés en
// permanence (voir App.jsx).
import { useEffect, useRef } from "react";
import { useDraftState } from "../../state/useDraftState.jsx";
import { siteFieldError, syncDeliveryThreshold } from "../../lib/validation.js";

// Revalide en permanence (pas de dépendances : se ré-exécute à chaque rendu
// du composant parent) — c'est ce qui permet à whatsappDisplay de se
// revalider automatiquement quand whatsapp change ailleurs, sans référence
// croisée manuelle.
function useSiteFieldValidity(dataKey, inputRef, site) {
  useEffect(() => {
    const el = inputRef.current;
    if (!el || typeof el.setCustomValidity !== "function") return;
    el.setCustomValidity(siteFieldError(dataKey, el.value, site));
  });
}

function Field({ dataKey, label, hint, type = "text", textarea, ...inputProps }) {
  const { state, dispatch } = useDraftState();
  const inputRef = useRef(null);
  useSiteFieldValidity(dataKey, inputRef, state.site);
  const value = state.site[dataKey] == null ? "" : state.site[dataKey];

  function handleChange(e) {
    dispatch({ type: "SET_SITE_FIELD", key: dataKey, value: e.target.value });
  }
  function handleBlur() {
    const el = inputRef.current;
    if (el && !el.checkValidity()) el.reportValidity();
  }

  return (
    <div className="adm-field">
      <label>{label}</label>
      {textarea ? (
        <textarea ref={inputRef} data-site={dataKey} value={value} onChange={handleChange} onBlur={handleBlur} {...inputProps} />
      ) : (
        <input ref={inputRef} data-site={dataKey} type={type} value={value} onChange={handleChange} onBlur={handleBlur} {...inputProps} />
      )}
      {hint ? <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>{hint}</p> : null}
    </div>
  );
}

function NumberField({ dataKey, label, ...inputProps }) {
  const { state, dispatch } = useDraftState();
  const inputRef = useRef(null);
  useSiteFieldValidity(dataKey, inputRef, state.site);
  const value = state.site[dataKey] == null ? "" : state.site[dataKey];

  function handleChange(e) {
    const num = Number(e.target.value);
    dispatch({ type: "SET_SITE_FIELD", key: dataKey, value: num });
    if (dataKey === "freeShippingThreshold") {
      // syncDeliveryThreshold mute site.deliveryRows en place ; on republie
      // le tableau via un second dispatch pour que React voie le changement.
      const site = { ...state.site, [dataKey]: num, deliveryRows: state.site.deliveryRows ? state.site.deliveryRows.map((r) => ({ ...r })) : state.site.deliveryRows };
      syncDeliveryThreshold(site);
      dispatch({ type: "SET_SITE_FIELD", key: "deliveryRows", value: site.deliveryRows });
    }
  }
  function handleBlur() {
    const el = inputRef.current;
    if (el && !el.checkValidity()) el.reportValidity();
  }

  return (
    <div className="adm-field">
      <label>{label}</label>
      <input ref={inputRef} data-site={dataKey} type="number" value={value} onChange={handleChange} onBlur={handleBlur} {...inputProps} />
    </div>
  );
}

function CheckField({ dataKey, label }) {
  const { state, dispatch } = useDraftState();
  return (
    <label className="adm-check">
      <input
        type="checkbox" data-site={dataKey} checked={!!state.site[dataKey]}
        onChange={(e) => dispatch({ type: "SET_SITE_FIELD", key: dataKey, value: e.target.checked })}
      />
      {label}
    </label>
  );
}

export default function SiteTextsTab({ active }) {
  return (
    <section className={"adm-panel" + (active ? " active" : "")} data-panel="textes">
      <div className="adm-grid2" style={{ maxWidth: 900 }}>
        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: 14 }}>Bandeau d'accueil</h3>
          <Field dataKey="heroBadge" label="Badge" />
          <Field dataKey="heroTitle1" label="Titre, ligne 1" />
          <Field dataKey="heroTitle2" label="Titre, ligne 2" />
          <Field dataKey="heroLead" label="Texte d'introduction" textarea />

          <h3 style={{ fontSize: "1rem", margin: "26px 0 14px" }}>Chiffres clés</h3>
          <div className="adm-grid2">
            <Field dataKey="statDelay" label="Délai" />
            <Field dataKey="statDelayLabel" label="Légende" />
            <Field dataKey="statRating" label="Note" />
            <Field dataKey="statRatingLabel" label="Légende" />
          </div>
          <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>
            N'affichez une note moyenne que si elle correspond à de vrais avis.
          </p>
        </div>

        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: 14 }}>Coordonnées</h3>
          <Field
            dataKey="whatsapp" label="Numéro WhatsApp (format international, sans +)"
            inputMode="numeric" pattern="[1-9][0-9]{7,14}" required placeholder="237655634265"
          />
          <Field dataKey="whatsappDisplay" label="Numéro affiché" inputMode="tel" required />
          <Field dataKey="email" label="E-mail" type="email" />
          <Field dataKey="address" label="Adresse / zone de retrait" />
          <Field dataKey="addressLocality" label="Ville (données structurées)" required />
          <Field dataKey="hours" label="Horaires" />
          <Field dataKey="responseTime" label="Délai de réponse annoncé" />

          <h3 style={{ fontSize: "1rem", margin: "26px 0 14px" }}>Réseaux sociaux</h3>
          <Field dataKey="instagram" label="Instagram" type="url" inputMode="url" placeholder="https://instagram.com/…" />
          <Field dataKey="facebook" label="Facebook" type="url" inputMode="url" placeholder="https://facebook.com/…" />
          <Field dataKey="tiktok" label="TikTok" type="url" inputMode="url" placeholder="https://tiktok.com/@…" />
          <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>
            Laissé vide, le lien est retiré du site au lieu de pointer vers le vide.
          </p>

          <h3 style={{ fontSize: "1rem", margin: "26px 0 14px" }}>Livraison</h3>
          <NumberField dataKey="freeShippingThreshold" label="Seuil de livraison offerte (FCFA)" min="0" step="500" required />

          <CheckField dataKey="showDemoNotice" label="Afficher les bandeaux « photos de démonstration »" />
          <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>
            À décocher une fois vos vraies photos en ligne.
          </p>
          <CheckField dataKey="showGallery" label="Afficher la photothèque publique" />
          <CheckField dataKey="showTestimonials" label="Afficher les avis clients" />
          <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>
            Activez ces sections uniquement lorsque leur contenu réel et autorisé est prêt.
          </p>
          <CheckField dataKey="catalogDataVerified" label="Données du catalogue vérifiées" />
          <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>
            Cochez uniquement après avoir contrôlé prix, stocks et descriptions des 76 produits.
          </p>
          <CheckField dataKey="commercialTermsVerified" label="Conditions commerciales vérifiées" />
          <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>
            Cochez uniquement après validation des délais, frais, paiements et conditions de retour.
          </p>
        </div>
      </div>
    </section>
  );
}
