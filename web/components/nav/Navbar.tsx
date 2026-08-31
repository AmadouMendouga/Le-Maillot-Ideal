"use client";

import { useRef } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { StatefulButton } from "@/components/StatefulButton";
import { NavbarMenu } from "@/components/nav/NavbarMenu";
import { ThemeToggle } from "@/components/nav/ThemeToggle";
import { MobileNav } from "@/components/nav/MobileNav";
import { useCart } from "@/components/cart/CartContext";
import { showToast } from "@/components/Toast";
import { whatsappNumber } from "@/lib/cart";
import type { League, Product, SiteSettings } from "@/lib/types";

export interface NavbarProps {
  leagues: League[];
  products: Product[];
  settings: SiteSettings;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function Navbar({ leagues, products, settings }: NavbarProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const waNumber = whatsappNumber(settings);
  const { count, openPanel } = useCart();

  return (
    <>
      <div className="topbar">
        <div className="container">
          <span>
            <Icon name="shipping" size="sm" /> <span>{settings.topbarInfo}</span>
          </span>
          <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener">
            <Icon name="whatsapp" size="sm" /> <span>{settings.topbarHelp}</span>
          </a>
        </div>
      </div>

      <div className="am-wrap">
        <div ref={shellRef} className="am-shell">
          <nav className="am-nav" aria-label="Navigation principale">
            <Link href="/" className="logo">
              <span className="logo-mark">
                <Icon name="soccer" size="lg" />
              </span>
              <span>
                {settings.businessName}
                <small>PORTE TA PASSION</small>
              </span>
            </Link>

            <NavbarMenu shellRef={shellRef} leagues={leagues} products={products} settings={settings} />

            <div className="header-actions">
              <Link href="/compte" className="icon-btn plain" aria-label="Mon compte">
                <Icon name="person" />
              </Link>
              <ThemeToggle />
              <button
                className="cart-btn"
                aria-label="Voir le panier"
                aria-controls="cartPanel"
                onClick={(e) => {
                  if (count === 0) {
                    showToast("Votre panier est vide", "basket");
                    return;
                  }
                  openPanel(e.currentTarget);
                }}
              >
                <Icon name="cart" /> <span className="cart-count">{count}</span>
              </button>
              <StatefulButton
                className="btn btn-whatsapp btn-sm"
                href={`https://wa.me/${waNumber}`}
                target="_blank"
                rel="noopener"
                onRun={() => wait(600)}
              >
                <Icon name="whatsapp" size="sm" />
                Commander
              </StatefulButton>
              <MobileNav />
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
