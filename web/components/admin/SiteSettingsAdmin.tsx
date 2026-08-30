"use client";

// Porté depuis admin-src/src/components/site/SiteTextsTab.jsx. Différence avec
// l'original : un seul bouton « Enregistrer » envoie l'objet complet à la Server
// Action (qui revalide tout le site après écriture) plutôt qu'un état de
// brouillon mis à jour en continu.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Icon } from "@/components/icons/Icon";
import { showToast } from "@/components/Toast";
import { updateSiteSettingsAction } from "@/lib/actions/settings";
import { siteFieldError, syncDeliveryThreshold } from "@/lib/validation";
import type { SiteSettings } from "@/lib/types";

function useFieldValidity(inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, dataKey: string, site: SiteSettings) {
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.setCustomValidity(siteFieldError(dataKey, el.value, site));
  });
}

export function SiteSettingsAdmin({ initialSettings }: { initialSettings: SiteSettings }) {
  const [site, setSite] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "site"), (snap) => {
      if (snap.exists()) setSite(snap.data() as SiteSettings);
    });
    return unsub;
  }, []);

  function setField<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setSite((s) => ({ ...s, [key]: value }));
  }

  function setThreshold(value: number) {
    setSite((s) => {
      const next = { ...s, freeShippingThreshold: value, deliveryRows: s.deliveryRows.map((r) => ({ ...r })) };
      syncDeliveryThreshold(next);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const form = formRef.current;
    if (form && !form.checkValidity()) {
      form.reportValidity();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await updateSiteSettingsAction(site);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast("Réglages enregistrés", "check-circle");
    } catch {
      setError("Échec de l'enregistrement. Vérifiez votre connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  }

  const whatsappRef = useRef<HTMLInputElement>(null);
  const whatsappDisplayRef = useRef<HTMLInputElement>(null);
  const instagramRef = useRef<HTMLInputElement>(null);
  const facebookRef = useRef<HTMLInputElement>(null);
  const tiktokRef = useRef<HTMLInputElement>(null);
  useFieldValidity(whatsappRef, "whatsapp", site);
  useFieldValidity(whatsappDisplayRef, "whatsappDisplay", site);
  useFieldValidity(instagramRef, "instagram", site);
  useFieldValidity(facebookRef, "facebook", site);
  useFieldValidity(tiktokRef, "tiktok", site);

  function reportInvalid(e: React.FocusEvent<HTMLInputElement>) {
    if (!e.currentTarget.checkValidity()) e.currentTarget.reportValidity();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      {error ? (
        <div className="adm-warn" style={{ maxWidth: 900 }}>
          <Icon name="error" />
          <div>{error}</div>
        </div>
      ) : null}

      <div className="adm-grid2" style={{ maxWidth: 900 }}>
        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: 14 }}>Bandeau d&apos;accueil</h3>
          <div className="adm-field">
            <label>Badge</label>
            <input value={site.heroBadge} onChange={(e) => setField("heroBadge", e.target.value)} />
          </div>
          <div className="adm-field">
            <label>Titre, ligne 1</label>
            <input value={site.heroTitle1} onChange={(e) => setField("heroTitle1", e.target.value)} />
          </div>
          <div className="adm-field">
            <label>Titre, ligne 2</label>
            <input value={site.heroTitle2} onChange={(e) => setField("heroTitle2", e.target.value)} />
          </div>
          <div className="adm-field">
            <label>Texte d&apos;introduction</label>
            <textarea value={site.heroLead} onChange={(e) => setField("heroLead", e.target.value)} />
          </div>

          <h3 style={{ fontSize: "1rem", margin: "26px 0 14px" }}>Chiffres clés</h3>
          <div className="adm-grid2">
            <div className="adm-field">
              <label>Délai</label>
              <input value={site.statDelay} onChange={(e) => setField("statDelay", e.target.value)} />
            </div>
            <div className="adm-field">
              <label>Légende</label>
              <input value={site.statDelayLabel} onChange={(e) => setField("statDelayLabel", e.target.value)} />
            </div>
            <div className="adm-field">
              <label>Note</label>
              <input value={site.statRating} onChange={(e) => setField("statRating", e.target.value)} />
            </div>
            <div className="adm-field">
              <label>Légende</label>
              <input value={site.statRatingLabel} onChange={(e) => setField("statRatingLabel", e.target.value)} />
            </div>
          </div>
          <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>
            N&apos;affichez une note moyenne que si elle correspond à de vrais avis.
          </p>
        </div>

        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: 14 }}>Coordonnées</h3>
          <div className="adm-field">
            <label>Numéro WhatsApp (format international, sans +)</label>
            <input
              ref={whatsappRef}
              value={site.whatsapp}
              inputMode="numeric"
              pattern="[1-9][0-9]{7,14}"
              required
              placeholder="237655634265"
              onChange={(e) => setField("whatsapp", e.target.value)}
              onBlur={reportInvalid}
            />
          </div>
          <div className="adm-field">
            <label>Numéro affiché</label>
            <input
              ref={whatsappDisplayRef}
              value={site.whatsappDisplay}
              inputMode="tel"
              required
              onChange={(e) => setField("whatsappDisplay", e.target.value)}
              onBlur={reportInvalid}
            />
          </div>
          <div className="adm-field">
            <label>E-mail</label>
            <input type="email" value={site.email} onChange={(e) => setField("email", e.target.value)} />
          </div>
          <div className="adm-field">
            <label>Adresse / zone de retrait</label>
            <input value={site.address} onChange={(e) => setField("address", e.target.value)} />
          </div>
          <div className="adm-field">
            <label>Ville (données structurées)</label>
            <input required value={site.addressLocality} onChange={(e) => setField("addressLocality", e.target.value)} />
          </div>
          <div className="adm-field">
            <label>Horaires</label>
            <input value={site.hours} onChange={(e) => setField("hours", e.target.value)} />
          </div>
          <div className="adm-field">
            <label>Délai de réponse annoncé</label>
            <input value={site.responseTime} onChange={(e) => setField("responseTime", e.target.value)} />
          </div>

          <h3 style={{ fontSize: "1rem", margin: "26px 0 14px" }}>Réseaux sociaux</h3>
          <div className="adm-field">
            <label>Instagram</label>
            <input
              ref={instagramRef}
              type="url"
              inputMode="url"
              placeholder="https://instagram.com/…"
              value={site.instagram}
              onChange={(e) => setField("instagram", e.target.value)}
              onBlur={reportInvalid}
            />
          </div>
          <div className="adm-field">
            <label>Facebook</label>
            <input
              ref={facebookRef}
              type="url"
              inputMode="url"
              placeholder="https://facebook.com/…"
              value={site.facebook}
              onChange={(e) => setField("facebook", e.target.value)}
              onBlur={reportInvalid}
            />
          </div>
          <div className="adm-field">
            <label>TikTok</label>
            <input
              ref={tiktokRef}
              type="url"
              inputMode="url"
              placeholder="https://tiktok.com/@…"
              value={site.tiktok}
              onChange={(e) => setField("tiktok", e.target.value)}
              onBlur={reportInvalid}
            />
          </div>
          <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>
            Laissé vide, le lien est retiré du site au lieu de pointer vers le vide.
          </p>

          <h3 style={{ fontSize: "1rem", margin: "26px 0 14px" }}>Livraison</h3>
          <div className="adm-field">
            <label>Seuil de livraison offerte (FCFA)</label>
            <input
              type="number"
              min={0}
              step={500}
              required
              value={site.freeShippingThreshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </div>

          <label className="adm-check">
            <input type="checkbox" checked={site.showDemoNotice} onChange={(e) => setField("showDemoNotice", e.target.checked)} />
            Afficher les bandeaux « photos de démonstration »
          </label>
          <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>
            À décocher une fois vos vraies photos en ligne.
          </p>
          <label className="adm-check">
            <input type="checkbox" checked={site.showGallery} onChange={(e) => setField("showGallery", e.target.checked)} />
            Afficher la photothèque publique
          </label>
          <label className="adm-check">
            <input
              type="checkbox"
              checked={site.showTestimonials}
              onChange={(e) => setField("showTestimonials", e.target.checked)}
            />
            Afficher les avis clients
          </label>
          <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>
            Activez ces sections uniquement lorsque leur contenu réel et autorisé est prêt.
          </p>
          <label className="adm-check">
            <input
              type="checkbox"
              checked={site.catalogDataVerified}
              onChange={(e) => setField("catalogDataVerified", e.target.checked)}
            />
            Données du catalogue vérifiées
          </label>
          <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>
            Cochez uniquement après avoir contrôlé prix, stocks et descriptions des produits.
          </p>
          <label className="adm-check">
            <input
              type="checkbox"
              checked={site.commercialTermsVerified}
              onChange={(e) => setField("commercialTermsVerified", e.target.checked)}
            />
            Conditions commerciales vérifiées
          </label>
          <p className="hint" style={{ fontSize: ".76rem", color: "var(--on-surface-variant)" }}>
            Cochez uniquement après validation des délais, frais, paiements et conditions de retour.
          </p>
        </div>
      </div>

      <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={saving}>
        <Icon name="save" size="sm" />
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
