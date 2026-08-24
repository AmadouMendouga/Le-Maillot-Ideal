// Protection serveur de l'administration et des fichiers internes sur le
// déploiement Vercel. Le mot de passe n'existe qu'en variable d'environnement
// (ADMIN_USER / ADMIN_PASS), jamais dans le JavaScript envoyé au client —
// voir CLAUDE.md §12 : un mot de passe côté client se lit dans l'inspecteur.
import { next } from '@vercel/functions';

export const config = {
  matcher: [
    '/admin.html',
    '/js/admin.js',
    '/css/admin.css',
    '/api/publish',
    '/package.json',
    '/package-lock.json',
  ],
};

const PROTECTED_PREFIXES = ['/admin.html', '/js/admin.js', '/css/admin.css', '/api/publish'];

function unauthorized() {
  return new Response('Authentification requise.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Administration"' },
  });
}

function notFound() {
  return new Response('Introuvable.', { status: 404 });
}

export default function middleware(request) {
  const { pathname } = new URL(request.url);

  if (!PROTECTED_PREFIXES.includes(pathname)) {
    // package.json / package-lock.json : présents pour l'installation des
    // dépendances de build, jamais destinés à être servis au public.
    return notFound();
  }

  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) {
    return unauthorized();
  }

  const authHeader = request.headers.get('authorization') || '';
  const [scheme, encoded] = authHeader.split(' ');

  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch {
      return unauthorized();
    }
    const sep = decoded.indexOf(':');
    if (sep !== -1 && decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass) {
      return next();
    }
  }

  return unauthorized();
}
