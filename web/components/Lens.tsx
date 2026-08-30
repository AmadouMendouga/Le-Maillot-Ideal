"use client";

// Lens — porté depuis js/lens.js. Valeurs par défaut du composant Aceternity :
// zoomFactor 1.5, lensSize 170px. Remplace Direction Aware Hover sur la photo
// de fiche produit (voir CLAUDE.md §5.9) ; neutralisé au tactile via CSS
// (@media (hover: none)), comme les autres effets de survol.
import { useRef, type MouseEvent, type RefObject } from "react";

export interface LensProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  zoom?: number;
  size?: number;
  /** Expose le conteneur racine (utile pour flyToCart sur la fiche produit). */
  mediaRef?: RefObject<HTMLDivElement | null>;
}

export function Lens({ src, alt, width = 500, height = 500, zoom = 1.5, size = 170, mediaRef }: LensProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);

  function move(e: MouseEvent<HTMLDivElement>) {
    const el = rootRef.current;
    const glass = glassRef.current;
    if (!el || !glass) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      glass.classList.remove("on");
      return;
    }
    glass.classList.add("on");
    glass.style.left = x + "px";
    glass.style.top = y + "px";
    glass.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
    glass.style.backgroundPosition = `${-(x * zoom - size / 2)}px ${-(y * zoom - size / 2)}px`;
  }

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
        if (mediaRef) mediaRef.current = el;
      }}
      className="pd-media lens"
      onMouseMove={move}
      onMouseLeave={() => glassRef.current?.classList.remove("on")}
    >
      <div className="lens-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={width} height={height} />
      </div>
      <div
        ref={glassRef}
        className="lens-glass"
        aria-hidden="true"
        style={{ width: size, height: size, backgroundImage: `url('${src}')` }}
      />
    </div>
  );
}
