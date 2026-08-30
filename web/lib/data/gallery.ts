import { cache } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { GalleryItem } from "@/lib/types";

export const getGallery = cache(async (): Promise<GalleryItem[]> => {
  const q = query(collection(db, "gallery"), orderBy("order"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GalleryItem, "id">) }));
});
