import type { Metadata } from "next";
import { getAllProducts } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";
import { Favorites } from "@/components/products/Favorites";

export const metadata: Metadata = { title: "Mes favoris | IKIGAI Sport" };

export default async function FavoritesPage({ params }: { params: Promise<{ sport: string }> }) {
  const [{ sport }, products, settings] = await Promise.all([params, getAllProducts(), getSiteSettings()]);
  return (
    <main id="main" className="ik-favorites-page container">
      <div className="ik-page-heading"><p className="eyebrow">Votre sélection</p><h1>Mes favoris</h1></div>
      <Favorites products={products} settings={settings} basePath={`/${sport}`} />
    </main>
  );
}
