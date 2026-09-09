import { getAllProducts } from "@/lib/data/adminCatalog";
import { getAllLeagues } from "@/lib/data/adminCatalog";
import { getAllSports } from "@/lib/data/adminCatalog";
import { ProductsAdmin } from "@/components/admin/ProductsAdmin";

export default async function AdminProductsPage() {
  const [products, leagues, sports] = await Promise.all([getAllProducts(), getAllLeagues(), getAllSports()]);
  return <ProductsAdmin initialProducts={products} leagues={leagues} sports={sports} />;
}
