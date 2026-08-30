"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { crossFieldSiteErrors, siteFieldError, syncDeliveryThreshold } from "@/lib/validation";
import type { SiteSettings } from "@/lib/types";

const VALIDATED_FIELDS = ["whatsapp", "whatsappDisplay", "instagram", "facebook", "tiktok"] as const;

export async function updateSiteSettingsAction(
  patch: SiteSettings
): Promise<{ ok: true } | { ok: false; field: string; error: string }> {
  await verifyAdminSession();

  for (const field of VALIDATED_FIELDS) {
    const error = siteFieldError(field, patch[field], patch);
    if (error) return { ok: false, field, error };
  }

  const [testimonialsSnap, gallerySnap] = await Promise.all([
    adminDb.collection("testimonials").get(),
    adminDb.collection("gallery").get(),
  ]);
  const crossError = crossFieldSiteErrors({
    site: patch,
    testimonials: testimonialsSnap.docs.map((d) => d.data() as { name: string; quote: string; photoUrl: string }),
    gallery: gallerySnap.docs.map((d) => d.data() as { src: string }),
  });
  if (crossError) return { ok: false, field: crossError.field, error: crossError.message };

  syncDeliveryThreshold(patch);

  await adminDb.collection("settings").doc("site").set(patch);

  // Les réglages du site (coordonnées, seuil de livraison, bascules d'affichage…)
  // sont lus par la quasi-totalité des pages publiques — revalider tout l'arbre
  // du layout public plutôt qu'une liste de chemins individuels.
  revalidatePath("/", "layout");

  return { ok: true };
}
