"use client";

// Porté depuis admin-src/src/components/products/ProductEditDrawer.jsx. Différence
// avec l'original : il n'y a plus de brouillon local à publier plus tard — chaque
// clic sur « Enregistrer » écrit directement dans Firestore (Server Action) et
// devient visible immédiatement sur le site public après revalidation. La photo
// choisie n'est donc uploadée vers Cloudinary qu'au moment d'Enregistrer, pas dès
// la sélection du fichier (sinon une image orpheline non voulue serait publiée).
import { useState } from "react";
import { Drawer } from "@/components/admin/Drawer";
import { ImageDropZone } from "@/components/admin/ImageDropZone";
import { Icon } from "@/components/icons/Icon";
import { showToast } from "@/components/Toast";
import { updateProductAction } from "@/lib/actions/products";
import { uploadAdminImage, uploadAdminVideo, SQUARE_TRANSFORMATION } from "@/lib/cloudinaryUpload";
import { productPatchError } from "@/lib/validation";
import type { Kit, League, Product, Sport } from "@/lib/types";

const SIZES = ["S", "M", "L", "XL", "2XL"];
const KITS: Kit[] = ["Domicile", "Extérieur", "Third"];
const FOOTBALL_SPORT_KEY = "football";

export function ProductEditDrawer({
  product,
  leagues,
  sports,
  open,
  onClose,
}: {
  product: Product | null;
  leagues: League[];
  sports: Sport[];
  open: boolean;
  onClose: () => void;
}) {
  // Initialisation paresseuse depuis `product` : le parent remonte ce composant
  // (key={slug}) à chaque nouveau produit ouvert, donc ces valeurs initiales
  // sont toujours fraîches sans effet de synchronisation supplémentaire.
  const [name, setName] = useState(product?.name ?? "");
  const [team, setTeam] = useState(product?.team ?? "");
  const [sport, setSport] = useState(product?.sport ?? sports[0]?.key ?? "");
  const [kit, setKit] = useState(product?.kit ?? "");
  const [league, setLeague] = useState(product?.league ?? "");
  const [season, setSeason] = useState(product?.season ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [priceOriginal, setPriceOriginal] = useState(product ? String(product.priceOriginal) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [sizes, setSizes] = useState<string[]>(product?.sizes ?? []);
  const [newSize, setNewSize] = useState("");
  const [kidsAvailable, setKidsAvailable] = useState(!!product?.kidsAvailable);
  const [isNew, setIsNew] = useState(!!product?.isNew);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [gallery, setGallery] = useState<string[]>(product?.images.gallery ?? []);
  const [pendingGallery, setPendingGallery] = useState<{ file: File; previewUrl: string }[]>([]);
  const [reelUrl, setReelUrl] = useState(product?.reelUrl ?? "");
  const [pendingReel, setPendingReel] = useState<{ file: File; previewUrl: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const priceNum = Number(price);
  const origNum = Number(priceOriginal);
  const discountPct = origNum > priceNum && origNum > 0 ? Math.round((1 - priceNum / origNum) * 100) : 0;

  const availableLeagues = leagues.filter((l) => l.sport === sport);

  function handleSportChange(nextSport: string) {
    setSport(nextSport);
    // La league choisie peut ne plus appartenir au nouveau sport — on la
    // réinitialise plutôt que de garder une valeur incohérente en mémoire.
    if (!leagues.some((l) => l.key === league && l.sport === nextSport)) setLeague("");
    if (nextSport !== FOOTBALL_SPORT_KEY) setKit((k) => (KITS.includes(k as Kit) ? "" : k));
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

  function handleGalleryFile(file: File) {
    setPendingGallery((list) => [...list, { file, previewUrl: URL.createObjectURL(file) }]);
  }
  function removeExistingGalleryPhoto(url: string) {
    setGallery((list) => list.filter((u) => u !== url));
  }
  function removePendingGalleryPhoto(previewUrl: string) {
    setPendingGallery((list) => list.filter((p) => p.previewUrl !== previewUrl));
  }

  function handleReelFile(file: File) {
    setPendingReel({ file, previewUrl: URL.createObjectURL(file) });
  }
  function removeReel() {
    setReelUrl("");
    setPendingReel(null);
  }

  async function handleSave() {
    if (!product || saving) return;
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

    setSaving(true);
    setError("");
    try {
      let images: { square?: string; gallery?: string[] } | undefined;
      const galleryChanged = pendingGallery.length > 0 || gallery.length !== (product.images.gallery ?? []).length;
      if (pendingFile || galleryChanged) {
        const square = pendingFile
          ? await uploadAdminImage(pendingFile, {
              folder: "le-maillot-ideal/photos",
              publicId: product.slug,
              transformation: SQUARE_TRANSFORMATION,
            })
          : undefined;
        const uploadedGallery = await Promise.all(
          pendingGallery.map((p) =>
            uploadAdminImage(p.file, {
              folder: `le-maillot-ideal/photos/${product.slug}/gallery`,
              transformation: SQUARE_TRANSFORMATION,
            })
          )
        );
        images = { square, gallery: galleryChanged ? [...gallery, ...uploadedGallery] : undefined };
      }
      let nextReelUrl: string | undefined;
      if (pendingReel) {
        nextReelUrl = await uploadAdminVideo(pendingReel.file, {
          folder: `le-maillot-ideal/products/${product.slug}/reel`,
        });
      } else if (reelUrl !== (product.reelUrl ?? "")) {
        nextReelUrl = reelUrl; // retiré par l'admin (removeReel) → ""
      }
      const result = await updateProductAction({
        slug: product.slug,
        ...patch,
        sport,
        league,
        images,
        reelUrl: nextReelUrl,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast(`« ${patch.name} » enregistré`, "check-circle");
      onClose();
    } catch {
      setError("Échec de l'enregistrement. Vérifiez votre connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  }

  const footer = product ? (
    <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving}>
      <Icon name="check-circle" size="sm" />
      {saving ? "Enregistrement…" : "Enregistrer"}
    </button>
  ) : null;

  return (
    <Drawer open={open} onClose={onClose} title={product?.name || ""} titleIcon="edit" footer={footer}>
      {product ? (
        <>
          <ImageDropZone previewSrc={previewUrl || product.images.square} onFile={handleFile} disabled={saving} />

          <div className="adm-field" style={{ marginTop: 14 }}>
            <label>Photos supplémentaires</label>
            {gallery.length > 0 || pendingGallery.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {gallery.map((url) => (
                  <div key={url} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      style={{ width: 64, height: 64, borderRadius: "var(--r-item)", objectFit: "cover" }}
                    />
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label="Retirer cette photo"
                      disabled={saving}
                      onClick={() => removeExistingGalleryPhoto(url)}
                      style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24 }}
                    >
                      <Icon name="close" size="sm" />
                    </button>
                  </div>
                ))}
                {pendingGallery.map((p) => (
                  <div key={p.previewUrl} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.previewUrl}
                      alt=""
                      style={{ width: 64, height: 64, borderRadius: "var(--r-item)", objectFit: "cover" }}
                    />
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label="Retirer cette photo"
                      disabled={saving}
                      onClick={() => removePendingGalleryPhoto(p.previewUrl)}
                      style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24 }}
                    >
                      <Icon name="close" size="sm" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <ImageDropZone
              onFile={handleGalleryFile}
              disabled={saving}
              label="Ajouter une photo"
              hint="Cliquez ou déposez une image ici — le client pourra les voir toutes sur la fiche produit"
            />
          </div>

          <div className="adm-field" style={{ marginTop: 14 }}>
            <label>Vidéo de présentation (reel, optionnel)</label>
            {pendingReel || reelUrl ? (
              <div style={{ position: "relative", width: 120, marginBottom: 10 }}>
                <video src={pendingReel?.previewUrl || reelUrl} controls style={{ width: 120, borderRadius: "var(--r-item)" }} />
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label="Retirer la vidéo"
                  disabled={saving}
                  onClick={removeReel}
                  style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24 }}
                >
                  <Icon name="close" size="sm" />
                </button>
              </div>
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
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="adm-grid2">
            <div className="adm-field">
              <label>Équipe</label>
              <input value={team} onChange={(e) => setTeam(e.target.value)} />
            </div>
            <div className="adm-field">
              <label>Sport</label>
              <select value={sport} onChange={(e) => handleSportChange(e.target.value)}>
                {sports.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
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
        </>
      ) : null}
    </Drawer>
  );
}
