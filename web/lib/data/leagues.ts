import { cache } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { League } from "@/lib/types";

export const getAllLeagues = cache(async (): Promise<League[]> => {
  const snap = await getDocs(collection(db, "leagues"));
  return snap.docs.map((d) => ({ key: d.id, ...(d.data() as Omit<League, "key">) }));
});
