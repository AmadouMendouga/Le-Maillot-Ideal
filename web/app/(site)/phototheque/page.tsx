import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { PhotoGallery } from "@/components/gallery/PhotoGallery";
import { AnimatedTestimonials } from "@/components/AnimatedTestimonials";
import { StatefulButton } from "@/components/StatefulButton";
import { getGallery } from "@/lib/data/gallery";
import { getTestimonials } from "@/lib/data/testimonials";
import { getSiteSettings } from "@/lib/data/settings";
import { whatsappNumber } from "@/lib/cart";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const metadata: Metadata = {
  title: "Photothèque | Le Maillot Idéal",
  description:
    "Photothèque du Maillot Idéal. Les photos et témoignages sont publiés après validation et autorisation des personnes concernées.",
  robots: { index: false, follow: true },
};

export default async function PhototequePage() {
  const [gallery, testimonials, settings] = await Promise.all([
    getGallery(),
    getTestimonials(),
    getSiteSettings(),
  ]);

  const showGallery = settings.showGallery && gallery.length > 0;
  const showTestimonials = settings.showTestimonials && testimonials.length > 0;
  const isEmpty = !showGallery && !showTestimonials;

  return (
    <main id="main">
      <div className="page-hero">
        <div className="container">
          <h1>
            <Icon name="photo-library" size="xl" />
            Photothèque
          </h1>
          <p>Les contenus sont publiés après validation des photos et autorisation des personnes concernées.</p>
        </div>
      </div>

      <div className="container">
        <nav className="breadcrumb" aria-label="Fil d'ariane">
          <Link href="/">Accueil</Link>
          <span className="sep">
            <Icon name="chevron-right" />
          </span>
          <span aria-current="page">Photothèque</span>
        </nav>
      </div>

      {isEmpty && (
        <section className="section">
          <div className="container">
            <div className="state-block">
              <div className="state-icon">
                <Icon name="photo-library" />
              </div>
              <h2>Photothèque en préparation</h2>
              <p>Aucune photo ni aucun témoignage client n&apos;est publié pour le moment.</p>
              <div className="state-ctas">
                <Link className="btn btn-primary" href="/boutique">
                  <Icon name="storefront" size="sm" />
                  Voir la boutique
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {showGallery && (
        <section className="section">
          <div className="container">
            <div className="demo-note">
              <Icon name="info" />
              <div>
                <strong>Photos de démonstration.</strong> Les images ci-dessous servent uniquement à visualiser la
                mise en page. Remplacez-les par vos propres photos (maillots portés, colis livrés, boutique) avant
                la mise en ligne.
              </div>
            </div>
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  <Icon name="image" size="sm" />
                  Galerie
                </span>
                <h2>En images</h2>
                <p>Cliquez sur une photo pour l&apos;agrandir.</p>
              </div>
            </div>
            <PhotoGallery items={gallery} />
          </div>
        </section>
      )}

      {showTestimonials && (
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
            <div style={{ textAlign: "center", marginTop: 36 }}>
              <StatefulButton
                className="btn btn-whatsapp btn-lg"
                href={`https://wa.me/${whatsappNumber(settings)}`}
                target="_blank"
                rel="noopener"
                onRun={() => wait(700)}
              >
                <Icon name="whatsapp" />
                Nous contacter sur WhatsApp
              </StatefulButton>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
