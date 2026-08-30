"use client";

// Porté depuis admin-src/src/components/gallery/GalleryTab.jsx. Différence avec
// l'original : les images sont uploadées vers Cloudinary (déjà redimensionnées
// via une transformation signée, voir lib/cloudinaryUpload.ts) puis écrites dans
// Firestore via Server Action — chaque ajout/suppression/réordonnancement est
// immédiatement en ligne, il n'y a plus d'étape d'export séparée.
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Icon } from "@/components/icons/Icon";
import { showToast } from "@/components/Toast";
import {
  addGalleryItemsAction,
  deleteGalleryItemAction,
  moveGalleryItemAction,
  replaceGalleryImageAction,
} from "@/lib/actions/gallery";
import { uploadAdminImage, SQUARE_TRANSFORMATION, WIDE_TRANSFORMATION } from "@/lib/cloudinaryUpload";
import type { GalleryItem } from "@/lib/types";

export function GalleryAdmin({ initialGallery }: { initialGallery: GalleryItem[] }) {
  const [gallery, setGallery] = useState(initialGallery);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const swapInputRef = useRef<HTMLInputElement>(null);
  const swapIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "gallery"), orderBy("order")), (snap) => {
      setGallery(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GalleryItem, "id">) })));
    });
    return unsub;
  }, []);

  function startAdd() {
    if (!addInputRef.current) return;
    addInputRef.current.value = "";
    addInputRef.current.click();
  }
  function startSwap(id: string) {
    swapIdRef.current = id;
    if (!swapInputRef.current) return;
    swapInputRef.current.value = "";
    swapInputRef.current.click();
  }

  async function move(id: string, direction: -1 | 1) {
    setBusyId(id);
    try {
      const result = await moveGalleryItemAction(id, direction);
      if (!result.ok) showToast(result.error, "error", true);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Retirer cette photo de la photothèque ?")) return;
    setBusyId(id);
    try {
      await deleteGalleryItemAction(id);
      showToast("Photo retirée", "delete");
    } finally {
      setBusyId(null);
    }
  }

  // Séquentiel plutôt que Promise.all : évite de bombarder Cloudinary et
  // garde un ordre prévisible si plusieurs fichiers sont choisis d'un coup.
  async function handleAddFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const items: { src: string; thumb: string }[] = [];
    const failed: string[] = [];
    for (const file of files) {
      try {
        const publicId = `gallery-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        const [thumb, src] = await Promise.all([
          uploadAdminImage(file, { folder: "le-maillot-ideal/photos", publicId, transformation: SQUARE_TRANSFORMATION }),
          uploadAdminImage(file, { folder: "le-maillot-ideal/gallery", publicId, transformation: WIDE_TRANSFORMATION }),
        ]);
        items.push({ src, thumb });
      } catch (error) {
        console.error("Envoi impossible pour « " + file.name + " »", error);
        failed.push(file.name || "fichier sans nom");
      }
    }
    if (items.length) {
      await addGalleryItemsAction(items);
      showToast(`${items.length} photo${items.length > 1 ? "s" : ""} ajoutée${items.length > 1 ? "s" : ""}`, "check-circle");
    }
    if (failed.length) {
      alert(`${failed.length} image(s) n'ont pas pu être envoyées :\n• ${failed.join("\n• ")}`);
    }
    setUploading(false);
  }

  async function handleSwapFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = swapIdRef.current;
    if (!file || !id) return;
    setBusyId(id);
    try {
      const publicId = `gallery-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      const [thumb, src] = await Promise.all([
        uploadAdminImage(file, { folder: "le-maillot-ideal/photos", publicId, transformation: SQUARE_TRANSFORMATION }),
        uploadAdminImage(file, { folder: "le-maillot-ideal/gallery", publicId, transformation: WIDE_TRANSFORMATION }),
      ]);
      await replaceGalleryImageAction(id, src, thumb);
      showToast("Photo remplacée", "check-circle");
    } catch {
      alert("Impossible de remplacer cette photo. Vérifiez le fichier et réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="adm-info">
        <Icon name="info" />
        <div>
          Les photos sont redimensionnées automatiquement : <strong>600×600</strong> pour la vignette et{" "}
          <strong>1400 px</strong> pour l&apos;affichage en grand. Inutile de les préparer avant, déposez vos photos telles
          quelles.
        </div>
      </div>
      <div className="adm-gallery">
        {gallery.map((g, i) => (
          <div className="adm-gcard" key={g.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.thumb} alt="" />
            <div className="bar">
              <span className="num">#{i + 1}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label="Monter"
                disabled={i === 0 || busyId === g.id}
                onClick={() => move(g.id, -1)}
              >
                <Icon name="arrow-back" size="sm" />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Descendre"
                disabled={i === gallery.length - 1 || busyId === g.id}
                onClick={() => move(g.id, 1)}
              >
                <Icon name="arrow-forward" size="sm" />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Remplacer"
                disabled={busyId === g.id}
                onClick={() => startSwap(g.id)}
              >
                <Icon name="image" size="sm" />
              </button>
              <button
                type="button"
                className="icon-btn danger"
                aria-label="Supprimer"
                disabled={busyId === g.id}
                onClick={() => remove(g.id)}
              >
                <Icon name="delete" size="sm" />
              </button>
            </div>
          </div>
        ))}
        <div
          className="adm-gadd"
          role="button"
          tabIndex={0}
          onClick={uploading ? undefined : startAdd}
          onKeyDown={(e) => {
            if (uploading) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              startAdd();
            }
          }}
        >
          <Icon name="add" />
          <span>{uploading ? "Envoi en cours…" : "Ajouter des photos"}</span>
        </div>
      </div>
      <input ref={addInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleAddFiles} />
      <input ref={swapInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleSwapFile} />
    </section>
  );
}
