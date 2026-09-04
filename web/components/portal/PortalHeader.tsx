"use client";

// En-tête du portail (/) — plus léger que <Navbar> : pas de méga-menu boutique
// ni de panier, le portail ne vend rien lui-même, il redirige vers un
// site-sport. Réutilise les classes CSS de la navbar existante (.am-wrap,
// .am-nav, .logo, .header-actions) pour un rendu cohérent, sans le JS
// d'animation de <NavbarMenu> (inutile ici, il n'y a pas de sous-menu).
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { ThemeToggle } from "@/components/nav/ThemeToggle";
import type { SiteSettings } from "@/lib/types";

export function PortalHeader({ settings }: { settings: SiteSettings }) {
  const waNumber = settings.whatsapp;

  return (
    <>
      <div className="topbar">
        <div className="container">
          <span>
            <Icon name="shipping" size="sm" /> <span>{settings.topbarInfo}</span>
          </span>
          <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener">
            <Icon name="whatsapp" size="sm" /> <span>{settings.topbarHelp}</span>
          </a>
        </div>
      </div>

      <div className="am-wrap">
        <div className="am-shell">
          <nav className="am-nav" aria-label="Navigation principale">
            <Link href="/" className="logo">
              <span className="logo-mark">
                <Icon name="storefront" size="lg" />
              </span>
              <span>{settings.businessName}</span>
            </Link>

            <div className="header-actions" style={{ marginLeft: "auto" }}>
              <ThemeToggle />
              <a className="btn btn-whatsapp btn-sm" href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener">
                <Icon name="whatsapp" size="sm" />
                Nous contacter
              </a>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
