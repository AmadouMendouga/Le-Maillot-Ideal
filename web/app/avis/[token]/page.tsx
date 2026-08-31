import type { Metadata } from "next";
import { Icon } from "@/components/icons/Icon";
import { getOrderForReviewAction } from "@/lib/actions/orders";
import { getSiteSettings } from "@/lib/data/settings";
import { whatsappNumber } from "@/lib/cart";
import { ReviewSubmissionForm } from "@/components/reviews/ReviewSubmissionForm";

// Route publique hors du groupe (site) : pas de navbar ni de panier, exactement
// comme merci.html/product.html sur l'ancien site statique (CLAUDE.md §3).
export const metadata: Metadata = {
  title: "Votre avis | Le Maillot Idéal",
  robots: { index: false, follow: false },
};

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [result, settings] = await Promise.all([getOrderForReviewAction(token), getSiteSettings()]);

  return (
    <main>
      <div className="page-hero">
        <div className="container">
          <h1>
            <Icon name="star" size="xl" />
            Votre avis compte
          </h1>
          <p>Le Maillot Idéal</p>
        </div>
      </div>
      <div className="section">
        <div className="container" style={{ maxWidth: 560 }}>
          {result.ok ? (
            <ReviewSubmissionForm token={token} customerName={result.customerName} />
          ) : (
            <div className="contact-card">
              <h3>Lien indisponible</h3>
              <p>{result.error}</p>
              <p className="form-note">Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez-nous directement.</p>
              <a
                className="btn btn-whatsapp btn-lg btn-block"
                href={`https://wa.me/${whatsappNumber(settings)}`}
                target="_blank"
                rel="noopener"
              >
                <Icon name="whatsapp" size="sm" />
                Nous écrire sur WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
