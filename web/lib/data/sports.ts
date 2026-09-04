import { cache } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Sport } from "@/lib/types";

export const getAllSports = cache(async (): Promise<Sport[]> => {
  const snap = await getDocs(collection(db, "sports"));
  return snap.docs.map((d) => ({ key: d.id, ...(d.data() as Omit<Sport, "key">) }));
});

export const getSportByKey = cache(async (key: string): Promise<Sport | null> => {
  const snap = await getDoc(doc(db, "sports", key));
  if (!snap.exists()) return null;
  return { key: snap.id, ...(snap.data() as Omit<Sport, "key">) };
});
