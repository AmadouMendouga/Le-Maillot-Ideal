import type { Metadata } from "next";
import { Icon } from "@/components/icons/Icon";
import { getSiteSettings } from "@/lib/data/settings";
import { CourierRegisterForm } from "@/components/delivery/CourierRegisterForm";

// Route publique hors du groupe (site) : pas de navbar ni de panier, même
// principe que /avis/[token] et /livraison/[token] (CLAUDE.md §3). Lien
// partagé directement par l'admin à qui livre régulièrement — pas de compte
// à créer côté admin, la personne s'enregistre elle-même ici.
export const metadata: Metadata = {
  title: "Devenir livreur | IKIGAI Sport",
  robots: { index: false, follow: false },
};

export default async function CourierRegisterPage() {
  const settings = await getSiteSettings();

  return (
    <main>
      <div className="page-hero">
        <div className="container">
          <h1>
            <Icon name="shipping" size="xl" />
            Devenir livreur
          </h1>
          <p>{settings.businessName}</p>
        </div>
      </div>
      <div className="section">
        <div className="container" style={{ maxWidth: 560 }}>
          <CourierRegisterForm siteUrl={settings.siteUrl} />
        </div>
      </div>
    </main>
  );
}
