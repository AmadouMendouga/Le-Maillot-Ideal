"use client";

// Porté depuis admin-src/src/components/layout/AdminHeader.jsx.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Icon } from "@/components/icons/Icon";
import { ThemeToggle } from "@/components/nav/ThemeToggle";

export function AdminHeader({ email }: { email: string | null }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/session", { method: "DELETE" });
      await signOut(auth).catch(() => {});
    } finally {
      router.push("/admin/connexion");
      router.refresh();
    }
  }

  return (
    <header className="adm-header">
      <div className="container">
        <Link href="/" className="logo">
          <span className="logo-mark">
            <Icon name="soccer" size="lg" />
          </span>
          <span>
            Le Maillot Idéal
            <small>ADMINISTRATION</small>
          </span>
        </Link>
        <span className="adm-badge">{email || "Connecté"}</span>

        <div className="adm-actions">
          <ThemeToggle />
          <a className="btn btn-outline btn-sm" href="/" target="_blank" rel="noopener">
            <Icon name="visibility" size="sm" />
            Voir le site
          </a>
          <button type="button" className="btn btn-tonal btn-sm" onClick={handleLogout} disabled={loggingOut}>
            <Icon name="logout" size="sm" />
            {loggingOut ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      </div>
    </header>
  );
}
