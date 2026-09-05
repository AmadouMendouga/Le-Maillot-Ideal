"use client";

// Inscription livreur — gardée par aucune session : le jeton personnel généré
// à l'inscription EST l'accès (même principe que reviewToken/locationToken,
// voir lib/actions/orders.ts). Pas de mot de passe à retenir, juste un lien à
// garder — d'où l'insistance de l'écran de succès à le sauvegarder tout de
// suite (bouton copier + astuce "se l'envoyer sur WhatsApp").
import { useRef, useState } from "react";
import { Icon } from "@/components/icons/Icon";
import { StatefulButton } from "@/components/StatefulButton";
import { registerCourierAction } from "@/lib/actions/couriers";
import { showToast } from "@/components/Toast";

export function CourierRegisterForm({ siteUrl }: { siteUrl: string }) {
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [error, setError] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [phone, setPhone] = useState("");

  function validate(): boolean {
    const form = formRef.current;
    const phoneInput = phoneRef.current;
    if (!form || !phoneInput) return false;
    const digits = phoneInput.value.replace(/\D/g, "");
    phoneInput.setCustomValidity(digits.length >= 8 && digits.length <= 15 ? "" : "8 à 15 chiffres, avec l'indicatif pays.");
    const valid = form.checkValidity();
    if (!valid) form.reportValidity();
    return valid;
  }

  async function runSubmit() {
    setError("");
    const name = nameRef.current?.value.trim() || "";
    const rawPhone = phoneRef.current?.value.trim() || "";
    const result = await registerCourierAction({ name, phone: rawPhone });
    if (!result.ok) {
      setError(result.error);
      throw new Error(result.error);
    }
    setPhone(rawPhone.replace(/\D/g, ""));
    setLink(`${siteUrl.replace(/\/$/, "")}/livreur/${result.token}`);
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Lien copié", "check-circle");
    } catch {
      showToast("Impossible de copier — sélectionnez le lien manuellement.", "error", true);
    }
  }

  if (link) {
    const waMessage = encodeURIComponent(`Mon lien livreur ${siteUrl.replace(/^https?:\/\//, "")} : ${link}`);
    return (
      <div className="contact-card">
        <h3>C&apos;est fait !</h3>
        <p>
          Voici votre lien personnel. Gardez-le précieusement : c&apos;est lui qui vous donnera accès à vos livraisons
          assignées, à chaque fois.
        </p>
        <div className="form-row">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-tonal" style={{ flex: 1 }} onClick={copyLink}>
            <Icon name="save" size="sm" />
            Copier le lien
          </button>
          <a className="btn btn-whatsapp" style={{ flex: 1 }} href={`https://wa.me/${phone}?text=${waMessage}`} target="_blank" rel="noopener">
            <Icon name="whatsapp" size="sm" />
            Me l&apos;envoyer sur WhatsApp
          </a>
        </div>
        <p className="form-note" style={{ marginTop: 14 }}>
          Dès qu&apos;une livraison vous sera assignée, elle apparaîtra automatiquement sur ce lien.
        </p>
      </div>
    );
  }

  return (
    <div className="contact-card">
      <h3>Vos informations</h3>
      <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
        {error ? (
          <p className="form-note" style={{ color: "var(--error)" }}>
            {error}
          </p>
        ) : null}
        <div className="form-row">
          <label htmlFor="crName">Votre nom</label>
          <input ref={nameRef} id="crName" type="text" required minLength={2} />
        </div>
        <div className="form-row">
          <label htmlFor="crPhone">Numéro WhatsApp</label>
          <input ref={phoneRef} id="crPhone" type="tel" inputMode="tel" required placeholder="237655634265" />
        </div>
        <StatefulButton className="btn btn-primary btn-lg btn-block" onValidate={validate} onRun={runSubmit}>
          <Icon name="check-circle" size="sm" />
          M&apos;enregistrer comme livreur
        </StatefulButton>
      </form>
    </div>
  );
}
