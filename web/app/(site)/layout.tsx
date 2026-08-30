import { getAllLeagues } from "@/lib/data/leagues";
import { getAllProducts } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";
import { Navbar } from "@/components/nav/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";
import { CartProvider } from "@/components/cart/CartContext";
import { CartBar } from "@/components/cart/CartBar";
import { CartPanel } from "@/components/cart/CartPanel";

// Layout du site public — l'admin (à venir sous /admin) aura son propre
// layout, sans cette navbar. La navbar et le panier ont besoin du catalogue
// pour leurs panneaux/leur validation : chargés une fois ici, pas re-fetchés
// par chaque page.
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [leagues, products, settings] = await Promise.all([
    getAllLeagues(),
    getAllProducts(),
    getSiteSettings(),
  ]);

  return (
    <CartProvider products={products} settings={settings}>
      <a href="#main" className="skip-link">
        Aller au contenu principal
      </a>
      <Navbar leagues={leagues} products={products} settings={settings} />
      {children}
      <Footer leagues={leagues} settings={settings} />
      <WhatsAppFloat settings={settings} />
      <CartBar />
      <CartPanel settings={settings} />
    </CartProvider>
  );
}
