"use server";

// Comptes clients (addendum 2 du plan). Seule porte d'écriture pour
// customers/{uid} — le SDK client ne peut jamais y écrire (firestore.rules).
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { verifyCustomerSession } from "@/lib/auth/dal";

export interface CreateCustomerProfileInput {
  uid: string;
  idToken: string;
  name: string;
  phone: string;
}

export async function updateCustomerProfileAction(input: { name: string; phone: string; defaultAddress: string }): Promise<{ ok: true; profile: { name: string; phone: string; defaultAddress: string } } | { ok: false; error: string }> {
  const session = await verifyCustomerSession();
  if (!input || typeof input.name !== "string" || typeof input.phone !== "string" || typeof input.defaultAddress !== "string") return { ok: false, error: "Informations invalides." };
  const name = input.name.trim();
  const phone = input.phone.replace(/\D/g, "");
  const defaultAddress = input.defaultAddress.trim();
  if (!name || name.length > 120) return { ok: false, error: "Indiquez votre nom (120 caractères maximum)." };
  if (phone.length < 8 || phone.length > 15) return { ok: false, error: "Indiquez un numéro de 8 à 15 chiffres, avec l’indicatif du pays." };
  if (defaultAddress.length > 500) return { ok: false, error: "L’adresse doit contenir 500 caractères maximum." };
  const profile = { name, phone, defaultAddress };
  await adminDb.collection("customers").doc(session.uid).set({ ...profile, updatedAt: new Date().toISOString() }, { merge: true });
  return { ok: true, profile };
}

// Appelée juste après createUserWithEmailAndPassword côté client, avant la
// pose du cookie de session — on revérifie l'idToken ici plutôt que de faire
// confiance à l'uid envoyé tel quel (même garde que verifyCustomerSession,
// mais il n'y a pas encore de cookie à ce stade de l'inscription).
export async function createCustomerProfileAction(
  input: CreateCustomerProfileInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(input.idToken, true);
  } catch {
    return { ok: false, error: "Session invalide." };
  }
  if (decoded.uid !== input.uid) {
    return { ok: false, error: "Session invalide." };
  }

  const name = input.name.trim();
  const phone = input.phone.replace(/\D/g, "");
  if (!name) return { ok: false, error: "Le nom complet est obligatoire." };
  if (phone.length < 8 || phone.length > 15) {
    return { ok: false, error: "Le numéro WhatsApp doit contenir 8 à 15 chiffres." };
  }

  await adminDb.collection("customers").doc(input.uid).set({
    name,
    phone,
    createdAt: new Date().toISOString(),
  });

  return { ok: true };
}
