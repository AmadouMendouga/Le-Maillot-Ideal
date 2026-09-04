"use client";

// Hero à diapositives du portail — patron emprunté à
// Site reussi/restrowebsite (#HERO + script.js "HERO SLIDER") : fondu-croisé
// 1s, zoom lent du fond sur la durée exacte de l'auto-défilement (7s, pour
// que le zoom se termine pile quand la diapositive suivante arrive), et
// révélation du texte en cascade (badge, titre, texte, CTA décalés de 300ms
// chacun). Contenu des diapositives dérivé de données réelles du catalogue
// (app/page.tsx) — pas de texte marketing inventé.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons/Icon";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface PortalHeroSlide {
  eyebrow: string;
  title: string;
  lead: string;
  ctaLabel: string;
  ctaHref: string;
  color: string;
  /** Photo de fond — un vrai produit du catalogue en attendant de vraies
   * photos de mise en scène (voir app/page.tsx). */
  image: string;
}

const AUTO_ADVANCE_MS = 7000;

export function PortalHero({ slides }: { slides: PortalHeroSlide[] }) {
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (slides.length <= 1 || reduceMotion) return;
    const id = setInterval(() => {
      if (!pausedRef.current) setActive((i) => (i + 1) % slides.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [slides.length, reduceMotion]);

  if (slides.length === 0) return null;

  function go(delta: number) {
    setActive((i) => (i + delta + slides.length) % slides.length);
  }

  return (
    <section className="portal-hero" aria-label="Présentation IKIGAI Sport">
      <ul className="portal-hero-slides">
        {slides.map((slide, i) => (
          <li key={i} className={"portal-hero-slide" + (i === active ? " active" : "")} aria-hidden={i !== active}>
            <div className="portal-hero-bg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.image} alt="" loading={i === 0 ? "eager" : "lazy"} />
              <div
                className="portal-hero-scrim"
                style={{ background: `linear-gradient(135deg, ${slide.color} 0%, var(--hero-bg) 100%)` }}
              />
            </div>
            <div className="container portal-hero-content">
              <span className="hero-badge portal-hero-reveal">{slide.eyebrow}</span>
              <h1 className="portal-hero-reveal">{slide.title}</h1>
              <p className="portal-hero-reveal">{slide.lead}</p>
              <Link href={slide.ctaHref} className="btn btn-primary btn-lg portal-hero-reveal">
                {slide.ctaLabel}
                <Icon name="arrow-forward" size="sm" />
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {slides.length > 1 && (
        <div
          className="portal-hero-nav"
          onMouseEnter={() => {
            pausedRef.current = true;
          }}
          onMouseLeave={() => {
            pausedRef.current = false;
          }}
        >
          <button type="button" aria-label="Diapositive précédente" onClick={() => go(-1)}>
            <Icon name="chevron-left" />
          </button>
          <div className="portal-hero-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={"portal-hero-dot" + (i === active ? " on" : "")}
                aria-label={`Aller à la diapositive ${i + 1}`}
                aria-current={i === active}
                onClick={() => setActive(i)}
              />
            ))}
          </div>
          <button type="button" aria-label="Diapositive suivante" onClick={() => go(1)}>
            <Icon name="chevron-right" />
          </button>
        </div>
      )}
    </section>
  );
}
