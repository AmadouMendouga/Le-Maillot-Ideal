"use client";

// Porté depuis admin-src/src/components/testimonials/TestimonialsTab.jsx. Chaque
// champ s'enregistre directement dans Firestore (débounce léger sur le texte pour
// éviter une écriture par frappe) — plus de brouillon local à publier plus tard.
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Icon } from "@/components/icons/Icon";
import { showToast } from "@/components/Toast";
import {
  addTestimonialAction,
  deleteTestimonialAction,
  setTestimonialImageAction,
  updateTestimonialAction,
} from "@/lib/actions/testimonials";
import { uploadAdminImage, SQUARE_TRANSFORMATION } from "@/lib/cloudinaryUpload";
import type { Testimonial } from "@/lib/types";

function TestimonialCard({
  testimonial,
  onImagePick,
  onDelete,
  busy,
}: {
  testimonial: Testimonial;
  onImagePick: (id: string) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  // Initialisation paresseuse depuis `testimonial` : chaque avis a un id stable
  // qui sert de key côté parent, donc ce composant ne se remonte (et ne relit
  // ces valeurs) que pour un avis réellement différent — pas besoin d'effet de
  // synchronisation pour refléter les mises à jour distantes du même avis.
  const [name, setName] = useState(testimonial.name);
  const [designation, setDesignation] = useState(testimonial.designation);
  const [quote, setQuote] = useState(testimonial.quote);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(next: { name: string; designation: string; quote: string }) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void updateTestimonialAction(testimonial.id, next);
    }, 600);
  }

  return (
    <div className="adm-tcard">
      <div className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={testimonial.photoUrl || undefined} alt="" title="Changer le portrait" onClick={() => onImagePick(testimonial.id)} />
        <div style={{ flex: 1 }}>
          <div className="adm-field" style={{ margin: "0 0 6px" }}>
            <input
              value={name}
              placeholder="Nom du client"
              onChange={(e) => {
                setName(e.target.value);
                scheduleSave({ name: e.target.value, designation, quote });
              }}
            />
          </div>
          <div className="adm-field" style={{ margin: 0 }}>
            <input
              value={designation}
              placeholder="Ville · Maillot acheté"
              onChange={(e) => {
                setDesignation(e.target.value);
                scheduleSave({ name, designation: e.target.value, quote });
              }}
            />
          </div>
        </div>
        <button type="button" className="icon-btn danger" aria-label="Supprimer" disabled={busy} onClick={() => onDelete(testimonial.id)}>
          <Icon name="delete" size="sm" />
        </button>
      </div>
      <div className="adm-field" style={{ margin: 0 }}>
        <textarea
          value={quote}
          placeholder="Ce que dit le client…"
          onChange={(e) => {
            setQuote(e.target.value);
            scheduleSave({ name, designation, quote: e.target.value });
          }}
        />
      </div>
    </div>
  );
}

export function TestimonialsAdmin({ initialTestimonials }: { initialTestimonials: Testimonial[] }) {
  const [testimonials, setTestimonials] = useState(initialTestimonials);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "testimonials"), orderBy("order")), (snap) => {
      setTestimonials(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Testimonial, "id">) })));
    });
    return unsub;
  }, []);

  async function addTestimonial() {
    await addTestimonialAction();
  }
  async function removeTestimonial(id: string) {
    if (!confirm("Supprimer cet avis ?")) return;
    setBusyId(id);
    try {
      await deleteTestimonialAction(id);
      showToast("Avis supprimé", "delete");
    } finally {
      setBusyId(null);
    }
  }
  function startImagePick(id: string) {
    pendingIdRef.current = id;
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  }
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = pendingIdRef.current;
    if (!file || !id) return;
    setBusyId(id);
    try {
      const photoUrl = await uploadAdminImage(file, {
        folder: "le-maillot-ideal/testimonials",
        publicId: id,
        transformation: SQUARE_TRANSFORMATION,
      });
      await setTestimonialImageAction(id, photoUrl);
      showToast("Portrait mis à jour", "check-circle");
    } catch {
      alert("Impossible d'envoyer cette photo. Vérifiez le fichier et réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="adm-warn">
        <Icon name="error" />
        <div>
          <strong>Ne publiez jamais un avis inventé sous la photo d&apos;une vraie personne.</strong> La liste publique est
          vide par défaut. Ajoutez uniquement des retours authentiques et demandez l&apos;accord écrit du client avant
          d&apos;utiliser son nom ou son visage.
        </div>
      </div>
      <div className="adm-toolbar">
        <button type="button" className="btn btn-tonal btn-sm" onClick={addTestimonial}>
          <Icon name="add" size="sm" />
          Ajouter un avis
        </button>
      </div>
      {testimonials.length === 0 ? (
        <div className="adm-empty">
          <Icon name="star" />
          <div>Aucun avis publié. Ajoutez uniquement un retour client réel et autorisé.</div>
        </div>
      ) : (
        <div className="adm-testi">
          {testimonials.map((t) => (
            <TestimonialCard key={t.id} testimonial={t} onImagePick={startImagePick} onDelete={removeTestimonial} busy={busyId === t.id} />
          ))}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
    </section>
  );
}
