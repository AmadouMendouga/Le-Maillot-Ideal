import { useState } from "react";
import { DraftProvider, useDraftState } from "./state/useDraftState.jsx";
import AdminHeader from "./components/layout/AdminHeader.jsx";
import Tabs, { TAB_DEFS } from "./components/layout/Tabs.jsx";
import ProductsTab from "./components/products/ProductsTab.jsx";
import GalleryTab from "./components/gallery/GalleryTab.jsx";
import TestimonialsTab from "./components/testimonials/TestimonialsTab.jsx";

// Panneau provisoire (phase 3, CLAUDE.md §12) — onglets pas encore portés :
// Textes du site, Exporter (phase 4d-4e).
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

const TAB_COMPONENTS = {
  produits: ProductsTab,
  galerie: GalleryTab,
  avis: TestimonialsTab,
};

function AdminApp() {
  const { state } = useDraftState();
  const [activeTab, setActiveTab] = useState("produits");
  const activeTabDef = TAB_DEFS.find((t) => t.key === activeTab);
  const counts = { products: state.products.length, gallery: state.gallery.length, testimonials: state.testimonials.length };
  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

  return (
    <>
      <AdminHeader onGoExport={() => setActiveTab("export")} />
      <Tabs active={activeTab} onChange={setActiveTab} counts={counts} />
      <main className="container">
        <h1 className="sr-only">Administration du site Le Maillot Idéal</h1>
        {ActiveTabComponent ? <ActiveTabComponent /> : <PlaceholderPanel tab={activeTabDef} />}
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
