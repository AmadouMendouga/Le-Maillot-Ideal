"use client";

// Fiche produit — porté depuis js/main.js#initProductPage. Taille/quantité
// pilotent en direct le lien WhatsApp (identique au caractère près au format
// du panier — buildWhatsappCartLink est réutilisé avec un panier synthétique
// à un seul article).
import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons/Icon";
import { Lens } from "@/components/Lens";
import { RatingStars } from "@/components/products/RatingStars";
import { StatefulButton } from "@/components/StatefulButton";
import { AddToCartIcon, runAddToCartIcon } from "@/components/cart/AddToCartIcon";
import { useCart } from "@/components/cart/CartContext";
import { showToast } from "@/components/Toast";
import { flyToCart } from "@/lib/flyToCart";
import { FCFA, buildWhatsappCartLink, productStock, stockInfo } from "@/lib/cart";
import { publicProductDescription } from "@/lib/product";
import type { Product, SiteSettings } from "@/lib/types";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const ADDED_LABEL_DURATION = 1600;

export function ProductDetail({ product, settings }: { product: Product; settings: SiteSettings }) {
  const { addToCart, barRef } = useCart();
  const mediaRef = useRef<HTMLDivElement>(null);
  const sizes = useMemo(() => [...new Set(product.sizes.map((s) => String(s).trim()).filter(Boolean))], [product.sizes]);
  const [selectedSize, setSelectedSize] = useState(() => (sizes.includes("M") ? "M" : sizes[0] || ""));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const addedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Photo principale + photos supplémentaires du même maillot (facultatives,
  // absentes sur la plupart des produits) : on clique une vignette, Lens zoome
  // sur celle-ci exactement comme sur la photo principale.
  const photos = useMemo(
    () => [...new Set([product.images.square, ...(product.images.gallery ?? [])])],
    [product.images.square, product.images.gallery]
  );
  const [activePhoto, setActivePhoto] = useState(photos[0]);
  const [showingReel, setShowingReel] = useState(false);

  const verified = settings.catalogDataVerified;
  const st = stockInfo(product, verified);
  const canOrder = st.available && !!selectedSize;
  const max = productStock(product, verified);
  const descriptionText = publicProductDescription(product, settings);

  const whatsappLink = useMemo(
    () => buildWhatsappCartLink([{ slug: product.slug, size: selectedSize, qty }], [product], settings),
    [product, selectedSize, qty, settings]
  );

  const deliveryPolicy = settings.commercialTermsVerified
    ? "Les délais, frais et moyens de paiement applicables dépendent de la zone indiquée dans la rubrique Livraison. Ils sont repris avec vous sur WhatsApp avant validation."
    : "Les modalités, délais, frais de livraison et moyens de paiement sont confirmés avec vous sur WhatsApp avant toute commande.";
  const returnsPolicy = settings.commercialTermsVerified
    ? "Les conditions de retour ou d'échange validées avec le vendeur sont rappelées sur WhatsApp avant la commande."
    : "Les conditions de retour ou d'échange sont à confirmer sur WhatsApp avant la commande.";
  const paymentPolicy = settings.commercialTermsVerified
    ? "Le site n'encaisse aucun paiement. Le moyen et le moment du règlement applicables à votre zone sont convenus sur WhatsApp."
    : "Les modalités de paiement sont à confirmer sur WhatsApp avant la commande.";

  function handleIncQty() {
    if (qty >= max) {
      showToast(`Stock limité : ${max} disponible(s)`, "error", true);
      return;
    }
    setQty((q) => q + 1);
  }

  function handleAddToCart() {
    if (!canOrder) return;
    const result = addToCart(product.slug, selectedSize, qty);
    if (!result.ok) {
      showToast(result.message || "Erreur", "error", true);
      return;
    }
    const media = mediaRef.current;
    const flew = media ? flyToCart(media, barRef.current) : false;
    if (!flew) showToast(`${product.name} ajouté au panier`, "check-circle");

    setAdded(true);
    if (addedTimeoutRef.current) clearTimeout(addedTimeoutRef.current);
    addedTimeoutRef.current = setTimeout(() => setAdded(false), ADDED_LABEL_DURATION);

    runAddToCartIcon(addBtnRef.current, iconTimeoutRef);
  }

  return (
    <div className="product-detail">
      <div className="pd-media-col">
        {showingReel && product.reelUrl ? (
          <div className="pd-media" ref={mediaRef}>
            <video src={product.reelUrl} controls />
          </div>
        ) : (
          <Lens
            mediaRef={mediaRef}
            src={activePhoto}
            alt={`${product.name}, saison ${product.season}`}
            width={500}
            height={500}
          />
        )}
        {(photos.length > 1 || product.reelUrl) && (
          <div className="pd-thumbs" role="tablist" aria-label="Autres photos et vidéo de présentation">
            {photos.map((src, i) => (
              <button
                key={src}
                type="button"
                role="tab"
                aria-selected={!showingReel && src === activePhoto}
                aria-label={`Photo ${i + 1} sur ${photos.length}`}
                className={"pd-thumb" + (!showingReel && src === activePhoto ? " active" : "")}
                onClick={() => {
                  setActivePhoto(src);
                  setShowingReel(false);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
            {product.reelUrl ? (
              <button
                type="button"
                role="tab"
                aria-selected={showingReel}
                aria-label="Voir la vidéo de présentation"
                className={"pd-thumb" + (showingReel ? " active" : "")}
                onClick={() => setShowingReel(true)}
              >
                <video src={product.reelUrl} muted playsInline preload="metadata" />
                <span className="pd-thumb-play" aria-hidden="true">
                  ▶
                </span>
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="pd-info">
        <h1 className="pd-title">{product.name}</h1>
        <p className="pd-meta">
          <Icon name={product.sport === "football" ? "soccer" : "storefront"} size="sm" />
          {[product.leagueLabel || product.sportLabel, product.kit, `Saison ${product.season}`].filter(Boolean).join(" · ")}
        </p>
        <div className="pd-price">
          <span className="price-now">{FCFA(product.price)}</span>
          {verified && product.discountPct > 0 && (
            <>
              <span className="price-old">{FCFA(product.priceOriginal)}</span>
              <span className="discount-pill">-{Math.round(product.discountPct)}%</span>
            </>
          )}
        </div>
        <span className={"badge " + st.cls}>
          <Icon name={st.icon} size="sm" />
          {st.label}
        </span>
        <RatingStars rating={product.rating ?? 0} reviews={product.reviews} />
        {!verified && <p className="form-note">Prix/stock indicatifs, à confirmer sur WhatsApp.</p>}
        <div style={{ marginTop: 14 }}>
          <p className={"pd-desc" + (descExpanded ? " expanded" : "")}>{descriptionText}</p>
          {/* Seuil approximatif (3 lignes ≈ 150 caractères à cette taille de police) — évite
              d'afficher "Voir plus" sur une description déjà entièrement visible. */}
          {descriptionText.length > 150 && (
            <button type="button" className="pd-desc-toggle" onClick={() => setDescExpanded((v) => !v)}>
              {descExpanded ? "Voir moins" : "Voir plus"}
            </button>
          )}
        </div>

        <div className="pd-section">
          <h3>Taille</h3>
          <div className="size-grid">
            {sizes.length ? (
              sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={"size-opt" + (size === selectedSize ? " selected" : "")}
                  aria-pressed={size === selectedSize}
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              ))
            ) : (
              <p className="form-note">Aucune taille disponible.</p>
            )}
          </div>
          {verified && product.kidsAvailable && (
            <p className="form-note">Tailles enfant disponibles — précisez l&apos;âge sur WhatsApp.</p>
          )}
        </div>

        <div className="pd-section">
          <h3>Quantité</h3>
          <div className="qty-stepper">
            <button type="button" aria-label="Diminuer" disabled={!canOrder} onClick={() => setQty((q) => Math.max(1, q - 1))}>
              <Icon name="remove" />
            </button>
            <span aria-live="polite">{qty}</span>
            <button type="button" aria-label="Augmenter" disabled={!canOrder} onClick={handleIncQty}>
              <Icon name="add" />
            </button>
          </div>
        </div>

        <div className="pd-ctas">
          <div className="pd-ctas-total">
            <span className="label">Total</span>
            <span className="amount">{FCFA(product.price * qty)}</span>
          </div>
          <button ref={addBtnRef} type="button" className="btn btn-primary btn-lg" disabled={!canOrder} onClick={handleAddToCart}>
            <AddToCartIcon />
            {added ? "Ajouté" : canOrder ? "Ajouter au panier" : "Indisponible"}
          </button>
          {canOrder ? (
            <StatefulButton className="btn btn-whatsapp btn-lg" href={whatsappLink} target="_blank" rel="noopener" onRun={() => wait(600)}>
              <Icon name="whatsapp" />
              {/* Libellé court sur la barre fixe mobile (espace compté à côté du
                  total et du bouton "Ajouter au panier") — voir .pd-cta-short. */}
              <span className="pd-cta-full">Commander sur WhatsApp</span>
              <span className="pd-cta-short">WhatsApp</span>
            </StatefulButton>
          ) : (
            <button
              className="btn btn-whatsapp btn-lg"
              aria-disabled="true"
              tabIndex={-1}
              onClick={() => showToast(`${product.name} est indisponible`, "error", true)}
            >
              <Icon name="whatsapp" />
              Indisponible
            </button>
          )}
        </div>
        <p className="form-note">
          <Icon name="hourglass" size="sm" /> {settings.responseTime}
        </p>

        <div className="pd-section">
          <details className="accordion-mini" open>
            <summary>
              <Icon name="shipping" />
              Livraison &amp; paiement
            </summary>
            <p>{deliveryPolicy}</p>
          </details>
          <details className="accordion-mini">
            <summary>
              <Icon name="ruler" />
              Guide des tailles
            </summary>
            <p>
              Les coupes peuvent varier selon le modèle. Envoyez votre taille habituelle ou vos mesures sur WhatsApp
              afin de confirmer le choix avant la commande.
            </p>
          </details>
          <details className="accordion-mini">
            <summary>
              <Icon name="swap" />
              Retours &amp; échanges
            </summary>
            <p>{returnsPolicy}</p>
          </details>
          <details className="accordion-mini">
            <summary>
              <Icon name="shield" />
              Paiement
            </summary>
            <p>{paymentPolicy}</p>
          </details>
        </div>
      </div>
    </div>
  );
}
