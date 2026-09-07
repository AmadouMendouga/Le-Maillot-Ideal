import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { whatsappNumber } from "@/lib/cart";
import type { Sport, SiteSettings } from "@/lib/types";

export function Footer({
  basePath,
  sports,
  settings,
}: {
  basePath: string;
  sports: Sport[];
  settings: SiteSettings;
}) {
  const waNumber = whatsappNumber(settings);

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            {/* même repère universel que Navbar.tsx — voir son commentaire. */}
            <Link href="/" className="logo">
              <span className="logo-mark">
                <Icon name="storefront" size="lg" />
              </span>
              <span>{settings.businessName}</span>
            </Link>
            <p style={{ marginTop: 12 }}>Des articles sélectionnés pour votre pratique, avec accompagnement jusqu&apos;à la livraison.</p>
            <div className="footer-badges">
              <span>
                <Icon name="shield" size="sm" />
                Assistance avant et après commande
              </span>
              <span>
                <Icon name="location" size="sm" />
                Basé au Cameroun
              </span>
            </div>
          </div>
          <div>
            <h4>Navigation</h4>
            <ul>
              <li>
                <Link href={basePath}>
                  <Icon name="storefront" size="sm" />
                  Accueil
                </Link>
              </li>
              <li>
                <Link href={`${basePath}/boutique`}>
                  <Icon name="grid" size="sm" />
                  Boutique
                </Link>
              </li>
              <li>
                <Link href={`${basePath}/phototheque`}>
                  <Icon name="photo-library" size="sm" />
                  Photothèque
                </Link>
              </li>
              <li>
                <Link href={`${basePath}/#faq`}>
                  <Icon name="info" size="sm" />
                  FAQ
                </Link>
              </li>
              <li>
                <Link href={`${basePath}/#about`}>
                  <Icon name="verified" size="sm" />
                  Qui sommes-nous
                </Link>
              </li>
              <li>
                <Link href="/confidentialite">
                  <Icon name="shield" size="sm" />
                  Confidentialité
                </Link>
              </li>
            </ul>
          </div>
          <div>
            {/* même correction que PortalFooter.tsx — Sneakers n'est pas un sport. */}
            <h4>Univers</h4>
            <ul>
              {sports.map((sport) => (
                <li key={sport.key}>
                  <Link href={`/${sport.key}`}>{sport.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Contact</h4>
            <ul>
              <li>
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener">
                  <Icon name="whatsapp" size="sm" />
                  <span>{settings.whatsappDisplay}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${settings.email}`}>
                  <Icon name="mail" size="sm" />
                  <span>{settings.email}</span>
                </a>
              </li>
              <li>
                <span>
                  <Icon name="location" size="sm" />
                  <span>{settings.address}</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {settings.businessName}. Conçu par NARA Team. Tous droits réservés.
          </span>
          <span>Site non affilié aux marques, clubs ou ligues mentionnés.</span>
        </div>
      </div>
    </footer>
  );
}
