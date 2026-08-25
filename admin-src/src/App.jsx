import { useState } from "react";
import { DraftProvider, useDraftState } from "./state/useDraftState.jsx";
import AdminHeader from "./components/layout/AdminHeader.jsx";
import Tabs from "./components/layout/Tabs.jsx";
import ProductsTab from "./components/products/ProductsTab.jsx";
import GalleryTab from "./components/gallery/GalleryTab.jsx";
import TestimonialsTab from "./components/testimonials/TestimonialsTab.jsx";
import SiteTextsTab from "./components/site/SiteTextsTab.jsx";
import ExportTab from "./components/export/ExportTab.jsx";

function AdminApp() {
  const { state } = useDraftState();
  const [activeTab, setActiveTab] = useState("produits");
  const counts = { products: state.products.length, gallery: state.gallery.length, testimonials: state.testimonials.length };

  return (
    <>
      <AdminHeader onGoExport={() => setActiveTab("export")} />
      <Tabs active={activeTab} onChange={setActiveTab} counts={counts} />
      <main className="container">
        <h1 className="sr-only">Administration du site Le Maillot Idéal</h1>
        {/*
          Les 5 onglets restent tous montés en permanence (visibilité en CSS
          via .adm-panel/.active, comme l'original) : l'onglet Exporter
          valide les champs [data-site] réels du DOM et les données des
          autres onglets avant de publier/exporter — voir ExportTab.jsx.
        */}
        <ProductsTab active={activeTab === "produits"} />
        <GalleryTab active={activeTab === "galerie"} />
        <TestimonialsTab active={activeTab === "avis"} />
        <SiteTextsTab active={activeTab === "textes"} />
        <ExportTab active={activeTab === "export"} onSwitchTab={setActiveTab} />
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
