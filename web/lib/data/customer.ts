import "server-only";
import { cache } from "react";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCustomerSession } from "@/lib/auth/dal";

/** Read only the profile belonging to the verified session; never accept a UID from the browser. */
export const getCustomerProfile = cache(async () => {
  const session = await verifyCustomerSession();
  const snapshot = await adminDb.collection("customers").doc(session.uid).get();
  const data = snapshot.data();
  const name = data?.name;
  return {
    name: typeof name === "string" ? name.trim().slice(0, 120) : "", email: session.email,
    phone: typeof data?.phone === "string" ? data.phone.replace(/\D/g, "").slice(0, 15) : "",
    defaultAddress: typeof data?.defaultAddress === "string" ? data.defaultAddress.trim().slice(0, 500) : "",
  };
});
