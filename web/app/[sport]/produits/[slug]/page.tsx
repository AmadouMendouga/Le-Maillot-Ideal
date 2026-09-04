import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllProducts, getProductBySlug } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";
import { Icon } from "@/components/icons/Icon";
import { ProductDetail } from "@/components/products/ProductDetail";
import { ProductCard } from "@/components/products/ProductCard";
import { publicProductDescription, absUrl } from "@/lib/product";
import { stockInfo } from "@/lib/cart";

export const revalidate = 3600;

export async function generateStaticParams({ params }: { params: { sport: string } }) {
  const products = await getAllProducts();
  return products.filter((p) => p.sport === params.sport).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[sport]/produits/[slug]">): Promise<Metadata> {
  const { sport: sportKey, slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getSiteSettings()]);
  if (!product || product.sport !== sportKey) return { title: "Produit introuvable | IKIGAI Sport" };

  const description = publicProductDescription(product, settings);
  const url = absUrl(settings.siteUrl, `/${sportKey}/produits/${product.slug}`);
  const title = `${product.name} | IKIGAI Sport`;

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

export default async function ProductPage({ params }: PageProps<"/[sport]/produits/[slug]">) {
  const { sport: sportKey, slug } = await params;
  const [product, allProducts, settings] = await Promise.all([
    getProductBySlug(slug),
    getAllProducts(),
    getSiteSettings(),
  ]);
  // Un judogi ne doit pas être accessible sous /football/produits/... —
  // le sport du produit doit correspondre au site-sport visité.
  if (!product || product.sport !== sportKey) notFound();

  const url = absUrl(settings.siteUrl, `/${sportKey}/produits/${product.slug}`);
  const st = stockInfo(product, settings.catalogDataVerified);
  const boutiqueHref = `/${sportKey}/boutique`;

  // 3e maillon du fil d'ariane : le championnat si le produit en a un
  // (football aujourd'hui), sinon directement le sport.
  const categoryCrumb = product.league
    ? { name: product.leagueLabel!, href: `${boutiqueHref}?league=${product.league}` }
    : { name: product.sportLabel, href: boutiqueHref };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: settings.siteUrl },
      { "@type": "ListItem", position: 2, name: "Boutique", item: absUrl(settings.siteUrl, boutiqueHref) },
      {
        "@type": "ListItem",
        position: 3,
        name: categoryCrumb.name,
        item: absUrl(settings.siteUrl, categoryCrumb.href),
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

  // Priorité au même championnat s'il y en a un (ex. deux maillots de Ligue
  // 1) ; sinon repli sur le même sport (ex. deux judogi) — jamais de mélange
  // entre sports différents dans "produits similaires".
  const relatedByLeague = product.league
    ? allProducts.filter((p) => p.league === product.league && p.slug !== product.slug)
    : [];
  const related = (
    relatedByLeague.length > 0
      ? relatedByLeague
      : allProducts.filter((p) => p.sport === product.sport && p.slug !== product.slug)
  ).slice(0, 4);
  const relatedEyebrow = relatedByLeague.length > 0 ? "Dans le même championnat" : "Dans le même sport";

  return (
    <main id="main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {productLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      )}

      <div className="container">
        <nav className="breadcrumb" aria-label="Fil d'ariane">
          <Link href={`/${sportKey}`}>Accueil</Link>
          <span className="sep">
            <Icon name="chevron-right" />
          </span>
          <Link href={boutiqueHref}>Boutique</Link>
          <span className="sep">
            <Icon name="chevron-right" />
          </span>
          <Link href={categoryCrumb.href}>{categoryCrumb.name}</Link>
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
                  {relatedEyebrow}
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
