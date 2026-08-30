"use server";

// Seule porte d'écriture pour les produits — remplace le flux "commit Git" de
// l'ancienne admin (CLAUDE.md §12). Toute mutation passe par l'Admin SDK
// (contourne les Security Rules) après vérification de la session admin.
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { productPatchError, type ProductPatch } from "@/lib/validation";

export interface UpdateProductInput extends ProductPatch {
  slug: string;
  images?: { square?: string; wide?: string };
}

export async function updateProductAction(input: UpdateProductInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await verifyAdminSession();

  const patch: ProductPatch = {
    name: input.name.trim(),
    team: input.team.trim(),
    kit: input.kit,
    price: Number(input.price),
    priceOriginal: Number(input.priceOriginal),
    stock: Number(input.stock),
    season: input.season.trim(),
    description: input.description.trim(),
    sizes: input.sizes,
    kidsAvailable: input.kidsAvailable,
    isNew: input.isNew,
  };

  const error = productPatchError(patch);
  if (error) return { ok: false, error };

  const discountPct =
    patch.priceOriginal > patch.price && patch.priceOriginal > 0
      ? Math.round((1 - patch.price / patch.priceOriginal) * 100)
      : 0;

  const docPatch: Record<string, unknown> = {
    ...patch,
    discountPct,
    updatedAt: new Date().toISOString(),
    updatedBy: admin.email || admin.uid,
  };
  if (input.images?.square) docPatch["images.square"] = input.images.square;
  if (input.images?.wide) docPatch["images.wide"] = input.images.wide;

  await adminDb.collection("products").doc(input.slug).update(docPatch);

  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath(`/produits/${input.slug}`);

  return { ok: true };
}
