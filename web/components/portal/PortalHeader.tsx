"use client";

// En-tête du portail (/) — délibérément différent de <Navbar> (barre pilule
// flottante des sites-sport) : bandeau plein-largeur transparent qui se
// solidifie au défilement et se masque en descendant, plus un tiroir latéral
// avec bouton "hamburger" animé — patron emprunté à Site reussi/restrowebsite
// (valeurs exactes : seuil 50px, transition 250ms, tiroir 500ms, lignes du
// bouton en respiration continue 400ms staggée). Le portail n'a pas de
// méga-menu boutique ni de panier : le tiroir ne contient que les sports et
// le contact.
//
// Bandeau d'info (topbar) et barre logo/nav sont deux couches `position:
// fixed` INDÉPENDANTES, empilées verticalement — même structure que
// restrowebsite (`.topbar` + `.header`, `.header{top:51px}` puis `top:0` au
// défilement), pas un seul bloc qui rétrécit sa propre hauteur. Ce dernier
// forçait à animer max-height/padding (recalcul de mise en page à chaque
// frame) ; ici seuls `transform`/`top` bougent. La hauteur réelle du bandeau
// d'info est mesurée (elle dépend du texte de configuration, contrairement
// au gabarit statique de restrowebsite) et posée en variable CSS plutôt que
// codée en dur, pour rester correcte quel que soit le texte ou la largeur.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { ThemeToggle } from "@/components/nav/ThemeToggle";
import type { SiteSettings, Sport } from "@/lib/types";

const SCROLL_THRESHOLD = 50;

export function PortalHeader({ settings, sports }: { settings: SiteSettings; sports: Sport[] }) {
  const waNumber = settings.whatsapp;
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastScrollRef = useRef(0);
  const topbarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setScrolled(y >= SCROLL_THRESHOLD);
      setHidden(y > lastScrollRef.current && y >= SCROLL_THRESHOLD);
      lastScrollRef.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const topbar = topbarRef.current;
    const header = headerRef.current;
    if (!topbar || !header) return;
    const ro = new ResizeObserver(([entry]) => {
      header.style.setProperty("--portal-topbar-h", `${entry.contentRect.height}px`);
    });
    ro.observe(topbar);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("portal-drawer-open", drawerOpen);
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("portal-drawer-open");
    };
  }, [drawerOpen]);

  return (
    <>
      <div ref={topbarRef} className={"portal-topbar" + (scrolled ? " hidden" : "")}>
        <div className="container">
          <span>
            <Icon name="shipping" size="sm" /> <span>{settings.topbarInfo}</span>
          </span>
          <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener">
            <Icon name="whatsapp" size="sm" /> <span>{settings.topbarHelp}</span>
          </a>
        </div>
      </div>

      <header
        ref={headerRef}
        className={"portal-header" + (scrolled ? " scrolled" : "") + (hidden && !drawerOpen ? " hide" : "")}
      >
        <div className="container portal-header-row">
          <Link href="/" className="logo">
            <span className="logo-mark">
              <Icon name="storefront" size="lg" />
            </span>
            <span>{settings.businessName}</span>
          </Link>

          <div className="portal-header-actions">
            <ThemeToggle />
            <button
              type="button"
              className={"portal-hamburger" + (drawerOpen ? " active" : "")}
              aria-label={drawerOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={drawerOpen}
              aria-controls="portalDrawer"
              onClick={() => setDrawerOpen((v) => !v)}
            >
              <span className="line line-1" />
              <span className="line line-2" />
              <span className="line line-3" />
            </button>
          </div>
        </div>
      </header>

      <div
        className={"portal-overlay" + (drawerOpen ? " open" : "")}
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
      />

      <nav
        id="portalDrawer"
        className={"portal-drawer" + (drawerOpen ? " open" : "")}
        aria-label="Menu du portail"
        inert={!drawerOpen}
      >
        <button type="button" className="portal-drawer-close" aria-label="Fermer le menu" onClick={() => setDrawerOpen(false)}>
          <Icon name="close" />
        </button>

        <p className="portal-drawer-title">Nos univers</p>
        <ul className="portal-drawer-list">
          {sports.map((sport) => (
            <li key={sport.key}>
              <Link href={`/${sport.key}`} onClick={() => setDrawerOpen(false)}>
                {sport.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="portal-drawer-contact">
          <p>Une question avant de choisir ?</p>
          <a
            className="btn btn-whatsapp btn-block"
            href={`https://wa.me/${waNumber}`}
            target="_blank"
            rel="noopener"
            onClick={() => setDrawerOpen(false)}
          >
            <Icon name="whatsapp" size="sm" />
            Nous contacter sur WhatsApp
          </a>
        </div>
      </nav>
    </>
  );
}
