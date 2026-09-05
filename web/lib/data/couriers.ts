import "server-only";
import { cache } from "react";
import { adminDb } from "@/lib/firebase/admin";
import type { Courier } from "@/lib/types";

// Même principe que lib/data/orders.ts : lecture par l'Admin SDK, réservée
// aux Server Components déjà protégés par requireAdminOrRedirect().
export const getAllCouriers = cache(async (): Promise<Courier[]> => {
  const snap = await adminDb.collection("couriers").orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Courier, "id">) }));
});
