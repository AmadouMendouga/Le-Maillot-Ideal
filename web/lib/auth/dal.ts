import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebase/admin";

export class AuthError extends Error {}

/**
 * Vérification réelle et faisant autorité de la session admin — à appeler en
 * tête de chaque Server Action / Route Handler / Server Component qui touche
 * des données admin. Ne jamais se contenter de la vérification optimiste de
 * `proxy.ts` (voir sa jsdoc) : elle ne protège rien à elle seule.
 */
export const verifyAdminSession = cache(async () => {
  const sessionCookie = (await cookies()).get("session")?.value;
  if (!sessionCookie) throw new AuthError("Aucune session.");

  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    throw new AuthError("Session invalide ou expirée.");
  }

  if (decoded.admin !== true) {
    throw new AuthError("Ce compte n'a pas le rôle admin.");
  }

  return { uid: decoded.uid, email: decoded.email ?? null };
});

/** Variante pour les Server Components de page : redirige plutôt que de jeter. */
export async function requireAdminOrRedirect() {
  try {
    return await verifyAdminSession();
  } catch {
    redirect("/admin/connexion");
  }
}
