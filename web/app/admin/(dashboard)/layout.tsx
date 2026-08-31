import { requireAdminOrRedirect } from "@/lib/auth/dal";
import { getAllProducts } from "@/lib/data/products";
import { getGallery } from "@/lib/data/gallery";
import { getTestimonials } from "@/lib/data/testimonials";
import { getAllOrders } from "@/lib/data/orders";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminTabs } from "@/components/admin/AdminTabs";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminOrRedirect();
  const [products, gallery, testimonials, orders] = await Promise.all([
    getAllProducts(),
    getGallery(),
    getTestimonials(),
    getAllOrders(),
  ]);

  const counts = { products: products.length, gallery: gallery.length, testimonials: testimonials.length, orders: orders.length };

  return (
    <>
      <AdminHeader email={admin.email} />
      <AdminTabs counts={counts} />
      <main className="container">
        <h1 className="sr-only">Administration du site Le Maillot Idéal</h1>
        {children}
      </main>
    </>
  );
}
