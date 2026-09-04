import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllProducts } from "@/lib/data/products";
import { getAllLeagues } from "@/lib/data/leagues";
import { getSportByKey } from "@/lib/data/sports";
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
      "Choisissez votre article dans la boutique, ajoutez-le au panier (ou plusieurs), puis cliquez sur « Commander sur WhatsApp ». Le message est déjà rédigé avec votre sélection, il ne reste qu'à l'envoyer.",
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
    question: "Puis-je échanger un article après réception ?",
    answer: "Les conditions de retour ou d'échange sont communiquées et confirmées sur WhatsApp avant la commande.",
  },
];

export default async function SportHomePage({ params }: PageProps<"/[sport]">) {
  const { sport: sportKey } = await params;
  const [sport, allProducts, allLeagues, settings, testimonials] = await Promise.all([
    getSportByKey(sportKey),
    getAllProducts(),
    getAllLeagues(),
    getSiteSettings(),
    getTestimonials(),
  ]);
  if (!sport) notFound();

  const products = allProducts.filter((p) => p.sport === sportKey);
  const leagues = allLeagues.filter((l) => l.sport === sportKey);

  const teamWords = [...new Set(products.map((p) => p.team))].slice(0, 10);
  const highlights = (settings.catalogDataVerified ? products.filter((p) => p.isNew) : products).slice(0, 8);
  const waNumber = whatsappNumber(settings);

  return (
    <main id="main">
      <section className="hero">
        <div className="container hero-text-only">
          <div>
            <span className="hero-badge">
              <Icon name="storefront" size="sm" /> {sport.heroBadge}
            </span>
            <h1>
              <span>{sport.heroTitle1}</span>
              <br />
              <span>{sport.heroTitle2}</span>
            </h1>
            <p className="lead">{sport.heroLead}</p>
            {teamWords.length > 0 && (
              <p className="hero-flip-line">
                <Icon name="bolt" size="sm" />
                Au catalogue en ce moment : <ContainerTextFlip words={teamWords} />
              </p>
            )}
            <div className="hero-ctas">
              <Link className="btn btn-primary btn-lg" href={`/${sportKey}/boutique`}>
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
                <span>Articles au catalogue</span>
              </div>
              <div>
                <strong>{sport.statDelay}</strong>
                <span>{sport.statDelayLabel}</span>
              </div>
              <div>
                <strong>{sport.statRating}</strong>
                <span>{sport.statRatingLabel}</span>
              </div>
              <div>
                <strong>WhatsApp</strong>
                <span>Commande directe</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {leagues.length > 0 && <LeagueMarquee leagues={leagues} products={products} />}

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
                <p className="service-title">Choix de tailles</p>
                <p>Consultez chaque fiche pour les tailles disponibles</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {leagues.length > 0 && (
        <section className="section" id="championnats">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Catalogue : choisissez votre championnat</h2>
                <p>
                  {products.length} produit{products.length > 1 ? "s" : ""} présenté{products.length > 1 ? "s" : ""}{" "}
                  au catalogue, réparti{products.length > 1 ? "s" : ""} sur {leagues.length} championnat
                  {leagues.length > 1 ? "s" : ""}.
                </p>
              </div>
              <Link className="btn btn-tonal" href={`/${sportKey}/boutique`}>
                Toute la boutique <Icon name="arrow-forward" size="sm" />
              </Link>
            </div>
            <LeagueGrid leagues={leagues} products={products} basePath={`/${sportKey}`} />
          </div>
        </section>
      )}

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
              <h2>Sélection du catalogue</h2>
              <p>Une sélection à faire confirmer sur WhatsApp avant toute commande.</p>
            </div>
            <Link className="btn btn-tonal" href={`/${sportKey}/boutique`}>
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
              <h2>Livraison &amp; paiement : où livrons-nous, et comment payer ?</h2>
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
              <Link className="btn btn-tonal" href={`/${sportKey}/phototheque`}>
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
              <h3>Qui sommes-nous : derrière chaque commande, une vraie personne</h3>
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
            <h2>Questions fréquentes</h2>
          </div>
          <FaqAccordion items={FAQ_ITEMS} />
        </div>
      </section>

      <section className="section section-alt" id="contact">
        <div className="container">
          <div className="section-head" style={{ flexDirection: "column", alignItems: "flex-start" }}>
            <h2>Contact : une question avant de commander ?</h2>
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
