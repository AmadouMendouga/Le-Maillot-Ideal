"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons/Icon";
import { AccountSearch } from "@/components/account/AccountSearch";

export function StorefrontWelcome({ sport }: { sport: string }) {
  const [profile, setProfile] = useState<{ name: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/customer-session", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!controller.signal.aborted && data?.profile && typeof data.profile.name === "string") setProfile(data.profile); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (!profile) return null;
  return <section className="container ik-welcome" aria-label="Votre espace personnel">
    <div className="ik-welcome-row"><Link href={`/${sport}/compte`} className="ik-welcome-person">
      <span className="ik-avatar" aria-hidden="true">{profile.name.slice(0, 1).toUpperCase() || <Icon name="person" />}</span>
      <span><small>Heureux de vous retrouver</small><strong>{profile.name || "Bienvenue dans votre espace"}</strong></span>
    </Link><Link href={`/${sport}/compte/commandes`} className="ik-round-button" aria-label="Mes commandes"><Icon name="shipping" /></Link></div>
    <AccountSearch sport={sport} />
  </section>;
}
