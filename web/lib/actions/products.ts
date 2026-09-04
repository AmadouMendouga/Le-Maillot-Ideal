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
  sport?: string;
  league?: string;
  images?: { square?: string; wide?: string; gallery?: string[] };
  reelUrl?: string;
}

function slugifyPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function updateProductAction(input: UpdateProductInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await verifyAdminSession();

  const patch: ProductPatch = {
    name: input.name.trim(),
    team: input.team.trim(),
    kit: input.kit?.trim() || undefined,
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
  if (input.reelUrl !== undefined) docPatch.reelUrl = input.reelUrl || null;

  const sportKey = input.sport;
  let sportColor: string | undefined;
  if (input.sport) {
    const sportSnap = await adminDb.collection("sports").doc(input.sport).get();
    if (!sportSnap.exists) return { ok: false, error: "Sport invalide." };
    const sport = sportSnap.data() as { label: string; color: string };
    docPatch.sport = input.sport;
    docPatch.sportLabel = sport.label;
    sportColor = sport.color;
  }

  // `league` est toujours renvoyé par le formulaire (clé réelle ou "" si aucun
  // championnat applicable) — jamais `undefined` en pratique, comme tous les
  // autres champs du patch. "" efface donc bien le championnat du produit.
  if (input.league) {
    const leagueSnap = await adminDb.collection("leagues").doc(input.league).get();
    if (!leagueSnap.exists) return { ok: false, error: "Championnat invalide." };
    const league = leagueSnap.data() as { label: string; color: string; sport: string };
    if (sportKey && league.sport !== sportKey) {
      return { ok: false, error: "Ce championnat n'appartient pas au sport sélectionné." };
    }
    docPatch.league = input.league;
    docPatch.leagueLabel = league.label;
    docPatch.color = league.color;
  } else {
    docPatch.league = null;
    docPatch.leagueLabel = null;
    if (sportColor) docPatch.color = sportColor;
  }

  await adminDb.collection("products").doc(input.slug).update(docPatch);

  // Chaque sport a son propre site (/[sport], /[sport]/boutique, /[sport]/produits/[slug]) —
  // plus simple d'invalider tout l'arbre que d'énumérer un motif par sport.
  revalidatePath("/", "layout");

  return { ok: true };
}

export interface CreateProductInput extends ProductPatch {
  sport: string;
  league?: string;
  images: { square: string };
  reelUrl?: string;
}

export async function createProductAction(
  input: CreateProductInput
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const admin = await verifyAdminSession();

  const patch: ProductPatch = {
    name: input.name.trim(),
    team: input.team.trim(),
    kit: input.kit?.trim() || undefined,
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

  const sportSnap = await adminDb.collection("sports").doc(input.sport).get();
  if (!sportSnap.exists) return { ok: false, error: "Sport invalide." };
  const sport = sportSnap.data() as { label: string; color: string };

  let league: { label: string; color: string; sport: string } | null = null;
  if (input.league) {
    const leagueSnap = await adminDb.collection("leagues").doc(input.league).get();
    if (!leagueSnap.exists) return { ok: false, error: "Championnat invalide." };
    league = leagueSnap.data() as { label: string; color: string; sport: string };
    if (league.sport !== input.sport) return { ok: false, error: "Ce championnat n'appartient pas au sport sélectionné." };
  }

  const baseSlug = [input.sport, patch.kit ? slugifyPart(patch.kit) : "", slugifyPart(patch.team)]
    .filter(Boolean)
    .join("-");
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
      sport: input.sport,
      sportLabel: sport.label,
      league: input.league || null,
      leagueLabel: league?.label || null,
      color: league?.color || sport.color,
      reelUrl: input.reelUrl || null,
      discountPct,
      rating: null,
      reviews: 0,
      images: { square: input.images.square, wide: input.images.square, svgFallback: "" },
      updatedAt: new Date().toISOString(),
      updatedBy: admin.email || admin.uid,
    });

  revalidatePath("/", "layout");

  return { ok: true, slug };
}
