"use client";

// Inscription client (addendum 2). Séquence : createUserWithEmailAndPassword
// (SDK client) → createCustomerProfileAction (Server Action, écrit
// customers/{uid} via l'Admin SDK) → /api/customer-session (pose le cookie) —
// même schéma en trois temps que la connexion admin, plus une étape puisqu'il
// y a un profil à créer.
// Pas de "Continuer avec Google" ici (contrairement à connexion/page.tsx) :
// createCustomerProfileAction exige un numéro WhatsApp valide (voir
// lib/actions/customers.ts), qu'un compte Google ne fournit jamais — créer le
// compte sans ce champ casserait le contact WhatsApp attendu partout ailleurs.
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Icon } from "@/components/icons/Icon";
import { createCustomerProfileAction } from "@/lib/actions/customers";

export default function CompteInscriptionPage() {
  const router = useRouter();
  const { sport } = useParams<{ sport: string }>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();

      const profile = await createCustomerProfileAction({ uid: credential.user.uid, idToken, name, phone });
      if (!profile.ok) {
        setError(profile.error);
        await credential.user.delete().catch(() => {});
        setLoading(false);
        return;
      }

      const res = await fetch("/api/customer-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error();
      router.push(`/${sport}/compte`);
      router.refresh();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(
        code === "auth/email-already-in-use"
          ? "Un compte existe déjà avec cet e-mail."
          : code === "auth/weak-password"
            ? "Le mot de passe doit contenir au moins 6 caractères."
            : "Échec de l'inscription. Vérifiez vos informations et réessayez."
      );
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="page-hero">
        <div className="container">
          <h1>
            <Icon name="person" size="xl" />
            Créer un compte
          </h1>
          <p>Suivez vos commandes et retrouvez votre historique.</p>
        </div>
      </div>
      <div className="section">
        <div className="container" style={{ maxWidth: 440 }}>
          <div className="contact-card">
            <h2 className="auth-heading">Vos informations</h2>
            <form onSubmit={handleSubmit} className="auth-form" aria-busy={loading}>
              {error ? (
                <p className="auth-feedback" role="alert"><Icon name="error" size="sm" />{error}</p>
              ) : null}
              <div className="auth-field">
                <label htmlFor="ciName">Nom complet</label>
                <div className="auth-input"><Icon name="person" size="sm" className="icon-lead" />
                  <input id="ciName" type="text" placeholder="Ex. Amadou Mendouga" required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
              <div className="auth-field">
                <label htmlFor="ciPhone">Numéro WhatsApp</label>
                <div className="auth-input"><Icon name="phone" size="sm" className="icon-lead" />
                  <input id="ciPhone" type="tel" placeholder="Ex. +237 655 63 42 65" required inputMode="tel" autoComplete="tel" aria-describedby="ciPhoneHint" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <p className="auth-hint" id="ciPhoneHint"><Icon name="info" size="sm" />Ajoutez l’indicatif du pays pour le suivi de livraison.</p>
              </div>
              <div className="auth-field">
                <label htmlFor="ciEmail">Adresse e-mail</label>
                <div className="auth-input"><Icon name="mail" size="sm" className="icon-lead" />
                  <input id="ciEmail" type="email" placeholder="vous@exemple.com" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="auth-field">
                <label htmlFor="ciPassword">Mot de passe</label>
                <div className="auth-input has-trail"><Icon name="lock" size="sm" className="icon-lead" />
                  <input id="ciPassword" type={showPassword ? "text" : "password"} placeholder="Créez votre mot de passe" required minLength={6} autoComplete="new-password" aria-describedby="ciPasswordHint" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="icon-trail" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>
                    <Icon name={showPassword ? "visibility-off" : "visibility"} size="sm" />
                  </button>
                </div>
                <p className="auth-hint" id="ciPasswordHint"><Icon name={password.length >= 6 ? "check-circle" : "info"} size="sm" />6 caractères minimum{password ? ` · ${password.length >= 6 ? "condition remplie" : `${6 - password.length} restant${6 - password.length > 1 ? "s" : ""}`}` : ""}</p>
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                <Icon name="add" size="sm" />
                {loading ? "Création…" : "Créer mon compte"}
              </button>

              <div className="auth-divider">ou</div>
              <Link href={`/${sport}/boutique`} className="auth-social-btn" style={{ textDecoration: "none" }}>
                <Icon name="person" size="sm" />
                Continuer sans compte
              </Link>

              <p className="form-note" style={{ textAlign: "center" }}>
                Déjà un compte ? <Link href={`/${sport}/compte/connexion`}>Se connecter</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
