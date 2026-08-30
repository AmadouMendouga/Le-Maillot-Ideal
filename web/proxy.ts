import { NextResponse, type NextRequest } from "next/server";

/**
 * Vérification OPTIMISTE uniquement (juste la présence du cookie) — s'exécute
 * sur chaque requête, y compris les préchargements, donc pas de vérification
 * cryptographique ici (voir la doc Next.js sur Proxy). La vérification qui
 * fait réellement autorité vit dans web/lib/auth/dal.ts et s'exécute près de
 * la donnée, jamais ici.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("session");

  if (!hasSession && request.nextUrl.pathname.startsWith("/admin") && request.nextUrl.pathname !== "/admin/connexion") {
    return NextResponse.redirect(new URL("/admin/connexion", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
