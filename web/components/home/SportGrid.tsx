"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { safeColor } from "@/lib/format";
import type { Product, Sport } from "@/lib/types";

export function SportGrid({ sports, products }: { sports: Sport[]; products: Product[] }) {
  return (
    <div className="league-grid">
      {sports.map((sport) => {
        const count = products.filter((p) => p.sport === sport.key).length;
        return (
          <Link className="league-card" key={sport.key} href={`/${sport.key}`}>
            <span className="league-dot" style={{ background: safeColor(sport.color) }}>
              <Icon name={sport.key === "football" ? "soccer" : "storefront"} size="lg" />
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
            <div>
              <h3>{sport.label}</h3>
              <span>
                {count} produit{count > 1 ? "s" : ""} au catalogue
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
