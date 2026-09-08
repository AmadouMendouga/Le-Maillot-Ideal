"use client";

import { useSyncExternalStore } from "react";
import { normalizeFavoriteSlugs, toggleFavoriteSlug } from "@/lib/favorites";

const KEY = "ikigai_favorites_v1";
const EVENT = "ikigai:favorites";
const EMPTY: string[] = [];
let snapshot = EMPTY;
let cachedRaw: string | null | undefined;
let memoryOnly = false;

function getSnapshot() {
  if (typeof window === "undefined") return EMPTY;
  if (memoryOnly) return snapshot;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try { snapshot = normalizeFavoriteSlugs(raw ? JSON.parse(raw) : []); }
      catch { snapshot = EMPTY; }
    }
  } catch { memoryOnly = true; }
  return snapshot;
}

function subscribe(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === KEY || event.key === null) onChange();
  }
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFavorites() {
  const slugs = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  function toggle(slug: string) {
    snapshot = toggleFavoriteSlug(getSnapshot(), slug);
    cachedRaw = JSON.stringify(snapshot);
    try { localStorage.setItem(KEY, cachedRaw); }
    catch { memoryOnly = true; }
    window.dispatchEvent(new Event(EVENT));
  }
  return { slugs, toggle };
}
