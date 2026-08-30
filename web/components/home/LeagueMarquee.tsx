"use client";

import { InfiniteMovingCards } from "@/components/InfiniteMovingCards";
import { Icon } from "@/components/icons/Icon";
import { safeColor } from "@/lib/format";
import type { League, Product } from "@/lib/types";

export interface LeagueMarqueeProps {
  leagues: League[];
  products: Product[];
}

/** Bandeau décoratif — les vrais liens vivent dans la grille des championnats juste en dessous. */
export function LeagueMarquee({ leagues, products }: LeagueMarqueeProps) {
  const items = leagues.map((league) => ({
    league,
    count: products.filter((p) => p.league === league.key).length,
  }));

  return (
    <InfiniteMovingCards
      items={items}
      itemKey={(item) => item.league.key}
      speed="slow"
      renderItem={({ league, count }) => (
        <>
          <span className="imc-dot" style={{ background: safeColor(league.color) }}>
            <Icon name="soccer" size="sm" />
            {league.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="league-logo-img"
                src={league.logo}
                alt=""
                loading="lazy"
                onError={(e) => e.currentTarget.remove()}
              />
            )}
          </span>
          <strong>{league.label}</strong>
          <span>
            {count} maillot{count > 1 ? "s" : ""}
          </span>
        </>
      )}
    />
  );
}
