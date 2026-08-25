// Porté depuis renderProducts()/stockLabel() dans js/admin.js.
import { useRef } from "react";
import { formatFCFA } from "../../lib/format.js";

function StockBadge({ product }) {
  if (product.stock === 0) {
    return <span className="badge badge-stock-out"><svg className="icon icon-sm" aria-hidden="true"><use href="#i-error"></use></svg>Rupture</span>;
  }
  if (product.stock <= 5) {
    return <span className="badge badge-stock-low"><svg className="icon icon-sm" aria-hidden="true"><use href="#i-hourglass"></use></svg>{product.stock} restants</span>;
  }
  return <span className="badge badge-stock-ok"><svg className="icon icon-sm" aria-hidden="true"><use href="#i-check-circle"></use></svg>{product.stock}</span>;
}

export default function ProductTable({ products, touched, resolveImage, onEdit, onImagePicked }) {
  const fileInputRef = useRef(null);
  const pendingSlugRef = useRef(null);

  function handleThumbClick(slug) {
    pendingSlugRef.current = slug;
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  }

  function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    const slug = pendingSlugRef.current;
    if (file && slug) onImagePicked(slug, file);
  }

  return (
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
          {products.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <div className="adm-empty">
                  <svg className="icon" aria-hidden="true"><use href="#i-search"></use></svg>
                  <div>Aucun maillot ne correspond à ce filtre.</div>
                </div>
              </td>
            </tr>
          ) : products.map((p) => (
            <tr key={p.slug} className={touched[p.slug] ? "adm-edited" : ""}>
              <td>
                <img
                  className="adm-thumb" src={resolveImage(p.image)} alt="" title="Changer la photo"
                  onClick={() => handleThumbClick(p.slug)}
                />
              </td>
              <td>
                <div className="name">{p.name}</div>
                <div className="sub">{p.leagueLabel} · {p.kit} · {p.season}</div>
              </td>
              <td>
                <strong>{formatFCFA(p.price)}</strong>
                {p.discountPct > 0 ? <div className="sub">-{p.discountPct}% · {formatFCFA(p.priceOriginal)}</div> : null}
              </td>
              <td><StockBadge product={p} /></td>
              <td>
                {p.isNew
                  ? <span className="badge badge-new"><svg className="icon icon-sm" aria-hidden="true"><use href="#i-bolt"></use></svg>Nouveau</span>
                  : <span className="sub">—</span>}
              </td>
              <td>
                <div className="adm-row-actions">
                  <button type="button" className="icon-btn" data-edit={p.slug} aria-label="Modifier" onClick={() => onEdit(p.slug)}>
                    <svg className="icon icon-sm" aria-hidden="true"><use href="#i-edit"></use></svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
    </div>
  );
}
