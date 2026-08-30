import { Icon } from "@/components/icons/Icon";

export interface RatingStarsProps {
  rating: number;
  reviews: number;
}

/** Porté depuis js/main.js#ratingHTML — masqué si aucun avis réel n'existe. */
export function RatingStars({ rating, reviews }: RatingStarsProps) {
  if (typeof rating !== "number" || !Number.isFinite(rating) || reviews <= 0) return null;
  const r = Math.max(0, Math.min(5, rating));
  const stars = Array.from({ length: 5 }, (_, i) => i + 1 <= Math.round(r));

  return (
    <div className="product-rating">
      <span className="rstars">
        {stars.map((on, i) => (
          <Icon key={i} name={on ? "star-fill" : "star"} className={on ? undefined : "off"} />
        ))}
      </span>
      <span>
        {r.toFixed(1)} ({reviews})
      </span>
    </div>
  );
}
