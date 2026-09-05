import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { getCourierDashboardAction } from "@/lib/actions/couriers";
import { getSiteSettings } from "@/lib/data/settings";
import { whatsappNumber, FCFA } from "@/lib/cart";

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

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
        <div className="container" style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 20 }}>
          {result.ok ? (
            <div className="contact-card">
              <h3>Mes gains &amp; performances</h3>
              <div style={{ display: "flex", gap: 12, margin: "14px 0" }}>
                <div style={{ flex: 1, textAlign: "center", padding: "14px 8px", background: "var(--surface-container-low)", borderRadius: "var(--r-item)" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{result.totalDelivered}</div>
                  <div className="sub">Livraison{result.totalDelivered > 1 ? "s" : ""} effectuée{result.totalDelivered > 1 ? "s" : ""}</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", padding: "14px 8px", background: "var(--surface-container-low)", borderRadius: "var(--r-item)" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{FCFA(result.totalEarned)}</div>
                  <div className="sub">Total gagné</div>
                </div>
              </div>
              {result.recentPayouts.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.recentPayouts.map((p, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: ".82rem" }}>
                      <span className="sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {formatDate(p.deliveredAt)} · {p.orderSummary}
                      </span>
                      <strong style={{ flexShrink: 0 }}>{p.amount > 0 ? FCFA(p.amount) : "—"}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="form-note">Vos livraisons effectuées apparaîtront ici.</p>
              )}
            </div>
          ) : null}

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
