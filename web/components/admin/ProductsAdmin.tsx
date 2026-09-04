"use client";

// Porté depuis admin-src/src/components/products/{ProductsTab,ProductTable}.jsx.
// Différence avec l'original : plus de brouillon local — la liste vient d'un
// onSnapshot Firestore, donc une modification faite par un autre admin apparaît
// ici en direct (voir le plan §3, test de vérification #4).
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Icon } from "@/components/icons/Icon";
import { FCFA } from "@/lib/cart";
import { ProductEditDrawer } from "@/components/admin/ProductEditDrawer";
import { ProductCreateDrawer } from "@/components/admin/ProductCreateDrawer";
import { LeaguesManager } from "@/components/admin/LeaguesManager";
import { SportsManager } from "@/components/admin/SportsManager";
import type { League, Product, Sport } from "@/lib/types";

function StockBadge({ product }: { product: Product }) {
  if (product.stock === 0) {
    return (
      <span className="badge badge-stock-out">
        <Icon name="error" size="sm" />
        Rupture
      </span>
    );
  }
  if (product.stock <= 5) {
    return (
      <span className="badge badge-stock-low">
        <Icon name="hourglass" size="sm" />
        {product.stock} restants
      </span>
    );
  }
  return (
    <span className="badge badge-stock-ok">
      <Icon name="check-circle" size="sm" />
      {product.stock}
    </span>
  );
}

export function ProductsAdmin({
  initialProducts,
  leagues,
  sports,
}: {
  initialProducts: Product[];
  leagues: League[];
  sports: Sport[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [filters, setFilters] = useState({ q: "", league: "", sport: "", status: "" });
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [displaySlug, setDisplaySlug] = useState<string | null>(null);
  const [openNonce, setOpenNonce] = useState(0);
  const [creating, setCreating] = useState(false);
  const [managingLeagues, setManagingLeagues] = useState(false);
  const [managingSports, setManagingSports] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(snap.docs.map((d) => ({ slug: d.id, ...(d.data() as Omit<Product, "slug">) })));
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filters.sport && p.sport !== filters.sport) return false;
      if (filters.league && p.league !== filters.league) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.team.toLowerCase().includes(q)) return false;
      }
      if (filters.status === "out" && p.stock !== 0) return false;
      if (filters.status === "low" && !(p.stock > 0 && p.stock <= 5)) return false;
      if (filters.status === "promo" && !(p.discountPct > 0)) return false;
      return true;
    });
  }, [products, filters]);

  const displayProduct = products.find((p) => p.slug === displaySlug) || null;

  function openEditor(slug: string) {
    setDisplaySlug(slug);
    setEditingSlug(slug);
    setOpenNonce((n) => n + 1);
  }
  function closeEditor() {
    setEditingSlug(null);
  }

  return (
    <section>
      <div className="adm-toolbar">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          <Icon name="add" size="sm" />
          Ajouter un maillot
        </button>
        <button type="button" className="btn btn-tonal btn-sm" onClick={() => setManagingSports(true)}>
          <Icon name="storefront" size="sm" />
          Gérer les sports
        </button>
        <button type="button" className="btn btn-tonal btn-sm" onClick={() => setManagingLeagues(true)}>
          <Icon name="storefront" size="sm" />
          Gérer les championnats
        </button>
        <span className="field-wrap grow">
          <Icon name="search" />
          <input
            type="search"
            className="search-input"
            aria-label="Rechercher un maillot"
            placeholder="Rechercher une équipe, un maillot…"
            style={{ width: "100%" }}
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </span>
        <select
          className="sort-select"
          aria-label="Filtrer par sport"
          value={filters.sport}
          onChange={(e) => setFilters((f) => ({ ...f, sport: e.target.value }))}
        >
          <option value="">Tous les sports</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="sort-select"
          aria-label="Filtrer par championnat"
          value={filters.league}
          onChange={(e) => setFilters((f) => ({ ...f, league: e.target.value }))}
        >
          <option value="">Tous les championnats</option>
          {leagues.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
        <select
          className="sort-select"
          aria-label="Filtrer par état"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">Tous les états</option>
          <option value="out">En rupture</option>
          <option value="low">Stock bas</option>
          <option value="promo">En promotion</option>
        </select>
        <span className="adm-count">
          {filtered.length} maillot{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th style={{ width: 66 }}>Photo</th>
              <th>Maillot</th>
              <th style={{ width: 130 }}>Prix</th>
              <th style={{ width: 110 }}>Stock</th>
              <th style={{ width: 110 }}>État</th>
              <th style={{ width: 96 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="adm-empty">
                    <Icon name="search" />
                    <div>Aucun maillot ne correspond à ce filtre.</div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.slug}>
                  <td>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="adm-thumb"
                      src={p.images.square}
                      alt=""
                      title="Modifier"
                      onClick={() => openEditor(p.slug)}
                    />
                  </td>
                  <td>
                    <div className="name">{p.name}</div>
                    <div className="sub">
                      {[p.leagueLabel || p.sportLabel, p.kit, p.season].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td>
                    <strong>{FCFA(p.price)}</strong>
                    {p.discountPct > 0 ? (
                      <div className="sub">
                        -{p.discountPct}% · {FCFA(p.priceOriginal)}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <StockBadge product={p} />
                  </td>
                  <td>
                    {p.isNew ? <span className="badge badge-new">Nouveau</span> : <span className="sub">—</span>}
                  </td>
                  <td>
                    <div className="adm-row-actions">
                      <button type="button" className="icon-btn" aria-label="Modifier" onClick={() => openEditor(p.slug)}>
                        <Icon name="edit" size="sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ProductEditDrawer
        key={displaySlug + ":" + openNonce}
        product={displayProduct}
        leagues={leagues}
        sports={sports}
        open={editingSlug !== null}
        onClose={closeEditor}
      />
      <ProductCreateDrawer
        leagues={leagues}
        sports={sports}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={openEditor}
      />
      <LeaguesManager leagues={leagues} open={managingLeagues} onClose={() => setManagingLeagues(false)} />
      <SportsManager sports={sports} open={managingSports} onClose={() => setManagingSports(false)} />
    </section>
  );
}
