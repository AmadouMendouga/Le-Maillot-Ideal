import type { Metadata } from "next";
import { getAllSports } from "@/lib/data/sports";
import { getAllProducts } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";
import { Icon } from "@/components/icons/Icon";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";
import { SportMarquee } from "@/components/home/SportMarquee";
import { SportGrid } from "@/components/home/SportGrid";

export const metadata: Metadata = {
  title: "IKIGAI Sport",
  description:
    "IKIGAI Sport — la boutique de référence pour tes équipements sportifs au Cameroun. Choisis ton sport : maillots, judogi, et bien d'autres.",
};

// Portail — page vitrine, pas de catalogue à ce niveau (voir le plan "portail
// multi-sports"). Chaque carte mène vers le site complet d'un sport
// (/[sport]), avec sa propre boutique et son propre discours marketing.
export default async function PortalPage() {
  const [sports, products, settings] = await Promise.all([getAllSports(), getAllProducts(), getSiteSettings()]);

  return (
    <>
      <PortalHeader settings={settings} />

      <main id="main">
        <section className="hero">
          <div className="container hero-text-only">
            <div>
              <span className="hero-badge">
                <Icon name="storefront" size="sm" /> La boutique de référence au Cameroun
              </span>
              <h1>
                <span>Un système, plusieurs sports.</span>
                <br />
                <span>Choisis le tien.</span>
              </h1>
              <p className="lead">
                {settings.businessName} regroupe des boutiques dédiées à chaque discipline — maillots, judogi, et
                bien d&apos;autres équipements sportifs. Choisis ton sport pour accéder à sa boutique complète.
              </p>
              <div className="hero-stats">
                <div>
                  <strong>{sports.length}</strong>
                  <span>Sport{sports.length > 1 ? "s" : ""} couvert{sports.length > 1 ? "s" : ""}</span>
                </div>
                <div>
                  <strong>{products.length}</strong>
                  <span>Articles au catalogue</span>
                </div>
                <div>
                  <strong>WhatsApp</strong>
                  <span>Commande directe</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SportMarquee sports={sports} products={products} />

        <section className="services-strip">
          <div className="container">
            <div className="services-grid">
              <div className="service-item">
                <span className="ic">
                  <Icon name="whatsapp" size="lg" />
                </span>
                <div>
                  <h4>Commande WhatsApp</h4>
                  <p>Rapide, simple, sans compte à créer</p>
                </div>
              </div>
              <div className="service-item">
                <span className="ic">
                  <Icon name="money" size="lg" />
                </span>
                <div>
                  <h4>Paiement à confirmer</h4>
                  <p>Modalités convenues sur WhatsApp avant la commande</p>
                </div>
              </div>
              <div className="service-item">
                <span className="ic">
                  <Icon name="shipping" size="lg" />
                </span>
                <div>
                  <h4>Livraison à confirmer</h4>
                  <p>Zone, délai et frais précisés avant la commande</p>
                </div>
              </div>
              <div className="service-item">
                <span className="ic">
                  <Icon name="check-circle" size="lg" />
                </span>
                <div>
                  <h4>Un site par sport</h4>
                  <p>Une boutique dédiée, propre à chaque discipline</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  <Icon name="inventory" size="sm" />
                  Nos sports
                </span>
                <h2>Choisis ton sport</h2>
                <p>Chaque carte ouvre un site complet : boutique, fiches produit, panier et commande WhatsApp.</p>
              </div>
            </div>
            <SportGrid sports={sports} products={products} />
          </div>
        </section>
      </main>

      <PortalFooter sports={sports} settings={settings} />
      <WhatsAppFloat settings={settings} />
    </>
  );
}
