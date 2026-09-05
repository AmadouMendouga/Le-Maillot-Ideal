"use server";

// Livreurs enregistrés — solution principale pour qui livre régulièrement
// (accès permanent à ses livraisons via /livreur/[token], sans coordination
// manuelle par commande). Le lien ponctuel généré depuis OrdersAdmin
// (lib/actions/orders.ts, getOrCreateLocationTokenAction) reste la solution
// de secours quand aucun livreur enregistré n'est disponible.
//
// getCourierDashboardAction n'appelle PAS verifyAdminSession — c'est une
// action publique gardée par le jeton personnel du livreur (même principe
// que reviewToken/locationToken, voir lib/actions/orders.ts), jamais par une
// vérification côté navigateur.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import type { Courier, Order } from "@/lib/types";

export async function registerCourierAction(input: {
  name: string;
  phone: string;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const name = input.name.trim();
  const phone = input.phone.replace(/\D/g, "");
  if (!name) return { ok: false, error: "Le nom est obligatoire." };
  if (phone.length < 8 || phone.length > 15) {
    return { ok: false, error: "Le numéro WhatsApp doit contenir 8 à 15 chiffres." };
  }

  const token = randomUUID();
  await adminDb.collection("couriers").add({
    name,
    phone,
    token,
    active: true,
    createdAt: new Date().toISOString(),
  });

  return { ok: true, token };
}

export async function setCourierActiveAction(id: string, active: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();
  const ref = adminDb.collection("couriers").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Livreur introuvable." };
  await ref.update({ active });
  return { ok: true };
}

// Rattache un livreur enregistré à une commande (ou détache si courierId est
// null). Le jeton de suivi (courierLocationToken) est réutilisé s'il existe
// déjà — un lien ponctuel généré avant coup n'est pas perdu, le livreur
// enregistré voit simplement la même livraison apparaître sur son lien
// personnel.
export async function assignCourierToOrderAction(
  orderId: string,
  courierId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();

  const ref = adminDb.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Commande introuvable." };

  if (!courierId) {
    await ref.update({ assignedCourierId: null });
    return { ok: true };
  }

  const order = snap.data() as Order;
  const token = order.courierLocationToken || randomUUID();
  await ref.update({ assignedCourierId: courierId, courierLocationToken: token });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Tableau de bord public d'un livreur enregistré (/livreur/[token]) : trouve
// sa livraison actuellement assignée (au plus une à la fois — un livreur
// enchaîne les commandes une par une, pas de gestion de tournée ici) et
// renvoie le jeton de suivi correspondant pour rediriger vers la page de
// partage de position déjà existante (/livraison/[token]) — aucune UI dupliquée.
export async function getCourierDashboardAction(
  token: string
): Promise<{ ok: true; name: string; activeDeliveryToken: string | null } | { ok: false; error: string }> {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return { ok: false, error: "Ce lien n'est pas valide." };

  const courierSnap = await adminDb.collection("couriers").where("token", "==", cleanToken).limit(1).get();
  if (courierSnap.empty) return { ok: false, error: "Ce lien n'est pas valide." };
  const courierDoc = courierSnap.docs[0];
  const courier = courierDoc.data() as Omit<Courier, "id">;
  if (!courier.active) return { ok: false, error: "Ce profil livreur n'est plus actif. Contactez-nous pour en savoir plus." };

  const orderSnap = await adminDb
    .collection("orders")
    .where("assignedCourierId", "==", courierDoc.id)
    .where("status", "==", "confirmee")
    .limit(1)
    .get();

  if (orderSnap.empty) return { ok: true, name: courier.name, activeDeliveryToken: null };

  const orderDoc = orderSnap.docs[0];
  const order = orderDoc.data() as Order;
  let deliveryToken = order.courierLocationToken;
  if (!deliveryToken) {
    deliveryToken = randomUUID();
    await orderDoc.ref.update({ courierLocationToken: deliveryToken });
  }

  return { ok: true, name: courier.name, activeDeliveryToken: deliveryToken };
}
