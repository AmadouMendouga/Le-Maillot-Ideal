"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import type { League, Product } from "@/lib/types";

// Rangée d'accès rapide aux championnats — repère client du 11/09/2026
// (maquette : icônes rondes "Categories" en tête de l'accueil boutique).
// Remplace LeagueMarquee (purement décoratif, jamais cliquable) : même
// donnée, mais chaque icône est un vrai lien de filtre, comme l'affordance
// de la maquette. Style repris de .ik-sport-shortcuts (déjà construit pour
// app/[sport]/compte/page.tsx) plutôt qu'un nouveau patron.
export function LeagueShortcuts({
  leagues,
  products,
  basePath,
}: {
  leagues: League[];
  products: Product[];
  basePath: string;
}) {
  const withCounts = leagues.filter((league) => products.some((p) => p.league === league.key));
  if (withCounts.length === 0) return null;

  return (
    <div className="container">
      <nav className="ik-sport-shortcuts" aria-label="Parcourir par championnat">
        {withCounts.map((league) => (
          <Link key={league.key} href={`${basePath}/boutique?league=${league.key}`}>
            <span aria-hidden="true">
              {league.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={league.logo} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />
              ) : (
                <Icon name="soccer" />
              )}
            </span>
            <strong>{league.label}</strong>
          </Link>
        ))}
        <Link href={`${basePath}/boutique`}>
          <span aria-hidden="true">
            <Icon name="grid" />
          </span>
          <strong>Tout voir</strong>
        </Link>
      </nav>
    </div>
  );
}
