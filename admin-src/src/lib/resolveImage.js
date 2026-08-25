// Les chemins d'image stockés dans les données (window.PRODUCTS/GALLERY/
// TESTIMONIALS, ex. "images/photos/photo-01.jpg") sont relatifs à la racine
// du site, pas à la page courante. Sous l'ancien admin.html (servi à la
// racine), une URL relative suffisait ; sous /admin/ (avec le slash final),
// le navigateur les résout par rapport à /admin/ et casse tout. On force
// donc un chemin absolu ici, une seule fois, plutôt que dans chaque
// composant.
export function resolveImageSrc(newImages, path) {
  const draft = newImages[path];
  if (draft) return draft;
  if (!path) return path;
  return path.startsWith("/") || path.startsWith("data:") ? path : "/" + path;
}
