"use client";

// Porté depuis admin-src/src/components/layout/Tabs.jsx. Différence avec
// l'original : de vraies routes Next.js (bookmarkables) plutôt qu'un simple état
// React — il n'y a plus de raison de s'en priver une fois sorti du monde SPA.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/names";

interface TabDef {
  href: string;
  label: string;
  icon: IconName;
  countKey?: "products" | "gallery" | "testimonials" | "orders";
}

const TABS: TabDef[] = [
  { href: "/admin/apercu", label: "Vue d’ensemble", icon: "grid" },
  { href: "/admin/commandes", label: "Commandes", icon: "shipping", countKey: "orders" },
  { href: "/admin", label: "Produits", icon: "inventory", countKey: "products" },
  { href: "/admin/galerie", label: "Photos", icon: "photo-library", countKey: "gallery" },
  { href: "/admin/avis", label: "Avis clients", icon: "star", countKey: "testimonials" },
  { href: "/admin/textes", label: "Textes du site", icon: "edit" },
];

export function AdminTabs({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav className="adm-tabs" aria-label="Administration">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined} className={"adm-tab" + (pathname === tab.href ? " active" : "")}>
          <Icon name={tab.icon} size="sm" />
          <span>{tab.label}</span>
          {tab.countKey ? <span className="cnt">{counts[tab.countKey]}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
