// Cartes vedette du portail — grandes photos avec zoom au survol, patron
// emprunté à la section "Service" de Site reussi/restrowebsite (image qui
// grossit légèrement, voile dégradé pour la lisibilité du titre). Défile en
// continu (patron déjà en place pour SportMarquee/LeagueMarquee) plutôt
// qu'une grille statique, et ne s'arrête plus au survol (seul un clic a un
// sens comme "arrêt" ici). Certaines cartes sont des reels (vidéo en lecture
// automatique, muette, en boucle) plutôt qu'une photo fixe — un clic sur une
// carte vidéo ouvre le contenu lui-même (lightbox, patron de PhotoGallery),
// pas la boutique d'un sport : contrairement aux autres cartes, une vidéo
// vitrine ne mène nulle part en particulier.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { InfiniteMovingCards } from "@/components/InfiniteMovingCards";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { hexToRgbTriplet } from "@/lib/format";

export interface PortalSpotlightItem {
  /** Identifiant stable de la carte (indépendant du titre affiché) — sert de clé React
   * et de clé dans SiteSettings.spotlightGradients pour l'éventuelle couleur choisie en admin. */
  key: string;
  title: string;
  /** Absent pour une carte vidéo qui ne représente pas un sport précis. */
  count?: number;
  href: string;
  image: string;
  /** Reel vidéo (mp4) affiché à la place de `image` quand présent — un clic ouvre la vidéo, pas `href`. */
  video?: string;
  /** Couleur du voile choisie en admin (hex) — absente = calculée automatiquement depuis la photo. */
  gradientColor?: string;
}

/** Moyenne des couleurs du tiers bas de la photo (zone couverte par le voile/texte),
 * assombrie pour rester lisible sous du texte blanc quelle que soit la photo. Se
 * dégrade silencieusement vers le voile noir par défaut si l'image ne peut pas être
 * lue en pixels (CORS) — jamais d'erreur visible pour l'utilisateur. */
function useAutoTint(src: string, override?: string): string | null {
  const forced = hexToRgbTriplet(override);
  const [computed, setComputed] = useState<string | null>(null);

  useEffect(() => {
    // Couleur choisie en admin : rien à calculer, `forced` (dérivé au rendu) prime déjà.
    if (forced) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, img.naturalHeight * 0.55, img.naturalWidth, img.naturalHeight * 0.45, 0, 0, 16, 16);
        const { data } = ctx.getImageData(0, 0, 16, 16);
        let r = 0, g = 0, b = 0;
        const n = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        const darken = 0.45;
        r = Math.round((r / n) * darken);
        g = Math.round((g / n) * darken);
        b = Math.round((b / n) * darken);
        if (!cancelled) setComputed(`${r} ${g} ${b}`);
      } catch {
        // Image non lisible en pixels — le voile noir par défaut (CSS) s'applique.
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, forced]);

  return forced || computed;
}

function SpotlightCard({ item, onOpenVideo }: { item: PortalSpotlightItem; onOpenVideo: (item: PortalSpotlightItem) => void }) {
  const reducedMotion = useReducedMotion();
  const rgb = useAutoTint(item.image, item.gradientColor);
  const style = rgb ? ({ ["--spot-rgb" as string]: rgb } as React.CSSProperties) : undefined;

  if (item.video) {
    return (
      <button type="button" className="portal-spotlight-card" style={style} onClick={() => onOpenVideo(item)}>
        <video
          src={item.video}
          poster={item.image}
          autoPlay={!reducedMotion}
          loop={!reducedMotion}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="portal-spotlight-content">
          <h3>{item.title}</h3>
          <span>
            Vidéo · en magasin
            <Icon name="arrow-forward" size="sm" />
          </span>
        </div>
      </button>
    );
  }

  return (
    <Link href={item.href} className="portal-spotlight-card" style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image} alt="" loading="lazy" />
      <div className="portal-spotlight-content">
        <h3>{item.title}</h3>
        <span>
          {item.count} produit{item.count! > 1 ? "s" : ""}
          <Icon name="arrow-forward" size="sm" />
        </span>
      </div>
    </Link>
  );
}

export function PortalSpotlight({ items }: { items: PortalSpotlightItem[] }) {
  const [openItem, setOpenItem] = useState<PortalSpotlightItem | null>(null);

  useEffect(() => {
    if (!openItem) return;
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenItem(null);
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [openItem]);

  return (
    <>
      <div className="portal-spotlight-marquee">
        <InfiniteMovingCards
          items={items}
          itemKey={(item) => item.key}
          speed="slow"
          ariaLabel="Sports à la une"
          renderItem={(item) => <SpotlightCard item={item} onOpenVideo={setOpenItem} />}
        />
      </div>

      <div
        className={"lightbox" + (openItem ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-hidden={!openItem}
        aria-label={openItem ? openItem.title : ""}
        tabIndex={-1}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpenItem(null);
        }}
      >
        <button className="lb-close" aria-label="Fermer" onClick={() => setOpenItem(null)}>
          <Icon name="close" size="lg" />
        </button>
        {openItem?.video && <video src={openItem.video} poster={openItem.image} controls playsInline />}
      </div>
    </>
  );
}
