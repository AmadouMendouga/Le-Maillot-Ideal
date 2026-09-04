"use client";

import { InfiniteMovingCards } from "@/components/InfiniteMovingCards";
import { Icon } from "@/components/icons/Icon";
import { safeColor } from "@/lib/format";
import type { Product, Sport } from "@/lib/types";

export interface SportMarqueeProps {
  sports: Sport[];
  products: Product[];
}

/** Bandeau décoratif — les vrais liens vivent dans la grille des sports juste en dessous. */
export function SportMarquee({ sports, products }: SportMarqueeProps) {
  const items = sports.map((sport) => ({
    sport,
    count: products.filter((p) => p.sport === sport.key).length,
  }));

  return (
    <InfiniteMovingCards
      items={items}
      itemKey={(item) => item.sport.key}
      speed="slow"
      renderItem={({ sport, count }) => (
        <>
          <span className="imc-dot" style={{ background: safeColor(sport.color) }}>
            <Icon name={sport.key === "football" ? "soccer" : "storefront"} size="sm" />
            {sport.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="league-logo-img"
                src={sport.logo}
                alt=""
                loading="lazy"
                onError={(e) => e.currentTarget.remove()}
              />
            )}
          </span>
          <strong>{sport.label}</strong>
          <span>
            {count} produit{count > 1 ? "s" : ""}
          </span>
        </>
      )}
    />
  );
}
