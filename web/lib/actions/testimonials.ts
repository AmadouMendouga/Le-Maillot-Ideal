"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";

function revalidateTestimonialPages() {
  revalidatePath("/", "layout");
}

export async function addTestimonialAction(): Promise<{ ok: true; id: string }> {
  await verifyAdminSession();
  const snap = await adminDb.collection("testimonials").orderBy("order").get();
  const order = snap.size;
  const ref = await adminDb.collection("testimonials").add({ quote: "", name: "", designation: "", photoUrl: "", order });
  revalidateTestimonialPages();
  return { ok: true, id: ref.id };
}

export async function updateTestimonialAction(
  id: string,
  patch: { name: string; quote: string; designation: string }
): Promise<{ ok: true }> {
  await verifyAdminSession();
  await adminDb.collection("testimonials").doc(id).update(patch);
  revalidateTestimonialPages();
  return { ok: true };
}

export async function setTestimonialImageAction(id: string, photoUrl: string): Promise<{ ok: true }> {
  await verifyAdminSession();
  await adminDb.collection("testimonials").doc(id).update({ photoUrl });
  revalidateTestimonialPages();
  return { ok: true };
}

export async function deleteTestimonialAction(id: string): Promise<{ ok: true }> {
  await verifyAdminSession();
  await adminDb.collection("testimonials").doc(id).delete();
  revalidateTestimonialPages();
  return { ok: true };
}
