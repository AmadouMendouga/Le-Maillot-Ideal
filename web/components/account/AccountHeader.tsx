"use client";

// Bandeau « connecté en tant que... » + déconnexion, sur les pages /compte —
// même mécanique que components/admin/AdminHeader.tsx, style public.
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Icon } from "@/components/icons/Icon";

export function AccountHeader({ email, name }: { email: string | null; name?: string }) {
  const router = useRouter();
  const { sport } = useParams<{ sport: string }>();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/customer-session", { method: "DELETE" });
      await signOut(auth).catch(() => {});
    } finally {
      router.push(`/${sport}`);
      router.refresh();
    }
  }

  return (
    <div className="ik-account-header">
      <div className="ik-welcome-person"><span className="ik-avatar" aria-hidden="true">{name?.slice(0, 1).toUpperCase() || <Icon name="person" />}</span>
        <span><small>Bonjour,</small><strong>{name || email || "Bienvenue"}</strong></span>
      </div>
      <button type="button" className="btn btn-tonal btn-sm" onClick={handleLogout} disabled={loggingOut}>
        <Icon name="logout" size="sm" />
        {loggingOut ? "Déconnexion…" : "Se déconnecter"}
      </button>
    </div>
  );
}
