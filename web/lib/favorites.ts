/** Conserve uniquement les identifiants valides et limite la taille de la sauvegarde. */
export function normalizeFavoriteSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string =>
    typeof item === "string" && item.length > 0 && item.length <= 180 && !/[\s/]/.test(item)
  ))].slice(0, 500);
}

export function toggleFavoriteSlug(slugs: string[], slug: string): string[] {
  if (!normalizeFavoriteSlugs([slug]).length) return slugs;
  return slugs.includes(slug) ? slugs.filter((item) => item !== slug) : normalizeFavoriteSlugs([...slugs, slug]);
}
