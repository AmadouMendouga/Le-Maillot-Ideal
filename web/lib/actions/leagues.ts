"use server";

// Gestion des championnats — jusqu'ici lecture seule (plan §1), désormais
// gérable depuis l'admin : Djimi doit pouvoir ajouter un championnat (ex.
// « Ligue 1 Cameroun ») et renommer les existants à sa guise.
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";

function slugifyKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function leagueInputError(label: string, color: string): string | null {
  if (!label) return "Le nom du championnat est obligatoire.";
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return "Couleur invalide (attendu au format #RRGGBB).";
  return null;
}

export interface LeagueInput {
  label: string;
  color: string;
  logo?: string;
}

export async function createLeagueAction(
  input: LeagueInput
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  await verifyAdminSession();

  const label = input.label.trim();
  const color = input.color.trim();
  const error = leagueInputError(label, color);
  if (error) return { ok: false, error };

  const key = slugifyKey(label);
  if (!key) return { ok: false, error: "Ce nom ne peut pas être converti en identifiant valide." };

  const ref = adminDb.collection("leagues").doc(key);
  const existing = await ref.get();
  if (existing.exists) return { ok: false, error: "Un championnat avec ce nom existe déjà." };

  await ref.set({ label, color, logo: "", teams: [] });
  revalidatePath("/", "layout");

  return { ok: true, key };
}

export async function renameLeagueAction(
  key: string,
  input: LeagueInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();

  const label = input.label.trim();
  const color = input.color.trim();
  const error = leagueInputError(label, color);
  if (error) return { ok: false, error };

  const ref = adminDb.collection("leagues").doc(key);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Championnat introuvable." };

  const patch: { label: string; color: string; logo?: string } = { label, color };
  if (input.logo !== undefined) patch.logo = input.logo;
  await ref.update(patch);

  // Les produits gardent une copie de leagueLabel/color pour un affichage
  // direct sans jointure — on les resynchronise pour que le nouveau nom
  // apparaisse partout (cartes, fiche produit, filtres) sans devoir rouvrir
  // et réenregistrer chaque maillot un par un.
  const products = await adminDb.collection("products").where("league", "==", key).get();
  if (!products.empty) {
    const batch = adminDb.batch();
    products.docs.forEach((d) => batch.update(d.ref, { leagueLabel: label, color }));
    await batch.commit();
  }

  revalidatePath("/", "layout");

  return { ok: true };
}

export async function deleteLeagueAction(key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();

  const inUse = await adminDb.collection("products").where("league", "==", key).limit(1).get();
  if (!inUse.empty) {
    return { ok: false, error: "Réaffectez d'abord les maillots de ce championnat avant de le supprimer." };
  }

  await adminDb.collection("leagues").doc(key).delete();
  revalidatePath("/", "layout");

  return { ok: true };
}
