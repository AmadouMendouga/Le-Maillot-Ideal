import { redirect } from "next/navigation";
import { verifyCustomerSession } from "@/lib/auth/dal";

// Point d'entrée du lien « Mon compte » de la navigation — redirige selon
// l'état de connexion plutôt que d'afficher quoi que ce soit lui-même.
export default async function ComptePage() {
  // redirect() lève une exception interne à Next.js — elle ne doit jamais
  // finir avalée par un catch, donc on isole la vérification (qui, elle,
  // lève une AuthError normale) avant de rediriger.
  let connected = true;
  try {
    await verifyCustomerSession();
  } catch {
    connected = false;
  }

  redirect(connected ? "/compte/commandes" : "/compte/connexion");
}
