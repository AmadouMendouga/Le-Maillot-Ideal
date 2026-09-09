import { getTestimonials } from "@/lib/data/adminCatalog";
import { getPendingTestimonialSubmissions } from "@/lib/data/orders";
import { TestimonialsAdmin } from "@/components/admin/TestimonialsAdmin";

export default async function AdminTestimonialsPage() {
  const [testimonials, pendingSubmissions] = await Promise.all([getTestimonials(), getPendingTestimonialSubmissions()]);
  return <TestimonialsAdmin initialTestimonials={testimonials} initialPendingSubmissions={pendingSubmissions} />;
}
