import { getSharedLocationViewAction } from "@/lib/actions/orders";
import { privateJson } from "@/lib/privateResponse";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{8,160}$/.test(token)) return privateJson({ ok: false, error: "Lien invalide." }, 404);
  try {
    const view = await getSharedLocationViewAction(token);
    return privateJson(view, view.ok ? 200 : 404);
  } catch { return privateJson({ ok: false, error: "Le suivi n’a pas pu être actualisé." }, 503); }
}
