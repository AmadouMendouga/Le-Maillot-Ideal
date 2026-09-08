"use client";

// Photos du portail conservées, affichées en plein cadre avec commandes accessibles.
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
  /** Photo de présentation du portail. */
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
    <section className="portal-hero" aria-label="Présentation IKIGAI Sport"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onFocusCapture={() => { pausedRef.current = true; }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) pausedRef.current = false; }}>

      <ul className="portal-hero-slides">
        {slides.map((slide, i) => (
          <li key={i} className={"portal-hero-slide" + (i === active ? " active" : "")} aria-hidden={i !== active} inert={i !== active}>
            <div className="portal-hero-bg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.image} alt="" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} />
              <div className="portal-hero-scrim" style={{ background: "linear-gradient(135deg, #22C55E 0%, var(--hero-bg) 100%)" }} />
            </div>
            <div className="container portal-hero-content">
              <span className="hero-badge">{slide.eyebrow}</span>
              {i === 0 ? (
                <h1>{slide.title}</h1>
              ) : (
                <h2>{slide.title}</h2>
              )}
              <p>{slide.lead}</p>
              <Link href={slide.ctaHref} className="btn btn-primary">
                {slide.ctaLabel}
                <Icon name="arrow-forward" size="sm" />
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {slides.length > 1 && (
        <div className="portal-hero-nav">
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
