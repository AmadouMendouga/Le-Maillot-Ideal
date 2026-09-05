import type { Metadata } from "next";
import { Icon } from "@/components/icons/Icon";
import { getOrderForLocationAction } from "@/lib/actions/orders";
import { getSiteSettings } from "@/lib/data/settings";
import { whatsappNumber } from "@/lib/cart";
import { LocationSharingForm } from "@/components/delivery/LocationSharingForm";

// Route publique hors du groupe (site) : pas de navbar ni de panier, même
// principe que /avis/[token] (CLAUDE.md §3).
export const metadata: Metadata = {
  title: "Partager ma position | IKIGAI Sport",
  robots: { index: false, follow: false },
};

export default async function LocationSharingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [result, settings] = await Promise.all([getOrderForLocationAction(token), getSiteSettings()]);

  // Lien invalide : rien à suivre, pas de carte à afficher — page classique
  // avec l'en-tête habituel. Lien valide : la carte occupe tout l'écran (voir
  // LocationSharingForm), donc ni page-hero ni container ici.
  if (!result.ok) {
    return (
      <main>
        <div className="page-hero">
          <div className="container">
            <h1>
              <Icon name="location" size="xl" />
              Partager ma position
            </h1>
            <p>IKIGAI Sport</p>
          </div>
        </div>
        <div className="section">
          <div className="container" style={{ maxWidth: 560 }}>
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
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <LocationSharingForm
        token={token}
        customerName={result.customerName}
        initialSharing={result.sharing}
        role={result.role}
        delivery={result.delivery}
        deliveryCode={result.deliveryCode}
      />
    </main>
  );
}
