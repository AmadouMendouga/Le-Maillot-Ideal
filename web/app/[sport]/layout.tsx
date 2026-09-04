import { notFound } from "next/navigation";
import { getAllLeagues } from "@/lib/data/leagues";
import { getAllSports } from "@/lib/data/sports";
import { getAllProducts } from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";
import { Navbar } from "@/components/nav/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";
import { CartProvider } from "@/components/cart/CartContext";
import { CartBar } from "@/components/cart/CartBar";
import { CartPanel } from "@/components/cart/CartPanel";

// Layout d'un site-sport (ex. /football, /judo — voir le plan "portail
// multi-sports"). Chaque sport a son propre site, avec la même structure —
// navbar/panier/footer sont chargés une fois ici, pas re-fetchés par chaque
// page de CE sport. Le portail (/) a son propre en-tête/pied de page léger,
// sans panier : ce layout ne s'applique qu'à l'intérieur d'un sport.
export async function generateStaticParams() {
  const sports = await getAllSports();
  return sports.map((s) => ({ sport: s.key }));
}

export default async function SportLayout({ children, params }: LayoutProps<"/[sport]">) {
  const { sport: sportKey } = await params;
  const [leagues, sports, products, settings] = await Promise.all([
    getAllLeagues(),
    getAllSports(),
    getAllProducts(),
    getSiteSettings(),
  ]);

  const sport = sports.find((s) => s.key === sportKey);
  if (!sport) notFound();

  const sportLeagues = leagues.filter((l) => l.sport === sportKey);
  const sportProducts = products.filter((p) => p.sport === sportKey);
  const basePath = `/${sportKey}`;

  return (
    // Le panier reçoit le catalogue COMPLET (tous sports), pas seulement celui
    // de ce site — sinon un article ajouté depuis /football disparaîtrait
    // silencieusement du panier en naviguant vers /judo (cartDetails filtre
    // tout slug absent de `products`, voir lib/cart.ts). Une seule commande
    // WhatsApp peut mélanger plusieurs sports, cohérent avec "IKIGAI = façade
    // d'un système organisé". La navbar/le footer, eux, restent scopés à ce
    // sport (compteurs par championnat propres au site courant).
    <CartProvider products={products} settings={settings}>
      <a href="#main" className="skip-link">
        Aller au contenu principal
      </a>
      <Navbar basePath={basePath} leagues={sportLeagues} products={sportProducts} settings={settings} />
      {children}
      <Footer basePath={basePath} sports={sports} settings={settings} />
      <WhatsAppFloat settings={settings} />
      <CartBar />
      <CartPanel settings={settings} />
    </CartProvider>
  );
}
