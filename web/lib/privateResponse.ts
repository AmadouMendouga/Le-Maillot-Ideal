import { AuthError } from "@/lib/auth/dal";

export function privateJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
}

export function privateReadError(error: unknown) {
  return privateJson({ error: error instanceof AuthError ? "Reconnectez-vous pour continuer." : "Actualisation indisponible. Réessayez." }, error instanceof AuthError ? 401 : 503);
}
