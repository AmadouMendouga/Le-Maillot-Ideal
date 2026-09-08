// Pied de page du portail (/) — variante allégée de <Footer> : pas de colonne
// "Navigation" (Boutique/Photothèque/FAQ n'existent qu'à l'intérieur d'un
// site-sport), la colonne "Sports" reste le cœur du portail. Bandeau de
// marques (défilement continu, patron .imc-*) juste avant le pied de page —
// vraies marques du catalogue, pour l'authenticité, pas des logos inventés.
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { whatsappNumber } from "@/lib/cart";
import { InfiniteMovingCards } from "@/components/InfiniteMovingCards";
import type { Sport, SiteSettings, Product } from "@/lib/types";

// Certaines fiches portent une variante de collaboration ("Puma x b4b",
// "Volanti (b4b)") — on affiche la marque elle-même, pas le nom du
// revendeur qui l'accompagne.
function cleanBrand(team: string): string {
  return team.replace(/\s*\(.*?\)\s*/g, "").replace(/\s*x\s+\S+$/i, "").trim();
}

function brandsFromProducts(products: Product[]): string[] {
  const seen = new Set<string>();
  for (const p of products) {
    // Sur le football, "team" désigne le club (Real Madrid, PSG…), pas une
    // marque d'équipement — seuls les autres sports y mettent une vraie
    // marque (Nike, KuSakura…).
    if (p.sport === "football") continue;
    const name = cleanBrand(p.team);
    if (name) seen.add(name);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "fr"));
}

export function PortalFooter({
  sports,
  settings,
  products,
}: {
  sports: Sport[];
  settings: SiteSettings;
  products: Product[];
}) {
  const waNumber = whatsappNumber(settings);
  const brands = brandsFromProducts(products);

  return (
    <footer className="site-footer">
      {brands.length > 0 && (
        <div className="portal-brand-marquee">
          <InfiniteMovingCards
            items={brands}
            itemKey={(brand) => brand}
            speed="normal"
            ariaLabel="Marques disponibles au catalogue"
            renderItem={(brand) => <span className="portal-brand-item">{brand}</span>}
          />
        </div>
      )}
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="logo">
              <span className="logo-mark">
                <Icon name="storefront" size="lg" />
              </span>
              <span>{settings.businessName}</span>
            </Link>
            <p style={{ marginTop: 12 }}>Plusieurs univers sportifs réunis dans une boutique simple et accessible.</p>
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
            {/* Pas "Sports" : Sneakers y figure aussi, et ce n'est pas un
                sport — retour client du 06/09/2026. "Univers" reprend le mot
                déjà utilisé plus haut sur le portail ("Nos univers"). */}
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
          <span>
            Site non affilié aux marques, clubs ou ligues mentionnés. · <Link href="/confidentialite">Confidentialité</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
