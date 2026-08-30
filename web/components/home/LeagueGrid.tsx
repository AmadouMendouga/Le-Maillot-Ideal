"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { safeColor } from "@/lib/format";
import type { League, Product } from "@/lib/types";

export function LeagueGrid({ leagues, products }: { leagues: League[]; products: Product[] }) {
  return (
    <div className="league-grid">
      {leagues.map((league) => {
        const count = products.filter((p) => p.league === league.key).length;
        return (
          <Link className="league-card" key={league.key} href={`/boutique?league=${league.key}`}>
            <span className="league-dot" style={{ background: safeColor(league.color) }}>
              <Icon name="soccer" size="lg" />
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
            <div>
              <h3>{league.label}</h3>
              <span>
                {count} maillot{count > 1 ? "s" : ""} au catalogue
              </span>
            </div>
            <span className="chev">
              <Icon name="chevron-right" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
