import { getTestimonials } from "@/lib/data/testimonials";
import { TestimonialsAdmin } from "@/components/admin/TestimonialsAdmin";

export default async function AdminTestimonialsPage() {
  const testimonials = await getTestimonials();
  return <TestimonialsAdmin initialTestimonials={testimonials} />;
}
