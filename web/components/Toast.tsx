"use client";

// Toast flottant — porté depuis js/main.js#showToast. Un seul élément
// réutilisé, ré-affiché à chaque appel. showToast() est un simple export
// appelable depuis n'importe quel gestionnaire d'événement (pas de contexte
// React à faire passer partout), écouté par <ToastHost/> monté une fois dans
// le layout racine.
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/names";

interface ToastDetail {
  text: string;
  icon: IconName;
  isError: boolean;
}

const EVENT = "lmi:toast";

export function showToast(text: string, icon: IconName = "check-circle", isError = false) {
  window.dispatchEvent(new CustomEvent<ToastDetail>(EVENT, { detail: { text, icon, isError } }));
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastDetail | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;
    function handle(e: Event) {
      setToast((e as CustomEvent<ToastDetail>).detail);
      setVisible(false);
      requestAnimationFrame(() => setVisible(true));
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setVisible(false), 2800);
    }
    window.addEventListener(EVENT, handle);
    return () => {
      window.removeEventListener(EVENT, handle);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      id="toast"
      className={"toast" + (toast.isError ? " error" : "") + (visible ? " show" : "")}
      role={toast.isError ? "alert" : "status"}
      aria-live={toast.isError ? "assertive" : "polite"}
    >
      <Icon name={toast.icon} />
      <span>{toast.text}</span>
    </div>
  );
}
