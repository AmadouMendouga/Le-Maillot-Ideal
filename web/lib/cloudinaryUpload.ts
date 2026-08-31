// Upload direct navigateur → Cloudinary avec une signature à usage unique
// obtenue via une Server Action (getUploadSignatureAction). Le fichier binaire
// ne transite jamais par notre serveur — voir le plan §1.
import { getUploadSignatureAction, type UploadSignature, type UploadSignatureParams } from "@/lib/actions/upload";
import { getReviewUploadSignatureAction } from "@/lib/actions/orders";

export { SQUARE_TRANSFORMATION, WIDE_TRANSFORMATION } from "@/lib/cloudinaryTransforms";

async function uploadSignedFile(file: File, signed: UploadSignature): Promise<string> {
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

export async function uploadAdminImage(file: File, params: UploadSignatureParams): Promise<string> {
  const signed = await getUploadSignatureAction(params);
  return uploadSignedFile(file, signed);
}

/** Variante publique pour /avis/[token] — signature gardée par reviewToken, pas par session admin. */
export async function uploadReviewImage(file: File, token: string): Promise<string> {
  const signed = await getReviewUploadSignatureAction(token);
  if ("ok" in signed && signed.ok === false) throw new Error(signed.error);
  return uploadSignedFile(file, signed as UploadSignature);
}
