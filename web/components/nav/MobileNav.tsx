"use client";

// Tiroir de navigation mobile — porté depuis js/main.js#initNav. Piège à
// focus (Tab/Shift+Tab cycle dans le tiroir), fermeture à l'échap, au clic
// sur le fond, au clic sur un lien, ou si la fenêtre repasse en desktop.
// Le tiroir et le fond (position: fixed dans lmi.css) sont portés dans
// document.body : ils vivent visuellement hors du bouton qui les déclenche,
// pas de contrainte de placement DOM comme sur le site statique d'origine.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/names";

function links(basePath: string): { href: string; label: string; icon: IconName; portal?: boolean }[] {
  return [
    { href: basePath, label: "Accueil", icon: "storefront" },
    { href: `${basePath}/boutique`, label: "Boutique", icon: "grid" },
    { href: `${basePath}/phototheque`, label: "Photothèque", icon: "photo-library" },
    { href: `${basePath}/#faq`, label: "Aide", icon: "info" },
    { href: `${basePath}/#contact`, label: "Contact", icon: "person" },
    { href: `${basePath}/compte`, label: "Mon compte", icon: "verified" },
    // en tête de liste + style distinct (voir .nav-portal-link) : "Autres
    // sports" en dernière position, texte neutre, se perdait dans la liste —
    // un client a signalé ne plus retrouver le chemin vers le portail.
    { href: "/", label: "Tous les univers", icon: "inventory", portal: true },
  ];
}

export function MobileNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const allLinks = links(basePath);
  // le lien "portail" passe en tête de liste : c'est la sortie de secours du
  // site-sport, elle doit se voir avant tout le reste, pas après 6 autres liens.
  const LINKS = [...allLinks.filter((l) => l.portal), ...allLinks.filter((l) => !l.portal)];
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Le portail a besoin de document.body, absent côté serveur — drapeau de
  // montage classique pour l'éviter avant hydratation, pas encore modélisable
  // proprement avec les règles react-hooks actuelles.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const nav = navRef.current;
    const toggle = toggleRef.current;
    if (!nav || !toggle) return;

    const raf = requestAnimationFrame(() => {
      nav.querySelector<HTMLElement>("a")?.focus();
    });

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
        return;
      }
      if (e.key !== "Tab" || !nav) return;
      const links = Array.from(nav.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")).filter(
        (el) => el.getClientRects().length > 0
      );
      const focusable = [toggle!, ...links];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeydown);

    const mobile = window.matchMedia("(max-width: 1040px)");
    const onViewportChange = (e: MediaQueryListEvent) => {
      if (!e.matches) close(false);
    };
    mobile.addEventListener("change", onViewportChange);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeydown);
      mobile.removeEventListener("change", onViewportChange);
    };
  }, [open]);

  const drawer = (
    <>
      <div className={"nav-backdrop" + (open ? " open" : "")} onClick={() => close(true)} />
      <nav
        id="mobileNav"
        ref={navRef}
        className={"main-nav" + (open ? " open" : "")}
        aria-label="Menu mobile"
        aria-hidden={!open}
        inert={!open}
      >
        <ul>
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={[pathname === link.href && "active", link.portal && "nav-portal-link"]
                  .filter(Boolean)
                  .join(" ") || undefined}
                onClick={() => close(false)}
              >
                <Icon name={link.icon} size="sm" />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );

  return (
    <>
      <button
        ref={toggleRef}
        className="nav-toggle"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        aria-controls="mobileNav"
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <Icon name="menu" size="lg" />
      </button>
      {mounted && createPortal(drawer, document.body)}
    </>
  );
}
