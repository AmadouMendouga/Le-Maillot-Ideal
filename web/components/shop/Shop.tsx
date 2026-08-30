"use client";

// Boutique — porté depuis js/main.js#initShop. Filtre/trie/pagine côté
// client sur le catalogue déjà chargé (76 produits, pas besoin de requêtes
// supplémentaires). L'état initial vient des paramètres d'URL comme
// l'original (?league=, ?promo=1, ?stock=1, ?tri=, ?q=), lus une seule fois
// au montage (pas via useSearchParams()/Suspense : sur une page par ailleurs
// statique, ça obligeait soit un flash de contenu vide au premier rendu
// serveur, soit un rendu dupliqué observé en dev — un effet au montage évite
// les deux, au prix d'un correctif de quelques millisecondes après affichage
// si l'URL contenait des paramètres). Jamais réécrit dans l'URL ensuite —
// comportement identique à l'original.
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons/Icon";
import { ProductCard } from "@/components/products/ProductCard";
import { stockInfo } from "@/lib/cart";
import type { League, Product, SiteSettings } from "@/lib/types";

const PER_PAGE = 12;

type SortOrder = "default" | "price-asc" | "price-desc";

export function Shop({
  products,
  leagues,
  settings,
}: {
  products: Product[];
  leagues: League[];
  settings: SiteSettings;
}) {
  const verified = settings.catalogDataVerified;

  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState<SortOrder>("default");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const league = params.get("league");
    const q = params.get("q") || "";
    const tri = params.get("tri");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lit l'URL au montage, pas possible pendant le rendu serveur
    if (league) setSelectedLeagues([league]);
    if (verified && params.get("promo") === "1") setOnlyPromo(true);
    if (verified && params.get("stock") === "1") setInStockOnly(true);
    if (q) {
      setSearch(q.trim().toLowerCase());
      setSearchInput(q);
    }
    if (tri === "prix-asc") setSort("price-asc");
    else if (tri === "prix-desc") setSort("price-desc");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = products.slice();
    if (selectedLeagues.length) list = list.filter((p) => selectedLeagues.includes(p.league));
    if (onlyPromo) list = list.filter((p) => p.discountPct > 0);
    if (inStockOnly) list = list.filter((p) => stockInfo(p, verified).available);
    if (search) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(search) || p.team.toLowerCase().includes(search)
      );
    }
    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    return list;
  }, [products, selectedLeagues, onlyPromo, inStockOnly, search, sort, verified]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  function toggleLeague(key: string, checked: boolean) {
    setSelectedLeagues((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)));
    setPage(1);
  }

  function goToPage(p: number) {
    setPage(p);
    document.getElementById("shopGrid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="shop-layout">
      <aside className="filters" aria-label="Filtres du catalogue">
        <details className="filters-panel" open>
          <summary>
            <Icon name="tune" size="sm" />
            Filtrer les maillots
          </summary>
          <div className="filters-content">
            <h3>Championnat</h3>
            <div className="filter-group">
              {leagues.map((league) => {
                const count = products.filter((p) => p.league === league.key).length;
                return (
                  <label className="filter-option" key={league.key}>
                    <input
                      type="checkbox"
                      checked={selectedLeagues.includes(league.key)}
                      onChange={(e) => toggleLeague(league.key, e.currentTarget.checked)}
                    />
                    {league.label}
                    <span className="count">{count}</span>
                  </label>
                );
              })}
            </div>

            {verified && (
              <div>
                <h3>Disponibilité</h3>
                <div className="filter-group">
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      checked={onlyPromo}
                      onChange={(e) => {
                        setOnlyPromo(e.currentTarget.checked);
                        setPage(1);
                      }}
                    />
                    En promotion
                  </label>
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => {
                        setInStockOnly(e.currentTarget.checked);
                        setPage(1);
                      }}
                    />
                    En stock uniquement
                  </label>
                </div>
              </div>
            )}

            <a className="btn btn-tonal btn-block" href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noopener">
              <Icon name="chat" size="sm" />
              Une question ?
            </a>
          </div>
        </details>
      </aside>

      <div>
        <div className="demo-note">
          <Icon name="info" />
          <div>
            <strong>Photos de démonstration.</strong> Les visuels produits sont des images de test — remplacez-les
            par vos vraies photos de maillots.
          </div>
        </div>

        {!verified && (
          <div className="catalog-note" role="note">
            <Icon name="info" />
            <div>
              <strong>Catalogue en cours de vérification.</strong> Les prix et disponibilités affichés sont
              indicatifs et doivent être confirmés sur WhatsApp.
            </div>
          </div>
        )}

        <div className="toolbar">
          <span className="result-count" role="status" aria-live="polite" aria-atomic="true">
            {filtered.length} maillot{filtered.length !== 1 ? "s" : ""} trouvé{filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="toolbar-controls">
            <span className="field-wrap">
              <Icon name="search" />
              <label className="sr-only" htmlFor="shopSearch">
                Rechercher une équipe ou un maillot
              </label>
              <input
                type="search"
                className="search-input"
                id="shopSearch"
                placeholder="Rechercher une équipe..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.currentTarget.value);
                  setSearch(e.currentTarget.value.trim().toLowerCase());
                  setPage(1);
                }}
              />
            </span>
            <select
              className="sort-select"
              aria-label="Trier"
              value={sort}
              onChange={(e) => setSort(e.currentTarget.value as SortOrder)}
            >
              <option value="default">Ordre du catalogue</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
            </select>
          </div>
        </div>

        <div className="product-grid" id="shopGrid">
          {pageItems.length ? (
            pageItems.map((p) => <ProductCard key={p.slug} product={p} settings={settings} />)
          ) : (
            <div className="empty-state">
              <Icon name="search" />
              <div>
                Aucun maillot ne correspond à votre recherche.
                <br />
                Essayez d&apos;autres filtres ou écrivez-nous sur WhatsApp.
              </div>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <nav className="pagination" role="navigation" aria-label="Pagination des produits">
            <button
              type="button"
              disabled={currentPage === 1}
              aria-label="Page précédente"
              onClick={() => goToPage(currentPage - 1)}
            >
              <Icon name="chevron-left" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                className={p === currentPage ? "active" : undefined}
                aria-label={`Page ${p}`}
                aria-current={p === currentPage ? "page" : undefined}
                onClick={() => goToPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage === totalPages}
              aria-label="Page suivante"
              onClick={() => goToPage(currentPage + 1)}
            >
              <Icon name="chevron-right" />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
