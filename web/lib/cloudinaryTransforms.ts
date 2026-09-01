// Constantes de transformation Cloudinary partagées — extraites dans leur
// propre module (plutôt que dans lib/cloudinaryUpload.ts) pour éviter un
// import circulaire : lib/actions/orders.ts en a besoin côté serveur, et
// lib/cloudinaryUpload.ts importe déjà lib/actions/orders.ts.
// c_fill + g_auto : recadrage carré avec cadrage intelligent (équivalent au
// canvas 600×600 qualité 0,82 de l'ancienne admin — CLAUDE.md §7).
export const SQUARE_TRANSFORMATION = "c_fill,g_auto,w_600,h_600,q_82,f_auto";
// c_limit : plafonne la largeur à 1400px sans recadrer (équivalent qualité 0,80).
export const WIDE_TRANSFORMATION = "c_limit,w_1400,q_80,f_auto";
// c_limit, pas de recadrage forcé : un logo de championnat n'est pas carré,
// le forcer en carré (comme SQUARE_TRANSFORMATION) couperait une partie du
// dessin. Affiché en petit (voir .league-logo-img), 240px suffit largement.
export const LOGO_TRANSFORMATION = "c_limit,w_240,h_240,q_85,f_auto";
