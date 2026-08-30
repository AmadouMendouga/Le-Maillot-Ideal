import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 jours

export async function POST(request: Request) {
  const { idToken } = await request.json();
  if (typeof idToken !== "string" || !idToken) {
    return Response.json({ error: "idToken manquant." }, { status: 400 });
  }

  let decoded;
  try {
    // requireFreshLogin=true : le jeton doit dater de moins de 5 minutes.
    decoded = await adminAuth.verifyIdToken(idToken, true);
  } catch {
    return Response.json({ error: "Jeton invalide." }, { status: 401 });
  }

  if (decoded.admin !== true) {
    return Response.json({ error: "Ce compte n'a pas le rôle admin." }, { status: 403 });
  }

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  (await cookies()).set("session", sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete("session");
  return Response.json({ ok: true });
}
