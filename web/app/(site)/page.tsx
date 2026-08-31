import Link from "next/link";
import { getAllProducts } from "@/lib/data/products";
import { getAllLeagues } from "@/lib/data/leagues";
import { getSiteSettings } from "@/lib/data/settings";
import { getTestimonials } from "@/lib/data/testimonials";
import { Icon } from "@/components/icons/Icon";
import { LeagueMarquee } from "@/components/home/LeagueMarquee";
import { LeagueGrid } from "@/components/home/LeagueGrid";
import { ContainerTextFlip } from "@/components/ContainerTextFlip";
import { AnimatedTestimonials } from "@/components/AnimatedTestimonials";
import { FaqAccordion, type FaqItem } from "@/components/home/FaqAccordion";
import { ContactForm } from "@/components/home/ContactForm";
import { ProductCard } from "@/components/products/ProductCard";
import { whatsappNumber } from "@/lib/cart";

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Comment passer une commande ?",
    answer:
      "Choisissez votre maillot dans la boutique, ajoutez-le au panier (ou plusieurs), puis cliquez sur « Commander sur WhatsApp ». Le message est déjà rédigé avec votre sélection, il ne reste qu'à l'envoyer.",
  },
  {
    question: "Quels moyens de paiement acceptez-vous ?",
    answer:
      "Le site n'encaisse aucun paiement en ligne. Le moyen et le moment du paiement sont confirmés avec vous sur WhatsApp avant la commande.",
  },
  {
    question: "Livrez-vous en dehors de Douala et Yaoundé ?",
    answer: "La zone desservie, le délai et les frais éventuels sont confirmés sur WhatsApp avant la commande.",
  },
  {
    question: "Comment choisir la bonne taille ?",
    answer:
      "Les coupes peuvent varier. Indiquez votre taille habituelle ou vos mesures sur WhatsApp afin de confirmer la taille avant la commande.",
  },
  {
    question: "Puis-je échanger un maillot après réception ?",
    answer: "Les conditions de retour ou d'échange sont communiquées et confirmées sur WhatsApp avant la commande.",
  },
];

export default async function HomePage() {
  const [products, leagues, settings, testimonials] = await Promise.all([
    getAllProducts(),
    getAllLeagues(),
    getSiteSettings(),
    getTestimonials(),
  ]);

  const teamWords = [...new Set(products.map((p) => p.team))].slice(0, 10);
  const highlights = (settings.catalogDataVerified ? products.filter((p) => p.isNew) : products).slice(0, 8);
  const waNumber = whatsappNumber(settings);

  return (
    <main id="main">
      <section className="hero">
        <div className="container hero-text-only">
          <div>
            <span className="hero-badge">
              <Icon name="storefront" size="sm" /> {settings.heroBadge}
            </span>
            <h1>
              <span>{settings.heroTitle1}</span>
              <br />
              <span>{settings.heroTitle2}</span>
            </h1>
            <p className="lead">{settings.heroLead}</p>
            {teamWords.length > 0 && (
              <p className="hero-flip-line">
                <Icon name="bolt" size="sm" />
                Au catalogue en ce moment : <ContainerTextFlip words={teamWords} />
              </p>
            )}
            <div className="hero-ctas">
              <Link className="btn btn-primary btn-lg" href="/boutique">
                <Icon name="storefront" />
                Voir la boutique
              </Link>
              <a className="btn btn-outline btn-lg" href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener">
                <Icon name="whatsapp" />
                Commander sur WhatsApp
              </a>
            </div>
            <div className="hero-stats">
              <div>
                <strong>{products.length}</strong>
                <span>Maillots au catalogue</span>
              </div>
              <div>
                <strong>{settings.statDelay}</strong>
                <span>{settings.statDelayLabel}</span>
              </div>
              <div>
                <strong>{settings.statRating}</strong>
                <span>{settings.statRatingLabel}</span>
              </div>
              <div>
                <strong>WhatsApp</strong>
                <span>Commande directe</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LeagueMarquee leagues={leagues} products={products} />

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
                <h4>Choix de tailles</h4>
                <p>Consultez chaque fiche pour les tailles disponibles</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="championnats">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">
                <Icon name="inventory" size="sm" />
                Catalogue
              </span>
              <h2>Choisissez votre championnat</h2>
              <p>
                {products.length} maillots présentés au catalogue, répartis sur {leagues.length} grands championnats
                et sélections nationales.
              </p>
            </div>
            <Link className="btn btn-tonal" href="/boutique">
              Toute la boutique <Icon name="arrow-forward" size="sm" />
            </Link>
          </div>
          <LeagueGrid leagues={leagues} products={products} />
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          {!settings.catalogDataVerified && (
            <div className="catalog-note" role="note">
              <Icon name="info" />
              <div>
                <strong>Catalogue en cours de vérification.</strong> Les prix et disponibilités affichés sont
                indicatifs et doivent être confirmés sur WhatsApp.
              </div>
            </div>
          )}
          <div className="section-head">
            <div>
              <span className="eyebrow">
                <Icon name="bolt" size="sm" />
                Sélection du catalogue
              </span>
              <h2>Maillots au catalogue</h2>
              <p>Une sélection à faire confirmer sur WhatsApp avant toute commande.</p>
            </div>
            <Link className="btn btn-tonal" href="/boutique">
              Voir tout <Icon name="arrow-forward" size="sm" />
            </Link>
          </div>
          <div className="product-grid">
            {highlights.map((p) => (
              <ProductCard key={p.slug} product={p} settings={settings} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">
                <Icon name="shipping" size="sm" />
                Livraison &amp; paiement
              </span>
              <h2>Où livrons-nous, et comment payer ?</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table className="delivery-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Délai</th>
                  <th>Frais de livraison</th>
                  <th>Paiement</th>
                </tr>
              </thead>
              <tbody>
                {settings.deliveryRows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.zone}</td>
                    <td>{row.delay}</td>
                    <td>{row.cost}</td>
                    <td>{row.payment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="form-note">
            La destination, le délai, les frais et le moyen de paiement sont confirmés avec vous sur WhatsApp avant
            toute commande.
          </p>
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
              <Link className="btn btn-tonal" href="/phototheque">
                Voir la photothèque <Icon name="arrow-forward" size="sm" />
              </Link>
            </div>
            <AnimatedTestimonials testimonials={testimonials} />
          </div>
        </section>
      )}

      <section className="section section-alt" id="about">
        <div className="container">
          <div className="about-grid">
            <div className="about-photo">
              <Icon name="person" />
              <span>Photo à venir</span>
            </div>
            <div className="about-text">
              <span className="eyebrow">
                <Icon name="verified" size="sm" />
                Qui sommes-nous
              </span>
              <h3>Derrière chaque commande, une vraie personne</h3>
              <p>
                {settings.businessName} est géré par Djimi, basé à Douala. Chaque commande passée sur WhatsApp est
                suivie personnellement, de la confirmation jusqu&apos;à la livraison.
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

      <section className="section" id="faq">
        <div className="container">
          <div
            className="section-head"
            style={{ justifyContent: "center", textAlign: "center", flexDirection: "column", alignItems: "center" }}
          >
            <span className="eyebrow">
              <Icon name="info" size="sm" />
              Questions fréquentes
            </span>
            <h2>Vous vous posez une question ?</h2>
          </div>
          <FaqAccordion items={FAQ_ITEMS} />
        </div>
      </section>

      <section className="section section-alt" id="contact">
        <div className="container">
          <div className="section-head" style={{ flexDirection: "column", alignItems: "flex-start" }}>
            <span className="eyebrow">
              <Icon name="person" size="sm" />
              Contact
            </span>
            <h2>Une question avant de commander ?</h2>
          </div>
          <div className="contact-grid">
            <div className="contact-card">
              <h3>Nos coordonnées</h3>
              <ul className="contact-list">
                <li>
                  <span className="ic">
                    <Icon name="whatsapp" />
                  </span>
                  <div>
                    <strong>WhatsApp</strong>
                    <br />
                    <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener">
                      {settings.whatsappDisplay}
                    </a>
                  </div>
                </li>
                <li>
                  <span className="ic">
                    <Icon name="mail" />
                  </span>
                  <div>
                    <strong>E-mail</strong>
                    <br />
                    <a href={`mailto:${settings.email}`}>{settings.email}</a>
                  </div>
                </li>
                <li>
                  <span className="ic">
                    <Icon name="location" />
                  </span>
                  <div>
                    <strong>Zone de retrait</strong>
                    <br />
                    <span>{settings.address}</span>
                  </div>
                </li>
                <li>
                  <span className="ic">
                    <Icon name="schedule" />
                  </span>
                  <div>
                    <strong>Horaires</strong>
                    <br />
                    <span>{settings.hours}</span>
                  </div>
                </li>
                <li>
                  <span className="ic">
                    <Icon name="hourglass" />
                  </span>
                  <div>
                    <strong>Délai de réponse</strong>
                    <br />
                    <span>{settings.responseTime}</span>
                  </div>
                </li>
              </ul>
              {(settings.instagram || settings.facebook || settings.tiktok) && (
                <div className="social-row" aria-label="Réseaux sociaux">
                  {settings.instagram && (
                    <a href={settings.instagram} aria-label="Instagram" target="_blank" rel="noopener">
                      <Icon name="image" />
                    </a>
                  )}
                  {settings.facebook && (
                    <a href={settings.facebook} aria-label="Facebook" target="_blank" rel="noopener">
                      <Icon name="language" />
                    </a>
                  )}
                  {settings.tiktok && (
                    <a href={settings.tiktok} aria-label="TikTok" target="_blank" rel="noopener">
                      <Icon name="language" />
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="contact-card">
              <h3>Écrivez-nous</h3>
              <ContactForm settings={settings} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
