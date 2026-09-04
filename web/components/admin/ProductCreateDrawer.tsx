"use client";

// Ajout d'un nouveau produit — même patron que ProductEditDrawer.tsx, mais la
// photo et le sport sont obligatoires dès la création (pas de produit public
// sans photo ni sport assigné). Le championnat reste optionnel (seuls les
// sports avec de vraies compétitions, football aujourd'hui, en ont besoin).
import { useState } from "react";
import { Drawer } from "@/components/admin/Drawer";
import { ImageDropZone } from "@/components/admin/ImageDropZone";
import { Icon } from "@/components/icons/Icon";
import { showToast } from "@/components/Toast";
import { createProductAction } from "@/lib/actions/products";
import { uploadAdminImage, uploadAdminVideo, SQUARE_TRANSFORMATION } from "@/lib/cloudinaryUpload";
import { productPatchError } from "@/lib/validation";
import type { Kit, League, Sport } from "@/lib/types";

const SIZES = ["S", "M", "L", "XL", "2XL"];
const KITS: Kit[] = ["Domicile", "Extérieur", "Third"];
const FOOTBALL_SPORT_KEY = "football";

export function ProductCreateDrawer({
  leagues,
  sports,
  open,
  onClose,
  onCreated,
}: {
  leagues: League[];
  sports: Sport[];
  open: boolean;
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [sport, setSport] = useState(sports[0]?.key ?? "");
  const [kit, setKit] = useState<string>(sports[0]?.key === FOOTBALL_SPORT_KEY ? KITS[0] : "");
  const [league, setLeague] = useState("");
  const [season, setSeason] = useState("2026/2027");
  const [price, setPrice] = useState("");
  const [priceOriginal, setPriceOriginal] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [sizes, setSizes] = useState<string[]>(["S", "M", "L", "XL"]);
  const [newSize, setNewSize] = useState("");
  const [kidsAvailable, setKidsAvailable] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [pendingReel, setPendingReel] = useState<{ file: File; previewUrl: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const priceNum = Number(price);
  const origNum = Number(priceOriginal);
  const discountPct = origNum > priceNum && origNum > 0 ? Math.round((1 - priceNum / origNum) * 100) : 0;

  const availableLeagues = leagues.filter((l) => l.sport === sport);

  function handleSportChange(nextSport: string) {
    setSport(nextSport);
    setLeague("");
    setKit(nextSport === FOOTBALL_SPORT_KEY ? KITS[0] : "");
  }

  function toggleSize(s: string) {
    setSizes((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  }
  function addFreeSize() {
    const value = newSize.trim();
    if (!value || sizes.includes(value)) return;
    setSizes((list) => [...list, value]);
    setNewSize("");
  }
  function removeSize(s: string) {
    setSizes((list) => list.filter((x) => x !== s));
  }

  function handleFile(file: File) {
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }
  function handleReelFile(file: File) {
    setPendingReel({ file, previewUrl: URL.createObjectURL(file) });
  }

  async function handleSave() {
    if (saving || !sport) return;
    const patch = {
      name: name.trim(),
      team: team.trim(),
      kit: kit.trim() || undefined,
      price: Number(price),
      priceOriginal: Number(priceOriginal),
      stock: Number(stock),
      season: season.trim(),
      description: description.trim(),
      sizes,
      kidsAvailable,
      isNew,
    };
    const validationError = productPatchError(patch);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!pendingFile) {
      setError("Ajoutez une photo du produit avant d'enregistrer.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const square = await uploadAdminImage(pendingFile, {
        folder: "le-maillot-ideal/photos",
        transformation: SQUARE_TRANSFORMATION,
      });
      let reelUrl: string | undefined;
      if (pendingReel) {
        reelUrl = await uploadAdminVideo(pendingReel.file, { folder: "le-maillot-ideal/products/reel" });
      }
      const result = await createProductAction({ ...patch, sport, league: league || undefined, images: { square }, reelUrl });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast(`« ${patch.name} » ajouté au catalogue`, "check-circle");
      onCreated(result.slug);
      onClose();
    } catch {
      setError("Échec de l'enregistrement. Vérifiez votre connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving}>
      <Icon name="add" size="sm" />
      {saving ? "Enregistrement…" : "Ajouter au catalogue"}
    </button>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Nouveau produit" titleIcon="add" footer={footer}>
      <ImageDropZone
        previewSrc={previewUrl}
        onFile={handleFile}
        disabled={saving}
        label="Photo du produit"
        hint="Cliquez ou déposez une image ici — obligatoire"
      />

      <div className="adm-field" style={{ marginTop: 14 }}>
        <label>Vidéo de présentation (reel, optionnel)</label>
        {pendingReel ? (
          <video src={pendingReel.previewUrl} controls style={{ width: 120, borderRadius: "var(--r-item)", marginBottom: 10 }} />
        ) : null}
        <ImageDropZone
          kind="video"
          onFile={handleReelFile}
          disabled={saving}
          label="Ajouter une vidéo"
          hint="Cliquez ou déposez une courte vidéo (mp4) — pas de lecture automatique côté client"
        />
      </div>

      {error ? (
        <div className="adm-warn" style={{ marginTop: 14 }}>
          <Icon name="error" />
          <div>{error}</div>
        </div>
      ) : null}

      <div className="adm-field" style={{ marginTop: 18 }}>
        <label>Nom affiché</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maillot Domicile Nantes" />
      </div>

      <div className="adm-grid2">
        <div className="adm-field">
          <label>Équipe</label>
          <input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Nantes" />
        </div>
        <div className="adm-field">
          <label>Sport</label>
          {sports.length === 0 ? (
            <p className="hint" style={{ margin: 0, fontSize: ".8rem", color: "var(--error)" }}>
              Créez d&apos;abord un sport (bouton « Gérer les sports »).
            </p>
          ) : (
            <select value={sport} onChange={(e) => handleSportChange(e.target.value)}>
              {sports.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="adm-grid2">
        <div className="adm-field">
          <label>{sport === FOOTBALL_SPORT_KEY ? "Type de maillot" : "Variante (optionnel)"}</label>
          {sport === FOOTBALL_SPORT_KEY ? (
            <select value={kit} onChange={(e) => setKit(e.target.value)}>
              {KITS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          ) : (
            <input value={kit} onChange={(e) => setKit(e.target.value)} placeholder="Ex. Bleu, Taille unique…" />
          )}
        </div>
        {availableLeagues.length > 0 ? (
          <div className="adm-field">
            <label>Championnat (optionnel)</label>
            <select value={league} onChange={(e) => setLeague(e.target.value)}>
              <option value="">Aucun</option>
              {availableLeagues.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="adm-grid3">
        <div className="adm-field">
          <label>Prix de vente</label>
          <input type="number" min="1" step="100" required value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="adm-field">
          <label>Prix barré</label>
          <input
            type="number"
            min="1"
            step="100"
            required
            value={priceOriginal}
            onChange={(e) => setPriceOriginal(e.target.value)}
          />
        </div>
        <div className="adm-field">
          <label>Stock</label>
          <input type="number" min="0" step="1" required value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
      </div>
      <p className="hint" style={{ margin: "-6px 0 14px", fontSize: ".78rem", color: "var(--on-surface-variant)" }}>
        {discountPct > 0
          ? "Remise calculée : -" + discountPct + "%"
          : "Aucune remise affichée (le prix barré doit être supérieur au prix de vente)."}
      </p>

      <div className="adm-field">
        <label>Saison</label>
        <input value={season} onChange={(e) => setSeason(e.target.value)} />
      </div>
      <div className="adm-field">
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="adm-field">
        <label>Tailles disponibles</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {SIZES.map((s) => (
            <label key={s} className="adm-check" style={{ padding: 0 }}>
              <input type="checkbox" checked={sizes.includes(s)} onChange={() => toggleSize(s)} /> {s}
            </label>
          ))}
        </div>
        {sizes.filter((s) => !SIZES.includes(s)).length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {sizes
              .filter((s) => !SIZES.includes(s))
              .map((s) => (
                <span key={s} className="adm-chip">
                  {s}
                  <button type="button" aria-label={`Retirer ${s}`} onClick={() => removeSize(s)}>
                    <Icon name="close" size="sm" />
                  </button>
                </span>
              ))}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newSize}
            onChange={(e) => setNewSize(e.target.value)}
            placeholder="Autre taille (ex. pointure 42)"
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFreeSize();
              }
            }}
          />
          <button type="button" className="btn btn-tonal btn-sm" onClick={addFreeSize} disabled={!newSize.trim()}>
            Ajouter
          </button>
        </div>
      </div>

      <label className="adm-check">
        <input type="checkbox" checked={kidsAvailable} onChange={(e) => setKidsAvailable(e.target.checked)} /> Tailles
        enfant disponibles
      </label>
      <label className="adm-check">
        <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} /> Afficher le badge «
        Nouveau »
      </label>
    </Drawer>
  );
}
