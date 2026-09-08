"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/names";
import { HeartIcon } from "@/components/products/HeartIcon";

export function BottomNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const items: { href: string; label: string; icon?: IconName; active: boolean }[] = [
    { href: basePath, label: "Accueil", icon: "storefront", active: pathname === basePath },
    { href: `${basePath}/boutique`, label: "Boutique", icon: "grid", active: pathname.includes("/boutique") || pathname.includes("/produits/") },
    { href: `${basePath}/favoris`, label: "Favoris", active: pathname.endsWith("/favoris") },
    { href: `${basePath}/compte/commandes`, label: "Commandes", icon: "shipping", active: pathname.includes("/compte/commandes") || pathname.includes("/compte/paiement") },
    { href: `${basePath}/compte`, label: "Compte", icon: "person", active: pathname.includes("/compte") && !pathname.includes("/commandes") && !pathname.includes("/paiement") },
  ];
  return (
    <nav className="ik-bottom-nav" aria-label="Navigation mobile">
      {items.map((item) => (
        <Link key={item.label} href={item.href} aria-current={item.active ? "page" : undefined}>
          <span className="ik-nav-icon">{item.icon ? <Icon name={item.icon} /> : <HeartIcon filled={item.active} />}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
