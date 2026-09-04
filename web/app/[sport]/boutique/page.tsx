import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { Shop } from "@/components/shop/Shop";
import { getAllLeagues } from "@/lib/data/leagues";
import { getSportByKey } from "@/lib/data/sports";
import { getAllProducts } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";

export async function generateMetadata({ params }: PageProps<"/[sport]/boutique">): Promise<Metadata> {
  const { sport: sportKey } = await params;
  const sport = await getSportByKey(sportKey);
  if (!sport) return { title: "Boutique introuvable | IKIGAI Sport" };
  return {
    title: `Boutique ${sport.label} | IKIGAI Sport`,
    description: `Parcourez le catalogue ${sport.label} : tous les articles disponibles, filtrables par championnat et disponibilité.`,
  };
}

export default async function BoutiquePage({ params }: PageProps<"/[sport]/boutique">) {
  const { sport: sportKey } = await params;
  const [sport, allProducts, allLeagues, settings] = await Promise.all([
    getSportByKey(sportKey),
    getAllProducts(),
    getAllLeagues(),
    getSiteSettings(),
  ]);
  if (!sport) notFound();

  const products = allProducts.filter((p) => p.sport === sportKey);
  const leagues = allLeagues.filter((l) => l.sport === sportKey);

  return (
    <main id="main">
      <div className="page-hero">
        <div className="container">
          <h1>
            <Icon name="storefront" size="xl" />
            Boutique {sport.label}
          </h1>
          <p>Tous nos produits {sport.label}, en un seul endroit.</p>
        </div>
      </div>

      <div className="container">
        <nav className="breadcrumb" aria-label="Fil d'ariane">
          <Link href={`/${sportKey}`}>Accueil</Link>
          <span className="sep">
            <Icon name="chevron-right" />
          </span>
          <span aria-current="page">Boutique</span>
        </nav>
      </div>

      <section className="section">
        <div className="container">
          <Shop products={products} leagues={leagues} settings={settings} />
        </div>
      </section>
    </main>
  );
}
