"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";

async function orderedGalleryDocs() {
  const snap = await adminDb.collection("gallery").orderBy("order").get();
  return snap.docs;
}

export async function addGalleryItemsAction(items: { src: string; thumb: string }[]): Promise<{ ok: true }> {
  await verifyAdminSession();
  if (!items.length) return { ok: true };

  const docs = await orderedGalleryDocs();
  let nextOrder = docs.length ? (docs[docs.length - 1].data().order as number) + 1 : 0;

  const batch = adminDb.batch();
  for (const item of items) {
    const ref = adminDb.collection("gallery").doc();
    batch.set(ref, { ...item, order: nextOrder, createdAt: new Date().toISOString() });
    nextOrder += 1;
  }
  await batch.commit();

  revalidatePath("/phototheque");
  return { ok: true };
}

export async function moveGalleryItemAction(id: string, direction: -1 | 1): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();
  const docs = await orderedGalleryDocs();
  const index = docs.findIndex((d) => d.id === id);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= docs.length) {
    return { ok: false, error: "Déplacement impossible." };
  }

  const a = docs[index];
  const b = docs[targetIndex];
  const batch = adminDb.batch();
  batch.update(a.ref, { order: b.data().order });
  batch.update(b.ref, { order: a.data().order });
  await batch.commit();

  revalidatePath("/phototheque");
  return { ok: true };
}

export async function replaceGalleryImageAction(id: string, src: string, thumb: string): Promise<{ ok: true }> {
  await verifyAdminSession();
  await adminDb.collection("gallery").doc(id).update({ src, thumb });
  revalidatePath("/phototheque");
  return { ok: true };
}

export async function deleteGalleryItemAction(id: string): Promise<{ ok: true }> {
  await verifyAdminSession();
  await adminDb.collection("gallery").doc(id).delete();
  revalidatePath("/phototheque");
  return { ok: true };
}
