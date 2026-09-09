"use client";

// Connexion admin — Firebase Auth côté client (signInWithEmailAndPassword) puis
// pose d'un cookie de session httpOnly via /api/session (voir CLAUDE.md §12 :
// ne jamais vérifier un rôle/mot de passe dans du code exécuté côté navigateur —
// c'est app/api/session/route.ts, côté serveur, qui fait réellement autorité).
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Icon } from "@/components/icons/Icon";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Message volontairement identique que l'e-mail existe ou non côté Firebase
  // (auth/user-not-found inclus) — sinon ce formulaire permettrait de deviner
  // quelles adresses ont un accès admin.
  async function handleForgotPassword() {
    if (!email || resetting) return;
    setResetting(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
    } catch {
      // best effort — même message dans tous les cas, voir commentaire ci-dessus
    } finally {
      setResetting(false);
      setResetSent(true);
    }
  }

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
      router.push("/admin/apercu");
      router.refresh();
    } catch {
      setError("Adresse e-mail ou mot de passe incorrect.");
      setLoading(false);
    }
  }

  return (
    <div className="adm-login-wrap">
      <form className="adm-login-card auth-form" onSubmit={handleSubmit} aria-busy={loading}>
        <span className="logo-mark">
          <Icon name="storefront" size="lg" />
        </span>
        <h1 className="auth-heading" style={{ marginBottom: 2 }}>Administration</h1>
        <p className="sub">IKIGAI Sport</p>

        {error ? (
          <div className="adm-login-error" id="admAuthError" role="alert">
            <Icon name="error" size="sm" />
            <span>{error}</span>
          </div>
        ) : null}
        {resetSent ? (
          <div className="adm-login-error" role="status" style={{ background: "var(--secondary-container)", color: "var(--on-secondary-container)" }}>
            <Icon name="check-circle" size="sm" />
            <span>Si un compte admin existe avec cette adresse, un e-mail de réinitialisation vient d&apos;être envoyé.</span>
          </div>
        ) : null}

        <div className="auth-field">
          <label htmlFor="admEmail">Adresse e-mail</label>
          <div className="auth-input"><Icon name="mail" size="sm" className="icon-lead" />
            <input id="admEmail" type="email" placeholder="admin@exemple.com" autoComplete="username" required aria-invalid={Boolean(error)} aria-describedby={error ? "admAuthError" : undefined} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="auth-field">
          <label htmlFor="admPassword">Mot de passe</label>
          <div className="auth-input has-trail"><Icon name="lock" size="sm" className="icon-lead" />
            <input id="admPassword" type={showPassword ? "text" : "password"} placeholder="Votre mot de passe" autoComplete="current-password" required aria-invalid={Boolean(error)} aria-describedby={error ? "admAuthError" : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="icon-trail" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>
              <Icon name={showPassword ? "visibility-off" : "visibility"} size="sm" />
            </button>
          </div>
        </div>

        <button type="button" className="link-btn" disabled={!email || resetting} onClick={handleForgotPassword}>
          {resetting ? "Envoi…" : "Mot de passe oublié ?"}
        </button>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          <Icon name="verified" size="sm" />
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
