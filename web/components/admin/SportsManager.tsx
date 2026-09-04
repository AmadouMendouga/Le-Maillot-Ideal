"use client";

// Gestion des sports — clone du patron déjà en place pour les championnats
// (LeaguesManager.tsx). Ouvert depuis le bouton « Gérer les sports » de
// l'onglet Produits : ajouter un sport (ex. « Judo », « Basketball ») et
// renommer les existants à volonté.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/admin/Drawer";
import { ImageDropZone } from "@/components/admin/ImageDropZone";
import { Icon } from "@/components/icons/Icon";
import { showToast } from "@/components/Toast";
import { createSportAction, deleteSportAction, renameSportAction } from "@/lib/actions/sports";
import { uploadAdminImage, LOGO_TRANSFORMATION } from "@/lib/cloudinaryUpload";
import type { Sport } from "@/lib/types";

const HERO_FIELDS: { key: keyof Sport; label: string; multiline?: boolean }[] = [
  { key: "heroBadge", label: "Badge" },
  { key: "heroTitle1", label: "Titre, ligne 1" },
  { key: "heroTitle2", label: "Titre, ligne 2" },
  { key: "heroLead", label: "Texte d'introduction", multiline: true },
  { key: "statDelay", label: "Délai (chiffre)" },
  { key: "statDelayLabel", label: "Délai (légende)" },
  { key: "statRating", label: "Note (chiffre)" },
  { key: "statRatingLabel", label: "Note (légende)" },
];

function SportRow({ sport, onSaved, onDeleted }: { sport: Sport; onSaved: () => void; onDeleted: () => void }) {
  const [label, setLabel] = useState(sport.label);
  const [color, setColor] = useState(sport.color);
  const [hero, setHero] = useState({
    heroBadge: sport.heroBadge,
    heroTitle1: sport.heroTitle1,
    heroTitle2: sport.heroTitle2,
    heroLead: sport.heroLead,
    statDelay: sport.statDelay,
    statDelayLabel: sport.statDelayLabel,
    statRating: sport.statRating,
    statRatingLabel: sport.statRatingLabel,
  });
  const [showHero, setShowHero] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setHeroField(key: keyof typeof hero, value: string) {
    setHero((h) => ({ ...h, [key]: value }));
  }

  const dirty =
    label.trim() !== sport.label ||
    color !== sport.color ||
    !!pendingFile ||
    (Object.keys(hero) as (keyof typeof hero)[]).some((k) => hero[k] !== sport[k]);

  function handleFile(file: File) {
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      let logo: string | undefined;
      if (pendingFile) {
        logo = await uploadAdminImage(pendingFile, {
          folder: "le-maillot-ideal/sports",
          publicId: sport.key,
          transformation: LOGO_TRANSFORMATION,
        });
      }
      const result = await renameSportAction(sport.key, { label, color, logo, ...hero });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast("Sport mis à jour", "check-circle");
      setPendingFile(null);
      onSaved();
    } catch {
      setError("Échec de l'envoi du logo. Vérifiez votre connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!confirm(`Supprimer « ${sport.label} » ?`)) return;
    setSaving(true);
    try {
      const result = await deleteSportAction(sport.key);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      showToast("Sport supprimé", "delete");
      onDeleted();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-tcard">
      <div className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl || sport.logo || undefined}
          alt=""
          style={{
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: "var(--r-item)",
            objectFit: "contain",
            background: "#fff",
            border: "1px solid var(--outline-variant)",
            visibility: previewUrl || sport.logo ? "visible" : "hidden",
          }}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ width: 36, height: 36, padding: 0, border: "none", borderRadius: "var(--r-item)", flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <div className="adm-field" style={{ margin: 0 }}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            {sport.key}
          </p>
        </div>
        <button type="button" className="icon-btn danger" aria-label="Supprimer" disabled={saving} onClick={remove}>
          <Icon name="delete" size="sm" />
        </button>
      </div>
      <ImageDropZone
        previewSrc={undefined}
        onFile={handleFile}
        disabled={saving}
        label="Changer le logo"
        hint="Cliquez ou déposez une image ici (PNG transparent conseillé)"
      />

      <button
        type="button"
        className="btn btn-tonal btn-sm"
        style={{ marginTop: 10 }}
        onClick={() => setShowHero((v) => !v)}
      >
        <Icon name="expand" size="sm" />
        Bandeau d&apos;accueil du site {sport.label}
      </button>
      {showHero ? (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <p className="sub" style={{ margin: 0 }}>
            Ces textes s&apos;affichent sur l&apos;accueil du site {sport.label} (ex. « /{sport.key} ») — propres à ce
            sport, pas partagés avec les autres.
          </p>
          {HERO_FIELDS.map((f) =>
            f.multiline ? (
              <div className="adm-field" style={{ margin: 0 }} key={f.key}>
                <label>{f.label}</label>
                <textarea
                  value={hero[f.key as keyof typeof hero]}
                  onChange={(e) => setHeroField(f.key as keyof typeof hero, e.target.value)}
                />
              </div>
            ) : (
              <div className="adm-field" style={{ margin: 0 }} key={f.key}>
                <label>{f.label}</label>
                <input
                  value={hero[f.key as keyof typeof hero]}
                  onChange={(e) => setHeroField(f.key as keyof typeof hero, e.target.value)}
                />
              </div>
            )
          )}
          <p className="sub" style={{ margin: 0 }}>
            N&apos;affichez une note moyenne que si elle correspond à de vrais avis.
          </p>
        </div>
      ) : null}

      {error ? <p style={{ color: "var(--error)", fontSize: ".8rem", margin: "8px 0 0" }}>{error}</p> : null}
      {dirty ? (
        <button type="button" className="btn btn-tonal btn-sm" style={{ marginTop: 10 }} disabled={saving} onClick={save}>
          <Icon name="save" size="sm" />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      ) : null}
    </div>
  );
}

export function SportsManager({ sports, open, onClose }: { sports: Sport[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#22c55e");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function addSport() {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const result = await createSportAction({ label: newLabel, color: newColor });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast(`« ${newLabel} » créé`, "check-circle");
      setNewLabel("");
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Sports" titleIcon="storefront">
      <div className="adm-warn">
        <Icon name="info" />
        <div>Renommer un sport met aussi à jour tous les produits déjà classés dedans.</div>
      </div>

      <div className="adm-testi">
        {sports.map((s) => (
          <SportRow key={s.key} sport={s} onSaved={() => router.refresh()} onDeleted={() => router.refresh()} />
        ))}
      </div>

      <h3 style={{ fontSize: ".92rem", margin: "22px 0 10px" }}>Ajouter un sport</h3>
      {error ? (
        <div className="adm-warn">
          <Icon name="error" />
          <div>{error}</div>
        </div>
      ) : null}
      <div className="top" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          style={{ width: 36, height: 36, padding: 0, border: "none", borderRadius: "var(--r-item)", flexShrink: 0 }}
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Judo"
          style={{ flex: 1 }}
        />
      </div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ marginTop: 12 }}
        disabled={creating || !newLabel.trim()}
        onClick={addSport}
      >
        <Icon name="add" size="sm" />
        {creating ? "Création…" : "Créer le sport"}
      </button>
    </Drawer>
  );
}
