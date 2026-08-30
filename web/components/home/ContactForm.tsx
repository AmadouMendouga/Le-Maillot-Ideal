"use client";

// Formulaire de contact — porté depuis js/main.js (initConfiguredContactLink +
// window.lmiContactValid). Le lien WhatsApp se met à jour à chaque frappe ;
// la validation réutilise l'API native du navigateur (setCustomValidity /
// reportValidity) plutôt qu'une UI de validation maison, comme l'original.
import { useRef, useState } from "react";
import { Icon } from "@/components/icons/Icon";
import { StatefulButton } from "@/components/StatefulButton";
import { whatsappNumber } from "@/lib/cart";
import type { SiteSettings } from "@/lib/types";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function ContactForm({ settings }: { settings: SiteSettings }) {
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [waHref, setWaHref] = useState("https://wa.me/" + whatsappNumber(settings));

  function updateLink() {
    const name = nameRef.current?.value || "";
    const phone = phoneRef.current?.value || "";
    const message = msgRef.current?.value || "";
    const text = `Bonjour ${settings.businessName}, je m'appelle ${name} (${phone}). ${message}`;
    setWaHref(`https://wa.me/${whatsappNumber(settings)}?text=${encodeURIComponent(text)}`);
  }

  function validate(): boolean {
    const name = nameRef.current;
    const phone = phoneRef.current;
    const message = msgRef.current;
    const form = formRef.current;
    if (!form || !name || !phone || !message) return false;

    name.setCustomValidity(name.value.trim().length >= 2 ? "" : "Saisissez un nom d'au moins 2 caractères.");
    const digits = phone.value.replace(/\D/g, "");
    phone.setCustomValidity(digits.length >= 8 && digits.length <= 15 ? "" : "Saisissez un numéro contenant 8 à 15 chiffres.");
    message.setCustomValidity(message.value.trim().length >= 5 ? "" : "Saisissez un message d'au moins 5 caractères.");

    const valid = form.checkValidity();
    if (!valid) form.reportValidity();
    return valid;
  }

  return (
    <form id="contactForm" ref={formRef} onSubmit={(e) => e.preventDefault()} onInput={updateLink}>
      <div className="form-row">
        <label htmlFor="cName">Nom complet</label>
        <input ref={nameRef} id="cName" type="text" required minLength={2} autoComplete="name" />
      </div>
      <div className="form-row">
        <label htmlFor="cPhone">Téléphone</label>
        <input
          ref={phoneRef}
          id="cPhone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel"
          pattern="[+0-9 ()-]{8,20}"
        />
      </div>
      <div className="form-row">
        <label htmlFor="cMsg">Message</label>
        <textarea ref={msgRef} id="cMsg" required minLength={5} placeholder="Bonjour, je cherche un maillot..." />
      </div>
      <StatefulButton
        className="btn btn-whatsapp btn-lg btn-block"
        href={waHref}
        target="_blank"
        rel="noopener"
        onValidate={validate}
        onRun={() => wait(800)}
      >
        <Icon name="chat" />
        Envoyer sur WhatsApp
      </StatefulButton>
      <p className="form-note">
        Ce formulaire ouvre WhatsApp avec votre message pré-rempli — aucune donnée n&apos;est stockée sur ce site.
      </p>
    </form>
  );
}
