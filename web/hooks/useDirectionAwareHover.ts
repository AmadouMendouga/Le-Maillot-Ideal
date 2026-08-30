"use client";

// Direction Aware Hover — porté depuis js/direction-aware-hover.js.
// L'animation elle-même (translation image/légende, voile) vit dans lmi.css
// via les variables --dah-x/--dah-y/--dah-tx/--dah-ty et la classe .is-hover ;
// ce hook ne fait que calculer le bord d'entrée du curseur et poser ces
// variables — aucun appel Web Animations API nécessaire ici.
import { useRef, type MouseEvent } from "react";

type Direction = "top" | "right" | "bottom" | "left";

const IMG: Record<Direction, { x: number; y: number }> = {
  top: { x: 0, y: 20 },
  bottom: { x: 0, y: -20 },
  left: { x: 20, y: 0 },
  right: { x: -20, y: 0 },
};
const TXT: Record<Direction, { x: number; y: number }> = {
  top: { x: 0, y: -20 },
  bottom: { x: 0, y: 2 },
  left: { x: -2, y: 0 },
  right: { x: 20, y: 0 },
};
const NAMES: Direction[] = ["top", "right", "bottom", "left"];

function getDirection(ev: { clientX: number; clientY: number }, el: HTMLElement): Direction {
  const r = el.getBoundingClientRect();
  const w = r.width;
  const h = r.height;
  const x = ev.clientX - r.left - (w / 2) * (w > h ? h / w : 1);
  const y = ev.clientY - r.top - (h / 2) * (h > w ? w / h : 1);
  const d = Math.round(Math.atan2(y, x) / 1.57079633 + 5) % 4;
  return NAMES[d] || "left";
}

export function useDirectionAwareHover<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  function set(dir: Direction, on: boolean) {
    const el = ref.current;
    if (!el) return;
    const i = on ? IMG[dir] : { x: 0, y: 0 };
    const t = on ? TXT[dir] : { x: 0, y: 0 };
    el.style.setProperty("--dah-x", i.x + "px");
    el.style.setProperty("--dah-y", i.y + "px");
    el.style.setProperty("--dah-tx", t.x + "px");
    el.style.setProperty("--dah-ty", t.y + "px");
    el.classList.toggle("is-hover", on);
  }

  return {
    ref,
    onMouseEnter: (e: MouseEvent<T>) => set(getDirection(e, e.currentTarget), true),
    // On sort par le bord le plus proche : la légende repart du bon côté.
    onMouseLeave: (e: MouseEvent<T>) => set(getDirection(e, e.currentTarget), false),
    // Le clavier ne connaît pas de direction : entrée par le bas, comme un focus.
    onFocus: () => set("bottom", true),
    onBlur: () => set("bottom", false),
  };
}
