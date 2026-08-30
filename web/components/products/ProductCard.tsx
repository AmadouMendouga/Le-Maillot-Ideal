"use client";

// Carte produit — porté depuis js/main.js#productCardHTML. Le clic sur
// "Ajouter" fait voler une copie de l'image vers la barre panier
// (lib/flyToCart.ts), fait "sauter" la carte, et bascule brièvement le
// bouton en "Ajouté" — trois effets distincts, comme dans animateAdd().
import { useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { RatingStars } from "@/components/products/RatingStars";
import { useDirectionAwareHover } from "@/hooks/useDirectionAwareHover";
import { useCart } from "@/components/cart/CartContext";
import { showToast } from "@/components/Toast";
import { flyToCart } from "@/lib/flyToCart";
import { FCFA, stockInfo } from "@/lib/cart";
import type { Product, SiteSettings } from "@/lib/types";

const ADDED_LABEL_DURATION = 1600;
const CARD_POP_DURATION = 600;

export function ProductCard({ product, settings }: { product: Product; settings: SiteSettings }) {
  const { addToCart, barRef } = useCart();
  const dah = useDirectionAwareHover<HTMLAnchorElement>();
  const cardRef = useRef<HTMLElement>(null);
  const [added, setAdded] = useState(false);

  const verified = settings.catalogDataVerified;
  const st = stockInfo(product, verified);
  const href = `/produits/${product.slug}`;

  function handleQuickAdd() {
    const sizes = product.sizes.map(String);
    const defaultSize = sizes.includes("M") ? "M" : sizes[0] || "";
    const result = addToCart(product.slug, defaultSize, 1);
    if (!result.ok) {
      showToast(result.message || "Erreur", "error", true);
      return;
    }

    const card = cardRef.current;
    if (card) {
      card.classList.remove("pop");
      void card.offsetWidth;
      card.classList.add("pop");
      setTimeout(() => card.classList.remove("pop"), CARD_POP_DURATION);
    }

    const media = dah.ref.current;
    const flew = media ? flyToCart(media, barRef.current) : false;
    if (!flew) showToast(`${product.name} ajouté au panier`, "check-circle");

    setAdded(true);
    setTimeout(() => setAdded(false), ADDED_LABEL_DURATION);
  }

  return (
    <article className="product-card" ref={cardRef} data-slug={product.slug}>
      <Link className="product-media dah" href={href} aria-label={`Voir ${product.name}`} {...dah}>
        <div className="product-badges">
          {verified && product.isNew && (
            <span className="badge badge-new">
              <Icon name="bolt" size="sm" />
              Nouveau
            </span>
          )}
          {verified && product.discountPct > 0 && (
            <span className="badge badge-promo">
              <Icon name="percent" size="sm" />-{Math.round(product.discountPct)}%
            </span>
          )}
          {!st.available && (
            <span className="badge badge-stock-out">
              <Icon name="error" size="sm" />
              Rupture
            </span>
          )}
        </div>
        <div className="dah-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.images.square}
            alt={`${product.name}, saison ${product.season}`}
            loading="lazy"
            width={300}
            height={300}
          />
        </div>
        <div className="dah-overlay" />
        <div className="dah-caption">
          <p className="t">{product.team}</p>
          <p className="s">
            {product.kit} · {product.season}
            <Icon name="arrow-forward" />
          </p>
        </div>
      </Link>

      <div className="product-body">
        <span className="product-league">
          {product.leagueLabel} · {product.kit}
        </span>
        <h3 className="product-title">
          <Link href={href}>{product.name}</Link>
        </h3>
        <RatingStars rating={product.rating ?? 0} reviews={product.reviews} />
        {!verified && <p className="form-note">Prix/stock indicatifs, à confirmer sur WhatsApp.</p>}
        <div className="product-foot">
          <div className="price-row">
            <span className="price-now">{FCFA(product.price)}</span>
            {verified && product.discountPct > 0 && <span className="price-old">{FCFA(product.priceOriginal)}</span>}
          </div>
          <button
            type="button"
            className={"add-btn quick-add" + (added ? " added" : "")}
            disabled={!st.available}
            aria-label={st.available ? `Ajouter ${product.name} au panier` : `${product.name} indisponible`}
            onClick={handleQuickAdd}
          >
            <Icon name={added ? "check-circle" : "add"} />
            {added ? "Ajouté" : st.available ? "Ajouter" : "Épuisé"}
          </button>
        </div>
      </div>
    </article>
  );
}
