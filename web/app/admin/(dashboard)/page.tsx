import { getAllProducts } from "@/lib/data/products";
import { getAllLeagues } from "@/lib/data/leagues";
import { getAllSports } from "@/lib/data/sports";
import { ProductsAdmin } from "@/components/admin/ProductsAdmin";

export default async function AdminProductsPage() {
  const [products, leagues, sports] = await Promise.all([getAllProducts(), getAllLeagues(), getAllSports()]);
  return <ProductsAdmin initialProducts={products} leagues={leagues} sports={sports} />;
}
