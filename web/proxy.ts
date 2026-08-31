import { NextResponse, type NextRequest } from "next/server";

/**
 * Vérification OPTIMISTE uniquement (juste la présence du cookie) — s'exécute
 * sur chaque requête, y compris les préchargements, donc pas de vérification
 * cryptographique ici (voir la doc Next.js sur Proxy). La vérification qui
 * fait réellement autorité vit dans web/lib/auth/dal.ts et s'exécute près de
 * la donnée, jamais ici.
 */
const COMPTE_PUBLIC_PATHS = ["/compte/connexion", "/compte/inscription"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    !request.cookies.has("session") &&
    pathname.startsWith("/admin") &&
    pathname !== "/admin/connexion"
  ) {
    return NextResponse.redirect(new URL("/admin/connexion", request.url));
  }

  if (
    !request.cookies.has("customer_session") &&
    pathname.startsWith("/compte") &&
    !COMPTE_PUBLIC_PATHS.includes(pathname)
  ) {
    return NextResponse.redirect(new URL("/compte/connexion", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/compte/:path*"],
};
