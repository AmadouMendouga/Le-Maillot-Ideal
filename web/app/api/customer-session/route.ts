import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

// Miroir de app/api/session/route.ts (admin) pour les comptes clients — cookie
// distinct (customer_session), pas de contrôle de custom claim : tout compte
// qui s'authentifie avec succès ici est un client (voir lib/auth/dal.ts).
const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 jours

export async function POST(request: Request) {
  const { idToken } = await request.json();
  if (typeof idToken !== "string" || !idToken) {
    return Response.json({ error: "idToken manquant." }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken, true);
  } catch {
    return Response.json({ error: "Jeton invalide." }, { status: 401 });
  }

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  (await cookies()).set("customer_session", sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return Response.json({ ok: true, uid: decoded.uid });
}

export async function DELETE() {
  (await cookies()).delete("customer_session");
  return Response.json({ ok: true });
}
