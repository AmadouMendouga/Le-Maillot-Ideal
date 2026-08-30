"use client";

// Stateful Button — porté depuis js/stateful-button.js. Séquence d'origine :
// spinner (200ms) → travail → spinner off (200ms de battement) → coche (reste
// 2000ms) → retour à l'état initial. Le `layout` de Framer Motion (largeur du
// bouton qui s'anime) est reproduit en FLIP via useLayoutEffect + WAAPI.
// Le bouton NE change JAMAIS de couleur pendant la séquence (comportement
// d'origine, évite un 3e vert) — voir CLAUDE.md §5.4.
import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

type SBState = "idle" | "loading" | "settling" | "done" | "error";

export interface StatefulButtonProps {
  children: ReactNode;
  onRun: () => Promise<void>;
  onValidate?: () => boolean;
  className?: string;
  href?: string;
  target?: string;
  rel?: string;
  ariaLabel?: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Loader() {
  return (
    <svg
      className="sb-loader"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      className="sb-check"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l5 5l10 -10" />
    </svg>
  );
}

export function StatefulButton({
  children,
  onRun,
  onValidate,
  className,
  href,
  target,
  rel,
  ariaLabel,
}: StatefulButtonProps) {
  const [state, setState] = useState<SBState>("idle");
  const ref = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const busyRef = useRef(false);
  const prevWidthRef = useRef<number | null>(null);

  // FLIP : anime la largeur du bouton entre deux rendus où l'icône visible a changé.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w1 = el.getBoundingClientRect().width;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prevWidthRef.current != null && !reduce && typeof el.animate === "function") {
      const w0 = prevWidthRef.current;
      if (Math.abs(w1 - w0) >= 0.5) {
        el.animate([{ width: w0 + "px" }, { width: w1 + "px" }], { duration: 200, easing: "ease-out" });
      }
    }
    prevWidthRef.current = w1;
  }, [state]);

  async function runSequence() {
    busyRef.current = true;
    setState("loading");
    await wait(200);

    try {
      await onRun();
    } catch {
      setState("error");
      await wait(1600);
      setState("idle");
      busyRef.current = false;
      return;
    }

    setState("settling");
    await wait(200);
    setState("done");

    await wait(2000); // delay: 2 du composant d'origine
    setState("idle");
    busyRef.current = false;
  }

  function handleClick(e: MouseEvent) {
    if (busyRef.current) {
      e.preventDefault();
      return;
    }
    if (onValidate && !onValidate()) {
      e.preventDefault();
      setState("error");
      setTimeout(() => setState("idle"), 1600);
      return;
    }
    // Pas de preventDefault : sur un lien, la navigation (ouverture d'onglet)
    // suit son cours pendant que l'animation joue en parallèle — un
    // window.open() après un await serait bloqué comme popup, l'ancre non.
    void runSequence();
  }

  const cls = [
    "btn-stateful",
    className,
    state === "loading" && "is-loading",
    state === "done" && "is-done",
    state === "error" && "is-error",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <span className="sb-inner">
      <Loader />
      <Check />
      {children}
    </span>
  );

  if (href) {
    return (
      <a ref={ref} href={href} target={target} rel={rel} className={cls} onClick={handleClick} aria-label={ariaLabel}>
        {content}
      </a>
    );
  }

  return (
    <button ref={ref} type="button" className={cls} onClick={handleClick} aria-label={ariaLabel}>
      {content}
    </button>
  );
}
