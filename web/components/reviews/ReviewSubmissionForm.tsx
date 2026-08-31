"use client";

// Formulaire public de dépôt d'avis — addendum suivi de commandes. Gardé par
// reviewToken (voir lib/actions/orders.ts), pas par une session : n'importe
// qui avec le lien peut soumettre UNE fois, mais rien n'est publié directement
// (CLAUDE.md §2) — la soumission part dans testimonialSubmissions, en attente
// de validation par l'admin (onglet Avis).
import { useRef, useState } from "react";
import { Icon } from "@/components/icons/Icon";
import { StatefulButton } from "@/components/StatefulButton";
import { submitTestimonialAction } from "@/lib/actions/orders";
import { uploadReviewImage } from "@/lib/cloudinaryUpload";

export function ReviewSubmissionForm({ token, customerName }: { token: string; customerName: string }) {
  const nameRef = useRef<HTMLInputElement>(null);
  const designationRef = useRef<HTMLInputElement>(null);
  const quoteRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function pickPhoto() {
    fileInputRef.current?.click();
  }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  function validate(): boolean {
    const name = nameRef.current;
    const quote = quoteRef.current;
    const form = formRef.current;
    if (!form || !name || !quote) return false;

    name.setCustomValidity(name.value.trim().length >= 2 ? "" : "Saisissez un nom d'au moins 2 caractères.");
    quote.setCustomValidity(quote.value.trim().length >= 10 ? "" : "Dites-en un peu plus (10 caractères minimum).");

    const valid = form.checkValidity();
    if (!valid) form.reportValidity();
    return valid;
  }

  async function runSubmit() {
    setError("");
    const name = nameRef.current?.value.trim() || "";
    const designation = designationRef.current?.value.trim() || "";
    const quote = quoteRef.current?.value.trim() || "";

    let photoUrl = "";
    if (file) {
      photoUrl = await uploadReviewImage(file, token);
    }

    const result = await submitTestimonialAction(token, { name, designation, quote, photoUrl });
    if (!result.ok) {
      setError(result.error);
      throw new Error(result.error);
    }

    // Laisse le temps à l'animation de succès du bouton de jouer (voir
    // StatefulButton : ~200ms de battement + 2000ms de coche) avant de
    // remplacer le formulaire par le message de remerciement.
    setTimeout(() => setSubmitted(true), 2200);
  }

  if (submitted) {
    return (
      <div className="contact-card review-thanks">
        <Icon name="check-circle" size="xl" />
        <h3>Merci pour votre avis !</h3>
        <p>Il sera publié sur le site après vérification par notre équipe.</p>
      </div>
    );
  }

  return (
    <div className="contact-card">
      <h3>Comment s&apos;est passée votre commande ?</h3>
      <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
        {error ? (
          <p className="form-note" style={{ color: "var(--error)" }}>
            {error}
          </p>
        ) : null}

        <div className="form-row">
          <label htmlFor="rvName">Votre nom</label>
          <input ref={nameRef} id="rvName" type="text" required minLength={2} defaultValue={customerName} />
        </div>
        <div className="form-row">
          <label htmlFor="rvCity">Ville · maillot acheté (optionnel)</label>
          <input ref={designationRef} id="rvCity" type="text" placeholder="Douala · Maillot PSG domicile" />
        </div>
        <div className="form-row">
          <label htmlFor="rvQuote">Votre avis</label>
          <textarea
            ref={quoteRef}
            id="rvQuote"
            required
            minLength={10}
            placeholder="Le maillot est arrivé rapidement, qualité au rendez-vous..."
          />
        </div>
        <div className="form-row">
          <label>Une photo (optionnel)</label>
          <button type="button" className="review-photo-picker" onClick={pickPhoto}>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" />
            ) : (
              <span className="ic">
                <Icon name="image" size="sm" />
              </span>
            )}
            <span>{file ? file.name : "Ajouter une photo de vous avec le maillot"}</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
        </div>

        <StatefulButton className="btn btn-primary btn-lg btn-block" onValidate={validate} onRun={runSubmit}>
          <Icon name="star" size="sm" />
          Envoyer mon avis
        </StatefulButton>
        <p className="form-note">Votre avis est vérifié par notre équipe avant publication.</p>
      </form>
    </div>
  );
}
