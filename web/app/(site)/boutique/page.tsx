import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { Shop } from "@/components/shop/Shop";
import { getAllLeagues } from "@/lib/data/leagues";
import { getAllProducts } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Boutique — Tous les maillots de foot | Le Maillot Idéal",
  description:
    "Parcourez les maillots de football présentés au catalogue : Ligue 1, Premier League, Liga, Serie A, Bundesliga et équipes nationales.",
};

export default async function BoutiquePage() {
  const [products, leagues, settings] = await Promise.all([
    getAllProducts(),
    getAllLeagues(),
    getSiteSettings(),
  ]);

  return (
    <main id="main">
      <div className="page-hero">
        <div className="container">
          <h1>
            <Icon name="storefront" size="xl" />
            Boutique
          </h1>
          <p>Tous nos maillots, tous les championnats, en un seul endroit.</p>
        </div>
      </div>

      <div className="container">
        <nav className="breadcrumb" aria-label="Fil d'ariane">
          <Link href="/">Accueil</Link>
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
