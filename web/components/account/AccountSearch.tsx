import Link from "next/link";
import { Icon } from "@/components/icons/Icon";

export function AccountSearch({ sport }: { sport: string }) {
  return <form action={`/${sport}/boutique`} method="get" className="ik-account-search" role="search">
    <label className="ik-account-search-field"><Icon name="search" /><span className="sr-only">Rechercher un article</span><input name="q" type="search" placeholder="Rechercher un article, une équipe…" /></label>
    <button type="submit" className="ik-search-submit" aria-label="Rechercher"><Icon name="arrow-forward" /></button>
    <Link href={`/${sport}/boutique#catalogFilters`} className="ik-search-filter" aria-label="Explorer et filtrer le catalogue"><Icon name="tune" /></Link>
  </form>;
}
