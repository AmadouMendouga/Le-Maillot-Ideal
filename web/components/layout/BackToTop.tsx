"use client";

// Bouton "retour en haut" — patron restrowebsite (data-back-top-btn) : même
// seuil de défilement (50px) que les en-têtes qui se solidifient au scroll.
// Réutilise l'icône "expand" (chevron bas de l'accordéon FAQ) tournée à
// 180°, plutôt que d'ajouter un symbole dédié au sprite pour un simple
// chevron. Empilé au-dessus du bouton WhatsApp flottant (même coin, jamais
// en même temps au même endroit — voir .back-top-btn).
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons/Icon";

const SCROLL_THRESHOLD = 50;

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY >= SCROLL_THRESHOLD);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <a
      href="#top"
      className={"back-top-btn" + (visible ? " active" : "")}
      aria-label="Retour en haut de la page"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <Icon name="expand" size="md" className="back-top-btn-icon" />
    </a>
  );
}
