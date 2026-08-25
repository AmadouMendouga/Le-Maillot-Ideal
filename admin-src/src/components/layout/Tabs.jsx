// Porté depuis .adm-tabs / .adm-tab dans admin.html. Les onglets sont un
// simple état React (pas de routing par URL — CLAUDE.md §12, aucun besoin
// de bookmarker un onglet précis dans cet outil interne).
export const TAB_DEFS = [
  { key: "produits", label: "Produits", icon: "inventory", countKey: "products" },
  { key: "galerie", label: "Photothèque", icon: "photo-library", countKey: "gallery" },
  { key: "avis", label: "Avis", icon: "star", countKey: "testimonials" },
  { key: "textes", label: "Textes du site", icon: "edit", countKey: null },
  { key: "export", label: "Exporter", icon: "save", countKey: null },
];

export default function Tabs({ active, onChange, counts }) {
  return (
    <div className="adm-tabs">
      {TAB_DEFS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          data-tab={tab.key}
          className={"adm-tab" + (active === tab.key ? " active" : "")}
          onClick={() => {
            onChange(tab.key);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <svg className="icon icon-sm" aria-hidden="true"><use href={"#i-" + tab.icon}></use></svg>
          {tab.label}
          {tab.countKey ? <span className="cnt">{counts[tab.countKey]}</span> : null}
        </button>
      ))}
    </div>
  );
}
