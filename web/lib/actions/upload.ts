"use server";

// Signature à usage unique pour un upload direct navigateur → Cloudinary — voir
// le plan §1. Seul un admin authentifié (verifyAdminSession) peut obtenir une
// signature valide ; sans elle, aucun upload vers notre compte Cloudinary n'est
// possible, même garantie de sécurité que des Storage Security Rules.
import { verifyAdminSession } from "@/lib/auth/dal";
import { signUpload } from "@/lib/cloudinary";

export interface UploadSignatureParams {
  folder: string;
  publicId?: string;
  transformation?: string;
}

export interface UploadSignature extends UploadSignatureParams {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
}

export async function getUploadSignatureAction(params: UploadSignatureParams): Promise<UploadSignature> {
  await verifyAdminSession();

  const signParams: Record<string, string> = { folder: params.folder };
  if (params.publicId) signParams.public_id = params.publicId;
  if (params.transformation) signParams.transformation = params.transformation;

  const signed = signUpload(signParams);

  return {
    timestamp: signed.timestamp,
    signature: signed.signature,
    apiKey: signed.apiKey!,
    cloudName: signed.cloudName!,
    folder: params.folder,
    publicId: params.publicId,
    transformation: params.transformation,
  };
}
