import "server-only";
import { cache } from "react";
import { adminDb } from "@/lib/firebase/admin";
import type { Order, TestimonialSubmission } from "@/lib/types";

// Contrairement à lib/data/products.ts et consorts, ces lectures passent par
// l'Admin SDK (pas le SDK client) : orders/testimonialSubmissions sont fermées
// en lecture côté client (voir firestore.rules), donc seul un Server Component
// déjà protégé par requireAdminOrRedirect() peut les charger.
export const getAllOrders = cache(async (): Promise<Order[]> => {
  const snap = await adminDb.collection("orders").orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, "id">) }));
});

export const getPendingTestimonialSubmissions = cache(async (): Promise<TestimonialSubmission[]> => {
  const snap = await adminDb.collection("testimonialSubmissions").orderBy("submittedAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TestimonialSubmission, "id">) }));
});

// Addendum 2 : historique de commandes d'un client. Filtrée côté serveur par
// uid (jamais par le SDK client, fermé en lecture) — un client ne voit donc
// jamais que ses propres commandes. Tri fait ici plutôt qu'avec .orderBy() :
// where("uid")+orderBy("createdAt") sur des champs différents demanderait un
// index composite à déployer (même friction que firestore.rules) — inutile
// vu le volume par client.
export const getOrdersForCustomer = cache(async (uid: string): Promise<Order[]> => {
  const snap = await adminDb.collection("orders").where("uid", "==", uid).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Order, "id">) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});
