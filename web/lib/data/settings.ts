import { cache } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { SiteSettings } from "@/lib/types";

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const snap = await getDoc(doc(db, "settings", "site"));
  if (!snap.exists()) {
    throw new Error("settings/site introuvable — la migration Firestore a-t-elle été lancée ?");
  }
  return snap.data() as SiteSettings;
});
