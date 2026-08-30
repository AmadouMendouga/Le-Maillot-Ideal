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
import { uploadAdminImage, SQUARE_TRANSFORMATION } from "@/lib/cloudinaryUpload";
import { productPatchError } from "@/lib/validation";
import type { Kit, Product } from "@/lib/types";

const SIZES = ["S", "M", "L", "XL", "2XL"];
const KITS: Kit[] = ["Domicile", "Extérieur", "Third"];

export function ProductEditDrawer({
  product,
  open,
  onClose,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}) {
  // Initialisation paresseuse depuis `product` : le parent remonte ce composant
  // (key={slug}) à chaque nouveau produit ouvert, donc ces valeurs initiales
  // sont toujours fraîches sans effet de synchronisation supplémentaire.
  const [name, setName] = useState(product?.name ?? "");
  const [team, setTeam] = useState(product?.team ?? "");
  const [kit, setKit] = useState<Kit>(product?.kit ?? KITS[0]);
  const [season, setSeason] = useState(product?.season ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [priceOriginal, setPriceOriginal] = useState(product ? String(product.priceOriginal) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [sizes, setSizes] = useState<string[]>(product?.sizes ?? []);
  const [kidsAvailable, setKidsAvailable] = useState(!!product?.kidsAvailable);
  const [isNew, setIsNew] = useState(!!product?.isNew);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const priceNum = Number(price);
  const origNum = Number(priceOriginal);
  const discountPct = origNum > priceNum && origNum > 0 ? Math.round((1 - priceNum / origNum) * 100) : 0;

  function toggleSize(s: string) {
    setSizes((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  }

  function handleFile(file: File) {
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!product || saving) return;
    const patch = {
      name: name.trim(),
      team: team.trim(),
      kit,
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
      let images: { square?: string } | undefined;
      if (pendingFile) {
        const square = await uploadAdminImage(pendingFile, {
          folder: "le-maillot-ideal/photos",
          publicId: product.slug,
          transformation: SQUARE_TRANSFORMATION,
        });
        images = { square };
      }
      const result = await updateProductAction({ slug: product.slug, ...patch, images });
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
              <label>Type de maillot</label>
              <select value={kit} onChange={(e) => setKit(e.target.value as Kit)}>
                {KITS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SIZES.map((s) => (
                <label key={s} className="adm-check" style={{ padding: 0 }}>
                  <input type="checkbox" checked={sizes.includes(s)} onChange={() => toggleSize(s)} /> {s}
                </label>
              ))}
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
