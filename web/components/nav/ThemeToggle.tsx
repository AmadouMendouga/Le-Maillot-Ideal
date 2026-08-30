"use client";

import { Icon } from "@/components/icons/Icon";
import { showToast } from "@/components/Toast";

const THEME_KEY = "lmi_theme";

export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // stockage indisponible (navigation privée…) — le thème reste appliqué pour la session
    }
    showToast(next === "dark" ? "Thème sombre activé" : "Thème clair activé", "dark-mode");
  }

  return (
    <button className="theme-toggle" aria-label="Changer de thème" title="Thème clair / sombre" onClick={toggle}>
      <Icon name="dark-mode" size="lg" className="i-moon" />
      <Icon name="light-mode" size="lg" className="i-sun" />
    </button>
  );
}
