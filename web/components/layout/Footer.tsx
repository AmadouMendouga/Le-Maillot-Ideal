import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { whatsappNumber } from "@/lib/cart";
import type { League, SiteSettings } from "@/lib/types";

export function Footer({ leagues, settings }: { leagues: League[]; settings: SiteSettings }) {
  const waNumber = whatsappNumber(settings);

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="logo">
              <span className="logo-mark">
                <Icon name="soccer" size="lg" />
              </span>
              <span>{settings.businessName}</span>
            </Link>
            <p style={{ marginTop: 12 }}>Une sélection de maillots répliques avec demande de commande sur WhatsApp.</p>
            <div className="footer-badges">
              <span>
                <Icon name="shield" size="sm" />
                Modalités confirmées avant commande
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
                <Link href="/">
                  <Icon name="storefront" size="sm" />
                  Accueil
                </Link>
              </li>
              <li>
                <Link href="/boutique">
                  <Icon name="grid" size="sm" />
                  Boutique
                </Link>
              </li>
              <li>
                <Link href="/phototheque">
                  <Icon name="photo-library" size="sm" />
                  Photothèque
                </Link>
              </li>
              <li>
                <Link href="/#faq">
                  <Icon name="info" size="sm" />
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/#about">
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
            <h4>Championnats</h4>
            <ul>
              {leagues.map((league) => (
                <li key={league.key}>
                  <Link href={`/boutique?league=${league.key}`}>{league.label}</Link>
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
            © {new Date().getFullYear()} By NARA Team - {settings.businessName}. Tous droits réservés.
          </span>
          <span>Site non affilié aux clubs ou ligues mentionnés. Maillots répliques.</span>
        </div>
      </div>
    </footer>
  );
}
