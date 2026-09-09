"use client";

// Connexion client (addendum 2) — même schéma que app/admin/connexion/page.tsx
// (Firebase Auth côté client puis cookie de session httpOnly côté serveur),
// juste posé sur /api/customer-session plutôt que /api/session.
// Champs en pilule + connexion Google + "continuer sans compte" : repère
// visuel fourni par le client le 09/09/2026. Le panier/la commande ne
// demandent déjà pas de compte (voir createOrderAction) — "continuer sans
// compte" renvoie donc simplement vers la boutique plutôt que de créer un
// mécanisme d'identité anonyme redondant.
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Icon } from "@/components/icons/Icon";
import { GoogleGlyph } from "@/components/icons/GoogleGlyph";

async function establishServerSession(idToken: string): Promise<{ ok: true; profileComplete: boolean } | { ok: false }> {
  const res = await fetch("/api/customer-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) return { ok: false };
  const data = await res.json() as { profileComplete?: boolean };
  return { ok: true, profileComplete: data.profileComplete === true };
}

export default function ComptConnexionPage() {
  const router = useRouter();
  const { sport } = useParams<{ sport: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Message identique que l'e-mail corresponde à un compte ou non — voir
  // app/admin/connexion/page.tsx pour le même choix.
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

  // Le SDK Firebase (côté client) et notre cookie de session serveur sont
  // deux mécanismes distincts. Si le cookie a expiré ou a été effacé par le
  // navigateur (ex. politique de cookies iOS) alors que Firebase se souvient
  // toujours du client, on resynchronise silencieusement plutôt que de
  // forcer une reconnexion manuelle — sans ça, la page de connexion demande
  // un mot de passe à quelqu'un que le navigateur reconnaît déjà.
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const idToken = await user.getIdToken();
        const session = await establishServerSession(idToken);
        if (session.ok && !cancelled) {
          router.push(session.profileComplete ? `/${sport}/compte` : `/${sport}/compte/profil`);
          router.refresh();
        }
      } catch {
        // La connexion manuelle reste disponible si la synchronisation échoue.
      }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [router, sport]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const session = await establishServerSession(idToken);
      if (!session.ok) throw new Error();
      router.push(session.profileComplete ? `/${sport}/compte` : `/${sport}/compte/profil`);
      router.refresh();
    } catch {
      setError("Adresse e-mail ou mot de passe incorrect.");
      setLoading(false);
    }
  }

  // Nécessite que "Google" soit activé comme fournisseur dans Firebase
  // Console → Authentication → Sign-in method (case à cocher, pas de code
  // côté serveur à écrire) — sinon Firebase répond auth/operation-not-allowed.
  async function handleGoogleSignIn() {
    if (googleLoading) return;
    setError("");
    setGoogleLoading(true);
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      const idToken = await credential.user.getIdToken();
      const session = await establishServerSession(idToken);
      if (!session.ok) throw new Error();
      router.push(session.profileComplete ? `/${sport}/compte` : `/${sport}/compte/profil`);
      router.refresh();
    } catch {
      setError("Connexion Google impossible pour le moment. Réessayez ou utilisez votre e-mail.");
      setGoogleLoading(false);
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
        <div className="container" style={{ maxWidth: 440 }}>
          <div className="contact-card">
            <h2 className="auth-heading">Se connecter</h2>
            <form onSubmit={handleSubmit}>
              {error ? (
                <p className="form-note" style={{ color: "var(--error)" }}>
                  {error}
                </p>
              ) : null}
              {resetSent ? (
                <p className="form-note" style={{ color: "var(--secondary)" }}>
                  Si un compte existe avec cette adresse, un e-mail de réinitialisation vient d&apos;être envoyé.
                </p>
              ) : null}
              <div className="auth-field">
                <Icon name="mail" size="sm" className="icon-lead" />
                <input
                  id="ccEmail"
                  type="email"
                  placeholder="E-mail"
                  aria-label="E-mail"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="auth-field has-trail">
                <Icon name="lock" size="sm" className="icon-lead" />
                <input
                  id="ccPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mot de passe"
                  aria-label="Mot de passe"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-trail"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <Icon name={showPassword ? "visibility-off" : "visibility"} size="sm" />
                </button>
              </div>
              <button type="button" className="link-btn" disabled={!email || resetting} onClick={handleForgotPassword}>
                {resetting ? "Envoi…" : "Mot de passe oublié ?"}
              </button>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                <Icon name="verified" size="sm" />
                {loading ? "Connexion…" : "Se connecter"}
              </button>

              <div className="auth-divider">ou</div>

              <button type="button" className="auth-social-btn" disabled={googleLoading} onClick={handleGoogleSignIn}>
                <GoogleGlyph />
                {googleLoading ? "Connexion…" : "Continuer avec Google"}
              </button>
              <Link href={`/${sport}/boutique`} className="auth-social-btn" style={{ textDecoration: "none" }}>
                <Icon name="person" size="sm" />
                Continuer sans compte
              </Link>

              <p className="form-note" style={{ textAlign: "center" }}>
                Pas encore de compte ? <Link href={`/${sport}/compte/inscription`}>Créer un compte</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
