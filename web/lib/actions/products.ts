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
  league?: string;
  images?: { square?: string; wide?: string; gallery?: string[] };
}

function slugifyPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function kitSlug(kit: ProductPatch["kit"]): string {
  if (kit === "Extérieur") return "exterieur";
  if (kit === "Third") return "third";
  return "domicile";
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
  if (input.images?.gallery !== undefined) docPatch["images.gallery"] = input.images.gallery;

  if (input.league) {
    const leagueSnap = await adminDb.collection("leagues").doc(input.league).get();
    if (!leagueSnap.exists) return { ok: false, error: "Championnat invalide." };
    const league = leagueSnap.data() as { label: string; color: string };
    docPatch.league = input.league;
    docPatch.leagueLabel = league.label;
    docPatch.color = league.color;
  }

  await adminDb.collection("products").doc(input.slug).update(docPatch);

  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath(`/produits/${input.slug}`);

  return { ok: true };
}

export interface CreateProductInput extends ProductPatch {
  league: string;
  images: { square: string };
}

export async function createProductAction(
  input: CreateProductInput
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
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
  if (!input.images.square) return { ok: false, error: "Ajoutez une photo avant d'enregistrer." };

  const leagueSnap = await adminDb.collection("leagues").doc(input.league).get();
  if (!leagueSnap.exists) return { ok: false, error: "Championnat invalide." };
  const league = leagueSnap.data() as { label: string; color: string };

  const baseSlug = `maillot-${kitSlug(patch.kit)}-${slugifyPart(patch.team)}`;
  let slug = baseSlug;
  let suffix = 2;
  while ((await adminDb.collection("products").doc(slug).get()).exists) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  const discountPct =
    patch.priceOriginal > patch.price && patch.priceOriginal > 0
      ? Math.round((1 - patch.price / patch.priceOriginal) * 100)
      : 0;

  await adminDb
    .collection("products")
    .doc(slug)
    .set({
      ...patch,
      league: input.league,
      leagueLabel: league.label,
      color: league.color,
      discountPct,
      rating: null,
      reviews: 0,
      images: { square: input.images.square, wide: input.images.square, svgFallback: "" },
      updatedAt: new Date().toISOString(),
      updatedBy: admin.email || admin.uid,
    });

  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath(`/produits/${slug}`);

  return { ok: true, slug };
}
