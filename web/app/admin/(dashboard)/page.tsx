import { getAllProducts } from "@/lib/data/products";
import { getAllLeagues } from "@/lib/data/leagues";
import { ProductsAdmin } from "@/components/admin/ProductsAdmin";

export default async function AdminProductsPage() {
  const [products, leagues] = await Promise.all([getAllProducts(), getAllLeagues()]);
  return <ProductsAdmin initialProducts={products} leagues={leagues} />;
}
