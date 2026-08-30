import { cache } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Product } from "@/lib/types";

export const getAllProducts = cache(async (): Promise<Product[]> => {
  const snap = await getDocs(collection(db, "products"));
  return snap.docs.map((d) => ({ slug: d.id, ...(d.data() as Omit<Product, "slug">) }));
});

export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  const snap = await getDoc(doc(db, "products", slug));
  if (!snap.exists()) return null;
  return { slug: snap.id, ...(snap.data() as Omit<Product, "slug">) };
});

export const getAllProductSlugs = cache(async (): Promise<string[]> => {
  const snap = await getDocs(collection(db, "products"));
  return snap.docs.map((d) => d.id);
});
