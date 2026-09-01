import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Intégration CamPay (mobile money MTN/Orange) — addendum 3 du plan. Doc API
// consultée directement sur leur Postman documenter (auth par jeton
// permanent, /api/collect/, /api/transaction/(reference)/, webhook signé).
const BASE_URL = process.env.CAMPAY_BASE_URL || "https://demo.campay.net";

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Token ${process.env.CAMPAY_PERMANENT_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.detail || body?.message || fallback;
}

export interface CampayCollectInput {
  amount: number;
  from: string;
  description: string;
  externalReference: string;
}

export interface CampayCollectResult {
  reference: string;
  ussd_code: string;
  operator: string;
}

/** Déclenche un prompt de paiement Mobile Money sur le téléphone du client. */
export async function campayCollect(input: CampayCollectInput): Promise<CampayCollectResult> {
  const res = await fetch(`${BASE_URL}/api/collect/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      amount: String(input.amount),
      currency: "XAF",
      from: input.from,
      description: input.description,
      external_reference: input.externalReference,
    }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "CamPay a refusé la demande de paiement."));
  }
  return res.json();
}

export interface CampayTransactionStatus {
  reference: string;
  external_reference: string;
  status: "PENDING" | "SUCCESSFUL" | "FAILED";
  amount: number;
  currency: string;
  operator: string;
  reason: string | null;
}

/** Filet de secours si le webhook tarde — voir checkPaymentStatusAction. */
export async function campayGetTransaction(reference: string): Promise<CampayTransactionStatus> {
  const res = await fetch(`${BASE_URL}/api/transaction/${reference}/`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Impossible de vérifier le statut du paiement."));
  }
  return res.json();
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Vérifie manuellement un JWT HS256 (pas de nouvelle dépendance — voir le
 * plan, addendum 3, section Sécurité). Ne décode pas le payload : le webhook
 * CamPay envoie déjà status/reference/amount en clair à côté de `signature`,
 * ce champ ne sert qu'à prouver que la requête vient bien de CamPay.
 */
export function verifyCampayWebhookSignature(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, signatureB64] = parts;

  const expected = base64url(createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest());
  const provided = Buffer.from(signatureB64);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return false;
  return timingSafeEqual(provided, expectedBuf);
}
