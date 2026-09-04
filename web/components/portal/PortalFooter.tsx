// Pied de page du portail (/) — variante allégée de <Footer> : pas de colonne
// "Navigation" (Boutique/Photothèque/FAQ n'existent qu'à l'intérieur d'un
// site-sport), la colonne "Sports" reste le cœur du portail.
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { whatsappNumber } from "@/lib/cart";
import type { Sport, SiteSettings } from "@/lib/types";

export function PortalFooter({ sports, settings }: { sports: Sport[]; settings: SiteSettings }) {
  const waNumber = whatsappNumber(settings);

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="logo">
              <span className="logo-mark">
                <Icon name="storefront" size="lg" />
              </span>
              <span>{settings.businessName}</span>
            </Link>
            <p style={{ marginTop: 12 }}>Une sélection d&apos;articles de sport avec demande de commande sur WhatsApp.</p>
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
            <h4>Sports</h4>
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
            © {new Date().getFullYear()} By NARA Team - {settings.businessName}. Tous droits réservés.
          </span>
          <span>Site non affilié aux marques, clubs ou ligues mentionnés.</span>
        </div>
      </div>
    </footer>
  );
}
