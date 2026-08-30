import { cache } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Testimonial } from "@/lib/types";

export const getTestimonials = cache(async (): Promise<Testimonial[]> => {
  const q = query(collection(db, "testimonials"), orderBy("order"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Testimonial, "id">) }));
});
