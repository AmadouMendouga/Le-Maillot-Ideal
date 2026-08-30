import type { Metadata } from "next";
import "./lmi.css";
import { IconSprite } from "@/components/icons/IconSprite";
import { ToastHost } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Le Maillot Idéal",
  description: "Boutique de maillots de football au Cameroun.",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("lmi_theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <IconSprite />
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
