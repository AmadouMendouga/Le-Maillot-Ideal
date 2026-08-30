"use client";

// Connexion admin — Firebase Auth côté client (signInWithEmailAndPassword) puis
// pose d'un cookie de session httpOnly via /api/session (voir CLAUDE.md §12 :
// ne jamais vérifier un rôle/mot de passe dans du code exécuté côté navigateur —
// c'est app/api/session/route.ts, côté serveur, qui fait réellement autorité).
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Icon } from "@/components/icons/Icon";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connexion refusée.");
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Adresse e-mail ou mot de passe incorrect.");
      setLoading(false);
    }
  }

  return (
    <div className="adm-login-wrap">
      <form className="adm-login-card" onSubmit={handleSubmit}>
        <span className="logo-mark">
          <Icon name="soccer" size="lg" />
        </span>
        <h1>Administration</h1>
        <p className="sub">Le Maillot Idéal</p>

        {error ? (
          <div className="adm-login-error">
            <Icon name="error" size="sm" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="adm-field">
          <label htmlFor="admEmail">E-mail</label>
          <input
            id="admEmail"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="adm-field">
          <label htmlFor="admPassword">Mot de passe</label>
          <input
            id="admPassword"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          <Icon name="verified" size="sm" />
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
