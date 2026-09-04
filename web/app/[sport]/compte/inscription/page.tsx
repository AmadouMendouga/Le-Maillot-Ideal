"use client";

// Inscription client (addendum 2). Séquence : createUserWithEmailAndPassword
// (SDK client) → createCustomerProfileAction (Server Action, écrit
// customers/{uid} via l'Admin SDK) → /api/customer-session (pose le cookie) —
// même schéma en trois temps que la connexion admin, plus une étape puisqu'il
// y a un profil à créer.
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
      router.push(`/${sport}/compte/commandes`);
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
        <div className="container" style={{ maxWidth: 480 }}>
          <div className="contact-card">
            <h3>Vos informations</h3>
            <form onSubmit={handleSubmit}>
              {error ? (
                <p className="form-note" style={{ color: "var(--error)" }}>
                  {error}
                </p>
              ) : null}
              <div className="form-row">
                <label htmlFor="ciName">Nom complet</label>
                <input id="ciName" type="text" required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="ciPhone">Numéro WhatsApp</label>
                <input
                  id="ciPhone"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="237655634265"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="ciEmail">E-mail</label>
                <input id="ciEmail" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="ciPassword">Mot de passe</label>
                <input
                  id="ciPassword"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                <Icon name="add" size="sm" />
                {loading ? "Création…" : "Créer mon compte"}
              </button>
              <p className="form-note">
                Déjà un compte ? <Link href={`/${sport}/compte/connexion`}>Se connecter</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
