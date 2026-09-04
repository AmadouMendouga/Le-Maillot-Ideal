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

export interface PortalSpotlightItem {
  title: string;
  /** Absent pour une carte vidéo qui ne représente pas un sport précis. */
  count?: number;
  href: string;
  image: string;
  /** Reel vidéo (mp4) affiché à la place de `image` quand présent — un clic ouvre la vidéo, pas `href`. */
  video?: string;
}

export function PortalSpotlight({ items }: { items: PortalSpotlightItem[] }) {
  const reducedMotion = useReducedMotion();
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
          // le titre, pas href : plusieurs cartes (les reels boutique) partagent
          // la même destination /sneakers sans être le même contenu — des clés
          // dupliquées faisaient perdre React (children React dupliqués/omis).
          itemKey={(item) => item.title}
          speed="slow"
          ariaLabel="Sports à la une"
          renderItem={(item) =>
            item.video ? (
              <button type="button" className="portal-spotlight-card" onClick={() => setOpenItem(item)}>
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
            ) : (
              <Link href={item.href} className="portal-spotlight-card">
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
            )
          }
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
