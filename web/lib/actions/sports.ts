"use server";

// Gestion des sports — axe de navigation/filtrage principal depuis la
// migration IKIGAI Sport (multi-sports). Clone du patron déjà en place pour
// les championnats (lib/actions/leagues.ts), avec deux différences : pas de
// champ "teams" (n'a pas de sens pour un sport), et la suppression doit
// vérifier qu'aucune league ni aucun produit ne référence encore ce sport.
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

function sportInputError(label: string, color: string): string | null {
  if (!label) return "Le nom du sport est obligatoire.";
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return "Couleur invalide (attendu au format #RRGGBB).";
  return null;
}

export interface SportHeroInput {
  heroBadge?: string;
  heroTitle1?: string;
  heroTitle2?: string;
  heroLead?: string;
  statDelay?: string;
  statDelayLabel?: string;
  statRating?: string;
  statRatingLabel?: string;
}

export interface SportInput extends SportHeroInput {
  label: string;
  color: string;
  logo?: string;
}

// Bandeau de démarrage raisonnable pour un sport tout juste créé — l'admin
// peut tout réécrire ensuite depuis le tiroir Sports, mais un site vide au
// premier chargement serait un mauvais signal envoyé au client final.
function heroDefaults(label: string): Required<SportHeroInput> {
  return {
    heroBadge: `Boutique ${label} au Cameroun`,
    heroTitle1: "Équipe-toi pour",
    heroTitle2: `${label}.`,
    heroLead: `Une sélection d'articles ${label} — commande sur WhatsApp, paiement selon les modalités confirmées avec vous.`,
    statDelay: "48h",
    statDelayLabel: "Délai moyen",
    statRating: "—",
    statRatingLabel: "Note moyenne",
  };
}

export async function createSportAction(
  input: SportInput
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  await verifyAdminSession();

  const label = input.label.trim();
  const color = input.color.trim();
  const error = sportInputError(label, color);
  if (error) return { ok: false, error };

  const key = slugifyKey(label);
  if (!key) return { ok: false, error: "Ce nom ne peut pas être converti en identifiant valide." };

  const ref = adminDb.collection("sports").doc(key);
  const existing = await ref.get();
  if (existing.exists) return { ok: false, error: "Un sport avec ce nom existe déjà." };

  const defaults = heroDefaults(label);
  await ref.set({
    label,
    color,
    logo: "",
    heroBadge: input.heroBadge?.trim() || defaults.heroBadge,
    heroTitle1: input.heroTitle1?.trim() || defaults.heroTitle1,
    heroTitle2: input.heroTitle2?.trim() || defaults.heroTitle2,
    heroLead: input.heroLead?.trim() || defaults.heroLead,
    statDelay: input.statDelay?.trim() || defaults.statDelay,
    statDelayLabel: input.statDelayLabel?.trim() || defaults.statDelayLabel,
    statRating: input.statRating?.trim() || defaults.statRating,
    statRatingLabel: input.statRatingLabel?.trim() || defaults.statRatingLabel,
  });
  revalidatePath("/", "layout");

  return { ok: true, key };
}

export async function renameSportAction(
  key: string,
  input: SportInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();

  const label = input.label.trim();
  const color = input.color.trim();
  const error = sportInputError(label, color);
  if (error) return { ok: false, error };

  const ref = adminDb.collection("sports").doc(key);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Sport introuvable." };

  const patch: {
    label: string;
    color: string;
    logo?: string;
    heroBadge?: string;
    heroTitle1?: string;
    heroTitle2?: string;
    heroLead?: string;
    statDelay?: string;
    statDelayLabel?: string;
    statRating?: string;
    statRatingLabel?: string;
  } = { label, color };
  if (input.logo !== undefined) patch.logo = input.logo;
  const heroKeys: (keyof SportHeroInput)[] = [
    "heroBadge",
    "heroTitle1",
    "heroTitle2",
    "heroLead",
    "statDelay",
    "statDelayLabel",
    "statRating",
    "statRatingLabel",
  ];
  for (const heroKey of heroKeys) {
    if (input[heroKey] !== undefined) patch[heroKey] = input[heroKey]!.trim();
  }
  await ref.update(patch);

  // Les produits gardent une copie de sportLabel pour un affichage direct
  // sans jointure — resynchronisée pour que le nouveau nom apparaisse
  // partout sans devoir rouvrir chaque produit un par un. `color` n'est
  // resynchronisé ici que pour les produits SANS championnat (ceux avec une
  // league gardent la couleur de leur league, jamais écrasée par le sport).
  const products = await adminDb.collection("products").where("sport", "==", key).get();
  if (!products.empty) {
    const batch = adminDb.batch();
    products.docs.forEach((d) => {
      const patchFields: { sportLabel: string; color?: string } = { sportLabel: label };
      if (!d.data().league) patchFields.color = color;
      batch.update(d.ref, patchFields);
    });
    await batch.commit();
  }

  revalidatePath("/", "layout");

  return { ok: true };
}

export async function deleteSportAction(key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await verifyAdminSession();

  const [productsInUse, leaguesInUse] = await Promise.all([
    adminDb.collection("products").where("sport", "==", key).limit(1).get(),
    adminDb.collection("leagues").where("sport", "==", key).limit(1).get(),
  ]);
  if (!productsInUse.empty) {
    return { ok: false, error: "Réaffectez d'abord les produits de ce sport avant de le supprimer." };
  }
  if (!leaguesInUse.empty) {
    return { ok: false, error: "Réaffectez d'abord les championnats de ce sport avant de le supprimer." };
  }

  await adminDb.collection("sports").doc(key).delete();
  revalidatePath("/", "layout");

  return { ok: true };
}
