"use client";

import Link from "next/link";
import { useFavorites } from "@/hooks/useFavorites";
import { ProductCard } from "@/components/products/ProductCard";
import { HeartIcon } from "@/components/products/HeartIcon";
import type { Product, SiteSettings } from "@/lib/types";

export function Favorites({ products, settings, basePath }: { products: Product[]; settings: SiteSettings; basePath: string }) {
  const { slugs } = useFavorites();
  const favorites = products.filter((product) => slugs.includes(product.slug));
  return (
    <>
      <p className="ik-muted" role="status">{favorites.length} article{favorites.length !== 1 ? "s" : ""} dans votre sélection</p>
      {favorites.length ? (
        <div className="ik-favorites-list">
          {favorites.map((product) => <ProductCard key={product.slug} product={product} settings={settings} />)}
        </div>
      ) : (
        <div className="ik-empty-card">
          <HeartIcon />
          <h2>Gardez vos coups de cœur</h2>
          <p>Touchez le cœur d&apos;un article pour le retrouver ici.</p>
          <Link className="btn btn-primary" href={`${basePath}/boutique`}>Explorer la boutique</Link>
        </div>
      )}
      <p className="form-note">Vos favoris sont conservés sur cet appareil, tous univers confondus.</p>
    </>
  );
}
