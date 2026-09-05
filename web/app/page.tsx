import type { Metadata } from "next";
import { getAllSports } from "@/lib/data/sports";
import { getAllProducts } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";
import { getTestimonials } from "@/lib/data/testimonials";
import { Icon } from "@/components/icons/Icon";
import { PortalPreloader } from "@/components/portal/PortalPreloader";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalHero, type PortalHeroSlide } from "@/components/portal/PortalHero";
import { PortalSpotlight, type PortalSpotlightItem } from "@/components/portal/PortalSpotlight";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";
import { BackToTop } from "@/components/layout/BackToTop";
import { SportMarquee } from "@/components/home/SportMarquee";
import { SportGrid } from "@/components/home/SportGrid";
import { AnimatedTestimonials } from "@/components/AnimatedTestimonials";
import { safeColor } from "@/lib/format";
import type { Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "IKIGAI Sport",
  description:
    "IKIGAI Sport — la boutique de référence pour tes équipements sportifs au Cameroun. Choisis ton sport : maillots, judogi, et bien d'autres.",
};

// Portail — page vitrine, pas de catalogue à ce niveau (voir le plan "portail
// multi-sports"). Chaque carte mène vers le site complet d'un sport
// (/[sport]), avec sa propre boutique et son propre discours marketing.
// Structure et animations empruntées à Site reussi/restrowebsite (hero à
// diapositives, cartes vedette, à propos, liste catalogue, témoignages) —
// avec de vraies photos du catalogue en attendant de vraies photos de mise
// en scène (voir chaque composant portal/*).
export default async function PortalPage() {
  const [sports, products, settings, testimonials] = await Promise.all([
    getAllSports(),
    getAllProducts(),
    getSiteSettings(),
    getTestimonials(),
  ]);

  const image = (p: Product | undefined) => p?.images.wide || p?.images.square || "";

  const football = sports.find((s) => s.key === "football");
  const footballProducts = products.filter((p) => p.sport === "football");
  const footballCount = footballProducts.length;

  const combatKeys = ["judo", "kendo", "nippon-kempo"];
  const combatSports = sports.filter((s) => combatKeys.includes(s.key));
  const combatProducts = products.filter((p) => combatSports.some((s) => s.key === p.sport));
  const combatCount = combatProducts.length;

  const recentKeys = ["basketball", "sneakers"];
  const recentSports = sports.filter((s) => recentKeys.includes(s.key));
  const recentProducts = products.filter((p) => recentSports.some((s) => s.key === p.sport));
  const recentCount = recentProducts.length;

  // Diapositives du hero — dérivées du catalogue réel (compteurs, sports
  // existants), jamais de texte marketing inventé.
  const slides: PortalHeroSlide[] = [
    {
      eyebrow: "La boutique de référence au Cameroun",
      title: "Un système, plusieurs sports.",
      lead: `${settings.businessName} regroupe des boutiques dédiées à chaque discipline. Choisis ton sport pour accéder à sa boutique complète.`,
      ctaLabel: "Choisir un sport",
      ctaHref: "#sports",
      color: "var(--hero-bg)",
      image: image(footballProducts[0]),
    },
  ];
  if (football && footballCount > 0) {
    slides.push({
      eyebrow: "Le plus grand catalogue",
      title: `${footballCount} maillots de football.`,
      lead: "Ligue 1, Premier League, Liga, Serie A, Bundesliga et équipes nationales — pour chaque championnat et chaque équipe.",
      ctaLabel: "Voir la boutique Football",
      ctaHref: "/football",
      color: safeColor(football.color),
      image: image(footballProducts[1] || footballProducts[0]),
    });
  }
  if (recentSports.length > 0 && recentCount > 0) {
    slides.push({
      eyebrow: "Nouveau",
      title: recentSports.map((s) => s.label).join(" & ") + ".",
      lead: `${recentCount} articles au catalogue — les dernières arrivées IKIGAI Sport.`,
      ctaLabel: "Découvrir",
      ctaHref: `/${recentSports[0].key}`,
      color: safeColor(recentSports[0].color),
      image: image(recentProducts[0]),
    });
  }

  // Cartes vedette — mêmes regroupements que le hero, avec d'autres photos
  // du catalogue pour varier les visuels d'une section à l'autre.
  // gradientColor : couleur du voile choisie en admin pour cette carte (onglet
  // Réglages du site) — absente = voile calculé automatiquement depuis la photo,
  // voir useAutoTint dans PortalSpotlight.tsx.
  const spotlightGradients = settings.spotlightGradients || {};
  const spotlight: PortalSpotlightItem[] = [];
  if (football && footballCount > 0) {
    spotlight.push({
      key: "football",
      title: "Football",
      count: footballCount,
      href: "/football",
      image: image(footballProducts[2] || footballProducts[0]),
      gradientColor: spotlightGradients["football"],
    });
  }
  if (combatSports.length > 0 && combatCount > 0) {
    const combatCounts = combatSports.map((s) => ({
      sport: s,
      count: products.filter((p) => p.sport === s.key).length,
    }));
    const combatLead = combatCounts.reduce((a, b) => (b.count > a.count ? b : a));
    spotlight.push({
      key: "arts-martiaux",
      title: "Arts martiaux",
      count: combatCount,
      href: `/${combatLead.sport.key}`,
      // Photo fournie par le client (judoka en kimono), pas une photo produit du catalogue.
      image: "https://res.cloudinary.com/ijazcmgk/image/upload/v1788582494/le-maillot-ideal/portal/spotlight/arts-martiaux-judoka.jpg",
      gradientColor: spotlightGradients["arts-martiaux"],
    });
  }
  if (recentSports.length > 0 && recentCount > 0) {
    spotlight.push({
      key: "recent-sports",
      title: recentSports.map((s) => s.label).join(" & "),
      count: recentCount,
      href: `/${recentSports[0].key}`,
      image: image(recentProducts[1] || recentProducts[0]),
      gradientColor: spotlightGradients["recent-sports"],
    });
  }
  // Reels City Sport (accord client confirmé pour la vidéo, voir la
  // conversation) — aperçus boutique/produits, pas rattachés à un sport
  // précis : renvoient vers Sneakers, le rayon le plus proche du contenu.
  spotlight.push(
    {
      key: "reel-boutique-1",
      title: "Chez City Sport",
      href: "/sneakers",
      image: "https://res.cloudinary.com/ijazcmgk/image/upload/v1788538920/le-maillot-ideal/portal/spotlight/boutique-poster.jpg",
      video: "https://res.cloudinary.com/ijazcmgk/video/upload/v1788538834/le-maillot-ideal/portal/spotlight/boutique.mp4",
      gradientColor: spotlightGradients["reel-boutique-1"],
    },
    {
      key: "reel-boutique-2",
      title: "Nouveautés en boutique",
      href: "/sneakers",
      image: "https://res.cloudinary.com/ijazcmgk/image/upload/v1788548899/le-maillot-ideal/portal/spotlight/boutique-2-poster.jpg",
      video: "https://res.cloudinary.com/ijazcmgk/video/upload/v1788548884/le-maillot-ideal/portal/spotlight/boutique-2.mp4",
      gradientColor: spotlightGradients["reel-boutique-2"],
    },
    {
      key: "reel-boutique-3",
      title: "Zoom sur les tissus",
      href: "/sneakers",
      image: "https://res.cloudinary.com/ijazcmgk/image/upload/v1788548903/le-maillot-ideal/portal/spotlight/boutique-3-poster.jpg",
      video: "https://res.cloudinary.com/ijazcmgk/video/upload/v1788548896/le-maillot-ideal/portal/spotlight/boutique-3.mp4",
      gradientColor: spotlightGradients["reel-boutique-3"],
    }
  );

  // Même sport pour les deux photos : les mélanger (judo en photo principale,
  // sneaker en médaillon) ne se lisait pas comme de la diversité mais comme
  // une erreur — « pourquoi cette chaussure ? ». Football (le plus grand
  // catalogue) garantit toujours deux photos distinctes disponibles.
  const aboutMainImage = image(footballProducts[3] || combatProducts[1]);
  const aboutAccentImage = image(footballProducts[4] || combatProducts[0]);

  return (
    <>
      <PortalPreloader />
      <PortalHeader settings={settings} sports={sports} />

      <main id="main">
        <PortalHero slides={slides} />

        <SportMarquee sports={sports} products={products} />

        {spotlight.length > 0 && (
          <section className="section">
            <div className="container">
              <div className="section-head">
                <div>
                  <h2>À la une : trois univers, un seul système</h2>
                </div>
              </div>
            </div>
            <PortalSpotlight items={spotlight} />
          </section>
        )}

        <section className="section section-alt">
          <div className="container">
            <div className="about-grid">
              <div className="portal-about-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="main" src={aboutMainImage} alt="" loading="lazy" />
                {aboutAccentImage && (
                  <div className="accent">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={aboutAccentImage} alt="" loading="lazy" />
                  </div>
                )}
              </div>
              <div className="about-text">
                <h3>Qui sommes-nous : derrière chaque commande, une vraie personne</h3>
                <p>
                  {settings.businessName} est géré par Djimi, basé à Douala. Chaque commande passée sur WhatsApp est
                  suivie personnellement, de la confirmation jusqu&apos;à la livraison — quel que soit le sport.
                </p>
                <div className="about-badges">
                  <span>
                    <Icon name="location" size="sm" />
                    Basé au Cameroun
                  </span>
                  <span>
                    <Icon name="whatsapp" size="sm" />
                    Joignable directement sur WhatsApp
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="sports">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Nos univers : choisis ton ikigai</h2>
                <p>Chaque carte ouvre un site complet : boutique, fiches produit, panier et commande WhatsApp.</p>
              </div>
            </div>
            <SportGrid sports={sports} products={products} />
          </div>
        </section>

        <section className="services-strip">
          <div className="container">
            <div className="services-grid">
              <div className="service-item">
                <span className="ic">
                  <Icon name="whatsapp" size="lg" />
                </span>
                <div>
                  <p className="service-title">Commande WhatsApp</p>
                  <p>Rapide, simple, sans compte à créer</p>
                </div>
              </div>
              <div className="service-item">
                <span className="ic">
                  <Icon name="money" size="lg" />
                </span>
                <div>
                  <p className="service-title">Paiement à confirmer</p>
                  <p>Modalités convenues sur WhatsApp avant la commande</p>
                </div>
              </div>
              <div className="service-item">
                <span className="ic">
                  <Icon name="shipping" size="lg" />
                </span>
                <div>
                  <p className="service-title">Livraison à confirmer</p>
                  <p>Zone, délai et frais précisés avant la commande</p>
                </div>
              </div>
              <div className="service-item">
                <span className="ic">
                  <Icon name="check-circle" size="lg" />
                </span>
                <div>
                  <p className="service-title">Un site par sport</p>
                  <p>Une boutique dédiée, propre à chaque discipline</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {settings.showTestimonials && testimonials.length > 0 && (
          <section className="section section-alt">
            <div className="container">
              <div className="section-head">
                <div>
                  <span className="eyebrow">
                    <Icon name="star" size="sm" />
                    Témoignages
                  </span>
                  <h2>Retours de clients</h2>
                </div>
              </div>
              <AnimatedTestimonials testimonials={testimonials} />
            </div>
          </section>
        )}
      </main>

      <PortalFooter sports={sports} settings={settings} products={products} />
      <WhatsAppFloat settings={settings} />
      <BackToTop />
    </>
  );
}
