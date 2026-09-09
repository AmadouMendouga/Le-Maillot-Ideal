import "server-only";
import { cache } from "react";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import type { GalleryItem, League, Product, SiteSettings, Sport, Testimonial } from "@/lib/types";

/** Admin pages use the server SDK directly, without starting the browser Firestore transport. */
async function rows<T>(collection: string, idKey: string, ordered = false): Promise<T[]> {
  await verifyAdminSession();
  const ref = adminDb.collection(collection);
  const snapshot = await (ordered ? ref.orderBy("order") : ref).get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), [idKey]: doc.id }) as T);
}
export const getAllProducts = cache(() => rows<Product>("products", "slug"));
export const getAllLeagues = cache(() => rows<League>("leagues", "key"));
export const getAllSports = cache(() => rows<Sport>("sports", "key"));
export const getGallery = cache(() => rows<GalleryItem>("gallery", "id", true));
export const getTestimonials = cache(() => rows<Testimonial>("testimonials", "id", true));
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  await verifyAdminSession();
  const snapshot = await adminDb.collection("settings").doc("site").get();
  if (!snapshot.exists) throw new Error("Paramètres du site introuvables.");
  return snapshot.data() as SiteSettings;
});
