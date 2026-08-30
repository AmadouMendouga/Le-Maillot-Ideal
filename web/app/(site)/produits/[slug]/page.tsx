import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllProductSlugs, getAllProducts, getProductBySlug } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";
import { Icon } from "@/components/icons/Icon";
import { ProductDetail } from "@/components/products/ProductDetail";
import { ProductCard } from "@/components/products/ProductCard";
import { publicProductDescription, absUrl } from "@/lib/product";
import { stockInfo } from "@/lib/cart";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getSiteSettings()]);
  if (!product) return { title: "Produit introuvable | Le Maillot Idéal" };

  const description = publicProductDescription(product, settings);
  const url = absUrl(settings.siteUrl, `/produits/${product.slug}`);
  const title = `${product.name} | Le Maillot Idéal`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      images: [product.images.square],
      locale: "fr_FR",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, allProducts, settings] = await Promise.all([
    getProductBySlug(slug),
    getAllProducts(),
    getSiteSettings(),
  ]);
  if (!product) notFound();

  const url = absUrl(settings.siteUrl, `/produits/${product.slug}`);
  const st = stockInfo(product, settings.catalogDataVerified);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: settings.siteUrl },
      { "@type": "ListItem", position: 2, name: "Boutique", item: absUrl(settings.siteUrl, "/boutique") },
      {
        "@type": "ListItem",
        position: 3,
        name: product.leagueLabel,
        item: absUrl(settings.siteUrl, `/boutique?league=${product.league}`),
      },
      { "@type": "ListItem", position: 4, name: product.name, item: url },
    ],
  };
  const productLd = settings.catalogDataVerified
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        image: [product.images.square],
        description: publicProductDescription(product, settings),
        sku: product.slug,
        offers: {
          "@type": "Offer",
          url,
          priceCurrency: "XAF",
          price: product.price,
          availability: `https://schema.org/${st.available ? "InStock" : "OutOfStock"}`,
        },
      }
    : null;

  const related = allProducts.filter((p) => p.league === product.league && p.slug !== product.slug).slice(0, 4);

  return (
    <main id="main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {productLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      )}

      <div className="container">
        <nav className="breadcrumb" aria-label="Fil d'ariane">
          <Link href="/">Accueil</Link>
          <span className="sep">
            <Icon name="chevron-right" />
          </span>
          <Link href="/boutique">Boutique</Link>
          <span className="sep">
            <Icon name="chevron-right" />
          </span>
          <Link href={`/boutique?league=${product.league}`}>{product.leagueLabel}</Link>
          <span className="sep">
            <Icon name="chevron-right" />
          </span>
          <span aria-current="page">{product.name}</span>
        </nav>
      </div>

      <section className="section">
        <div className="container">
          <ProductDetail product={product} settings={settings} />
        </div>
      </section>

      {related.length > 0 && (
        <section className="section section-alt">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  <Icon name="grid" size="sm" />
                  Dans le même championnat
                </span>
                <h2>Produits similaires</h2>
              </div>
            </div>
            <div className="product-grid">
              {related.map((p) => (
                <ProductCard key={p.slug} product={p} settings={settings} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
