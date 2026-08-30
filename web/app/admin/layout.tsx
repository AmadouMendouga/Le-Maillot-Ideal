import type { Metadata } from "next";
import "./admin.css";

// css/admin.css (copié ici) est la seule exception à la règle « un seul
// fichier CSS » du site public (CLAUDE.md §12) : ces styles ne doivent pas
// être livrés aux visiteurs, donc importés uniquement sous /admin.
export const metadata: Metadata = {
  title: "Administration | Le Maillot Idéal",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="adm-body">{children}</div>;
}
