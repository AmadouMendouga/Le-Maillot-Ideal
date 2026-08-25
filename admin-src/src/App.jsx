import { useState } from "react";
import { DraftProvider, useDraftState } from "./state/useDraftState.jsx";
import AdminHeader from "./components/layout/AdminHeader.jsx";
import Tabs, { TAB_DEFS } from "./components/layout/Tabs.jsx";
import ProductsTab from "./components/products/ProductsTab.jsx";

// Panneau provisoire (phase 3, CLAUDE.md §12) — onglets pas encore portés :
// Photothèque, Avis, Textes du site, Exporter (phase 4b-4e).
function PlaceholderPanel({ tab }) {
  const { state } = useDraftState();
  const count = tab.countKey ? state[tab.countKey].length : null;
  return (
    <section className="adm-panel active" data-panel={tab.key}>
      <p className="hint">
        Onglet « {tab.label} »{count !== null ? " — " + count + " élément(s) dans le brouillon" : ""} : à venir (phase 4).
      </p>
    </section>
  );
}

function AdminApp() {
  const { state } = useDraftState();
  const [activeTab, setActiveTab] = useState("produits");
  const activeTabDef = TAB_DEFS.find((t) => t.key === activeTab);
  const counts = { products: state.products.length, gallery: state.gallery.length, testimonials: state.testimonials.length };

  return (
    <>
      <AdminHeader onGoExport={() => setActiveTab("export")} />
      <Tabs active={activeTab} onChange={setActiveTab} counts={counts} />
      <main className="container">
        <h1 className="sr-only">Administration du site Le Maillot Idéal</h1>
        {activeTab === "produits" ? <ProductsTab /> : <PlaceholderPanel tab={activeTabDef} />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <DraftProvider>
      <AdminApp />
    </DraftProvider>
  );
}
