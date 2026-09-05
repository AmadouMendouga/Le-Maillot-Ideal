import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { getCourierDashboardAction } from "@/lib/actions/couriers";
import { getSiteSettings } from "@/lib/data/settings";
import { whatsappNumber } from "@/lib/cart";

// Lien personnel permanent d'un livreur enregistré (voir /livreur/inscription
// et lib/actions/couriers.ts) — pas de page dédiée à afficher : s'il a une
// livraison assignée, on renvoie directement vers /livraison/[token], la
// page de suivi déjà construite (aucune UI dupliquée).
export const metadata: Metadata = {
  title: "Mes livraisons | IKIGAI Sport",
  robots: { index: false, follow: false },
};

export default async function CourierDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [result, settings] = await Promise.all([getCourierDashboardAction(token), getSiteSettings()]);

  if (result.ok && result.activeDeliveryToken) {
    redirect(`/livraison/${result.activeDeliveryToken}`);
  }

  return (
    <main>
      <div className="page-hero">
        <div className="container">
          <h1>
            <Icon name="shipping" size="xl" />
            {result.ok ? `Bonjour ${result.name}` : "Mes livraisons"}
          </h1>
          <p>{settings.businessName}</p>
        </div>
      </div>
      <div className="section">
        <div className="container" style={{ maxWidth: 560 }}>
          <div className="contact-card">
            {result.ok ? (
              <>
                <h3>Aucune livraison assignée pour le moment</h3>
                <p>
                  Dès qu&apos;une commande vous sera confiée, elle apparaîtra automatiquement ici — revenez sur ce
                  même lien pour la suivre.
                </p>
              </>
            ) : (
              <>
                <h3>Lien indisponible</h3>
                <p>{result.error}</p>
              </>
            )}
            <p className="form-note">Une question ? Contactez-nous directement.</p>
            <a className="btn btn-whatsapp btn-lg btn-block" href={`https://wa.me/${whatsappNumber(settings)}`} target="_blank" rel="noopener">
              <Icon name="whatsapp" size="sm" />
              Nous écrire sur WhatsApp
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
