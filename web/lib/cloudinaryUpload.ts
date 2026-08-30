// Upload direct navigateur → Cloudinary avec une signature à usage unique
// obtenue via une Server Action (getUploadSignatureAction). Le fichier binaire
// ne transite jamais par notre serveur — voir le plan §1.
import { getUploadSignatureAction, type UploadSignatureParams } from "@/lib/actions/upload";

// c_fill + g_auto : recadrage carré avec cadrage intelligent (équivalent au
// canvas 600×600 qualité 0,82 de l'ancienne admin — CLAUDE.md §7).
export const SQUARE_TRANSFORMATION = "c_fill,g_auto,w_600,h_600,q_82,f_auto";
// c_limit : plafonne la largeur à 1400px sans recadrer (équivalent qualité 0,80).
export const WIDE_TRANSFORMATION = "c_limit,w_1400,q_80,f_auto";

export async function uploadAdminImage(file: File, params: UploadSignatureParams): Promise<string> {
  const signed = await getUploadSignatureAction(params);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("folder", signed.folder);
  if (signed.publicId) form.append("public_id", signed.publicId);
  if (signed.transformation) form.append("transformation", signed.transformation);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || "Échec de l'envoi de l'image vers Cloudinary.");
  }
  const data = await res.json();
  return data.secure_url as string;
}
