"use client";

// Connexion client (addendum 2) — même schéma que app/admin/connexion/page.tsx
// (Firebase Auth côté client puis cookie de session httpOnly côté serveur),
// juste posé sur /api/customer-session plutôt que /api/session, et avec un
// style public (contact-card/form-row) plutôt que le style admin.
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Icon } from "@/components/icons/Icon";

async function establishServerSession(idToken: string): Promise<boolean> {
  const res = await fetch("/api/customer-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  return res.ok;
}

export default function ComptConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Le SDK Firebase (côté client) et notre cookie de session serveur sont
  // deux mécanismes distincts. Si le cookie a expiré ou a été effacé par le
  // navigateur (ex. politique de cookies iOS) alors que Firebase se souvient
  // toujours du client, on resynchronise silencieusement plutôt que de
  // forcer une reconnexion manuelle — sans ça, la page de connexion demande
  // un mot de passe à quelqu'un que le navigateur reconnaît déjà.
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const idToken = await user.getIdToken();
      const ok = await establishServerSession(idToken);
      if (ok) {
        router.push("/compte/commandes");
        router.refresh();
      }
    });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const ok = await establishServerSession(idToken);
      if (!ok) throw new Error();
      router.push("/compte/commandes");
      router.refresh();
    } catch {
      setError("Adresse e-mail ou mot de passe incorrect.");
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="page-hero">
        <div className="container">
          <h1>
            <Icon name="person" size="xl" />
            Mon compte
          </h1>
          <p>Connectez-vous pour suivre vos commandes.</p>
        </div>
      </div>
      <div className="section">
        <div className="container" style={{ maxWidth: 480 }}>
          <div className="contact-card">
            <h3>Se connecter</h3>
            <form onSubmit={handleSubmit}>
              {error ? (
                <p className="form-note" style={{ color: "var(--error)" }}>
                  {error}
                </p>
              ) : null}
              <div className="form-row">
                <label htmlFor="ccEmail">E-mail</label>
                <input
                  id="ccEmail"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="ccPassword">Mot de passe</label>
                <input
                  id="ccPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                <Icon name="verified" size="sm" />
                {loading ? "Connexion…" : "Se connecter"}
              </button>
              <p className="form-note">
                Pas encore de compte ? <Link href="/compte/inscription">Créer un compte</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
