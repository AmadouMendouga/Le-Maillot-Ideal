import { NextResponse, type NextRequest } from "next/server";

/**
 * Vérification OPTIMISTE uniquement (juste la présence du cookie) — s'exécute
 * sur chaque requête, y compris les préchargements, donc pas de vérification
 * cryptographique ici (voir la doc Next.js sur Proxy). La vérification qui
 * fait réellement autorité vit dans web/lib/auth/dal.ts et s'exécute près de
 * la donnée, jamais ici.
 */
const COMPTE_PUBLIC_SUBPATHS = ["connexion", "inscription"];

// /compte/* vit désormais sous /[sport]/compte/* (un site par sport, voir le
// plan "portail multi-sports") — le sport est un segment quelconque, donc on
// l'extrait au lieu de matcher un chemin fixe.
const COMPTE_PATH = /^\/([^/]+)\/compte(?:\/([^/]+))?/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    !request.cookies.has("session") &&
    pathname.startsWith("/admin") &&
    pathname !== "/admin/connexion"
  ) {
    return NextResponse.redirect(new URL("/admin/connexion", request.url));
  }

  const compteMatch = pathname.match(COMPTE_PATH);
  if (compteMatch && !request.cookies.has("customer_session")) {
    const [, sport, subpath] = compteMatch;
    if (!subpath || !COMPTE_PUBLIC_SUBPATHS.includes(subpath)) {
      return NextResponse.redirect(new URL(`/${sport}/compte/connexion`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/:sport/compte/:path*"],
};
