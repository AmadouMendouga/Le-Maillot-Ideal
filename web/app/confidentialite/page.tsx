import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { getSiteSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Confidentialité | IKIGAI Sport",
  description: "Informations sur les données utilisées par IKIGAI Sport pour les commandes, paiements et livraisons.",
};

export default async function ConfidentialitePage() {
  const settings = await getSiteSettings();

  return (
    <main id="main">
      <div className="page-hero">
        <div className="container">
          <h1>
            <Icon name="shield" size="xl" />
            Confidentialité
          </h1>
          <p>Comment vos informations sont utilisées pour traiter votre commande et votre livraison.</p>
        </div>
      </div>

      <section className="section">
        <div className="container" style={{ maxWidth: 860 }}>
          <article className="contact-card">
            <p className="form-note">Dernière mise à jour : 7 septembre 2026</p>

            <h2>Informations utilisées</h2>
            <p>
              Selon le service choisi, {settings.businessName} peut utiliser votre nom, votre adresse e-mail, votre
              numéro WhatsApp, le contenu de votre commande, votre adresse de livraison et son état d&apos;avancement.
            </p>
            <p>
              Pour un paiement Mobile Money, nous conservons uniquement les références et le statut nécessaires au
              suivi de la transaction. Ne communiquez jamais votre code secret Mobile Money sur le site ou par message.
            </p>

            <h2>Localisation pendant la livraison</h2>
            <p>
              Aucune position en direct n&apos;est demandée au moment de la commande. Le partage devient disponible
              uniquement lorsque le livreur démarre la course. Il reste facultatif, peut être arrêté à tout moment et
              son lien expire automatiquement. Les positions servent à afficher le trajet entre le client et le
              livreur ; leur suppression est programmée sept jours après la confirmation de la livraison.
            </p>

            <h2>Services techniques</h2>
            <p>
              Le site utilise notamment Firebase pour les comptes et les commandes, CamPay pour le paiement, Cloudinary
              pour les images, Vercel pour l&apos;hébergement et WhatsApp lorsque vous choisissez de nous écrire. Ces services
              traitent uniquement les informations nécessaires à leur fonction.
            </p>

            <h2>Données enregistrées sur votre appareil</h2>
            <p>
              Le panier et votre préférence de thème peuvent être mémorisés dans le navigateur afin de faciliter votre
              prochaine visite. Vous pouvez les effacer depuis les réglages de votre navigateur.
            </p>

            <h2>Vos demandes</h2>
            <p>
              Pour demander l&apos;accès, la correction ou la suppression de vos informations, écrivez à{" "}
              <a href={`mailto:${settings.email}`}>{settings.email}</a> ou contactez-nous sur WhatsApp au{" "}
              {settings.whatsappDisplay}.
            </p>

            <Link className="btn btn-primary" href="/" style={{ marginTop: 18 }}>
              <Icon name="arrow-back" size="sm" />
              Retour à l&apos;accueil
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}
