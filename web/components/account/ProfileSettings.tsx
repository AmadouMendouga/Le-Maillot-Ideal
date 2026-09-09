"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sendPasswordResetEmail, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { updateCustomerProfileAction } from "@/lib/actions/customers";
import { Icon } from "@/components/icons/Icon";

interface Profile { name: string; email: string | null; phone: string; defaultAddress: string }

function ThemePreference() {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.dataset.theme || "light");
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    sync();
    return () => observer.disconnect();
  }, []);
  function choose(value: string) {
    document.documentElement.dataset.theme = value;
    setTheme(value);
    try { localStorage.setItem("lmi_theme", value); } catch { /* The selected theme still applies for this session. */ }
  }
  return <div className="ik-profile-row"><Icon name="dark-mode" /><span><strong>Apparence</strong><small>Choisissez votre ambiance</small></span><div className="ik-theme-choice" role="group" aria-label="Thème de l’application"><button type="button" aria-pressed={theme === "light"} onClick={() => choose("light")}><Icon name="light-mode" size="sm" />Clair</button><button type="button" aria-pressed={theme === "dark"} onClick={() => choose("dark")}><Icon name="dark-mode" size="sm" />Sombre</button></div></div>;
}

export function ProfileSettings({ initialProfile, sport, supportPhone }: { initialProfile: Profile; sport: string; supportPhone: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [defaultAddress, setAddress] = useState(profile.defaultAddress);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const result = await updateCustomerProfileAction({ name, phone, defaultAddress });
      if (!result.ok) { setError(result.error); return; }
      setProfile((previous) => ({ ...previous, ...result.profile }));
      setName(result.profile.name); setPhone(result.profile.phone); setAddress(result.profile.defaultAddress);
      setMessage("Vos informations sont enregistrées.");
    } catch { setError("Enregistrement non confirmé. Vérifiez votre connexion et réessayez."); }
    finally { setSaving(false); }
  }
  async function resetPassword() {
    if (!profile.email || resetting) return;
    setResetting(true); setResetMessage("");
    try {
      await sendPasswordResetEmail(auth, profile.email);
      setResetMessage("Si cette adresse permet de réinitialiser votre mot de passe, un e-mail vous sera envoyé. Vérifiez aussi vos courriers indésirables.");
    } catch { setResetMessage("La demande n’a pas abouti. Réessayez dans quelques instants."); }
    finally { setResetting(false); }
  }
  async function logout() {
    setLoggingOut(true); setError("");
    try {
      const response = await fetch("/api/customer-session", { method: "DELETE" });
      if (!response.ok) throw new Error("session");
      await signOut(auth).catch(() => {});
      router.push(`/${sport}`); router.refresh();
    } catch { setError("Impossible de vous déconnecter. Réessayez."); setLoggingOut(false); }
  }
  const initials = profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <>
    <header className="ik-account-page-title"><div><p className="ik-eyebrow">VOTRE ESPACE PERSONNEL</p><h1>Mon compte</h1></div><Link href={`/${sport}/compte`} className="ik-round-button" aria-label="Mon accueil personnel"><Icon name="grid" /></Link></header>
    <div className="ik-profile-identity"><span className="ik-profile-avatar" aria-hidden="true">{initials || <Icon name="person" />}</span><div><h2>{profile.name || "Bienvenue chez IKIGAI"}</h2><p>{profile.email || "Compte IKIGAI Sport"}</p></div><Icon name="verified" /></div>
    <section className="ik-profile-group"><h2>Mon compte</h2><div className="ik-profile-group-card">
      <details className="ik-profile-edit"><summary className="ik-profile-row"><Icon name="person" /><span><strong>Mes informations</strong><small>Nom, téléphone et adresse de livraison</small></span><Icon name="expand" size="sm" /></summary><form onSubmit={save} className="ik-profile-form">
        <label htmlFor="profileName">Nom complet</label><input id="profileName" autoComplete="name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
        <label htmlFor="profilePhone">Téléphone avec indicatif du pays</label><input id="profilePhone" type="tel" autoComplete="tel" required maxLength={22} placeholder="237…" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <label htmlFor="profileAddress">Adresse habituelle de livraison</label><textarea id="profileAddress" autoComplete="street-address" maxLength={500} rows={3} placeholder="Ville, quartier et point de repère" value={defaultAddress} onChange={(event) => setAddress(event.target.value)} /><p className="ik-muted">Cette adresse sera utilisée pour vos prochaines commandes. Pour une commande déjà passée, contactez-nous depuis son détail.</p>
        {message ? <p role="status" className="ik-profile-feedback">{message}</p> : null}
        <button type="submit" className="btn btn-primary btn-block" disabled={saving}><Icon name="save" size="sm" />{saving ? "Enregistrement…" : "Enregistrer mes informations"}</button>
      </form></details>
      <details><summary className="ik-profile-row"><Icon name="lock" /><span><strong>Mot de passe et sécurité</strong><small>Protégez l’accès à votre compte</small></span><Icon name="expand" size="sm" /></summary><div className="ik-profile-form"><p className="ik-muted">Recevez un lien à votre adresse e-mail pour choisir un nouveau mot de passe. Si vous utilisez Google, vous pouvez aussi continuer à vous connecter avec Google.</p><button type="button" className="btn btn-tonal btn-block" disabled={!profile.email || resetting} onClick={resetPassword}><Icon name="mail" size="sm" />{resetting ? "Demande en cours…" : "Recevoir un lien de réinitialisation"}</button>{resetMessage ? <p role="status" className="ik-muted">{resetMessage}</p> : null}</div></details>
      <Link href={`/${sport}/compte/commandes`} className="ik-profile-row"><Icon name="shipping" /><span><strong>Mes commandes</strong><small>En cours, planifiées et historique</small></span><Icon name="chevron-right" size="sm" /></Link>
    </div></section>
    <section className="ik-profile-group"><h2>Mes préférences</h2><div className="ik-profile-group-card"><ThemePreference /><Link href={`/${sport}/favoris`} className="ik-profile-row"><Icon name="star" /><span><strong>Mes favoris</strong><small>Vos articles enregistrés sur cet appareil</small></span><Icon name="chevron-right" size="sm" /></Link></div></section>
    <section className="ik-profile-group"><h2>Un coup de main ?</h2><div className="ik-profile-group-card"><Link href={`/${sport}/#faq`} className="ik-profile-row"><Icon name="info" /><span><strong>Centre d’aide</strong><small>Livraison, paiement et questions fréquentes</small></span><Icon name="chevron-right" size="sm" /></Link>{supportPhone ? <a href={`https://wa.me/${supportPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="ik-profile-row"><Icon name="chat" /><span><strong>Contacter IKIGAI Sport</strong><small>Échangez avec notre équipe</small></span><Icon name="arrow-forward" size="sm" /></a> : null}</div></section>
    {error ? <p className="ik-inline-warning" role="alert">{error}</p> : null}
    <button type="button" className="ik-profile-logout" onClick={logout} disabled={loggingOut}><Icon name="logout" />{loggingOut ? "Déconnexion…" : "Se déconnecter"}</button>
    <p className="ik-profile-signature">IKIGAI SPORT · Trouvez votre mouvement.</p>
  </>;
}
