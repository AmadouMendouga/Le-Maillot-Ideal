"use client";

// Navbar Menu — porté depuis js/navbar-menu.js. L'effet clé du composant
// original Aceternity est le `layoutId="active"` de Framer Motion : une
// SEULE carte, partagée entre tous les items, qui glisse et se redimensionne
// en ressort au lieu de disparaître/réapparaître. Reproduit en FLIP + Web
// Animations API avec le ressort exact (--am-spring, 616ms). La mesure
// "hors-écran" (.am-ghost) est adaptée à React : tous les panneaux sont
// pré-rendus une fois, invisibles, chacun positionné en absolute pour se
// mesurer indépendamment des autres (au lieu de construire le HTML à la
// volée comme l'original).
//
// Rendu comme un fragment (.am-items + .am-card + .am-ghost) : le composant
// parent <Navbar> possède le conteneur .am-shell et lui fournit `shellRef`,
// car le calcul de position a besoin de cet ancêtre commun.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Icon } from "@/components/icons/Icon";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { whatsappNumber } from "@/lib/cart";
import { safeColor } from "@/lib/format";
import type { League, Product, SiteSettings } from "@/lib/types";

export interface NavbarMenuProps {
  shellRef: RefObject<HTMLDivElement | null>;
  leagues: League[];
  products: Product[];
  settings: SiteSettings;
}

interface MenuDef {
  id: string;
  label: string;
  renderPanel: () => ReactNode;
}

interface Box {
  x: number;
  w: number;
  h: number;
}

const MORPH_DURATION = 616; // --am-spring-ms
const CONTENT_SWAP_DELAY = 130;
const CLOSE_DELAY = 120;

export function NavbarMenu({ shellRef, leagues, products, settings }: NavbarMenuProps) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const cardRef = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const boxRef = useRef<Box>({ x: 0, w: 0, h: 0 });
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openIdRef = useRef<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [displayedId, setDisplayedId] = useState<string | null>(null);
  const [morphing, setMorphing] = useState(false);

  const boutiquePanel = (): ReactNode => (
    <div className="am-links">
      <Link href="/boutique">
        <Icon name="grid" size="sm" />
        Tout le catalogue
      </Link>
      {settings.catalogDataVerified ? (
        <>
          <Link href="/boutique?promo=1">
            <Icon name="percent" size="sm" />
            Maillots en promotion
          </Link>
          <Link href="/boutique?stock=1">
            <Icon name="check-circle" size="sm" />
            Disponibles immédiatement
          </Link>
        </>
      ) : (
        <Link href="/boutique">
          <Icon name="info" size="sm" />
          Prix et disponibilités à confirmer
        </Link>
      )}
      <div className="am-sep" />
      <a href={`https://wa.me/${whatsappNumber(settings)}`} target="_blank" rel="noopener">
        <Icon name="chat" size="sm" />
        Commander sur WhatsApp
      </a>
    </div>
  );

  const leaguePanel = (): ReactNode =>
    leagues.length === 0 ? (
      <div className="am-links">
        <Link href="/boutique">Toute la boutique</Link>
      </div>
    ) : (
      <div className="am-products">
        {leagues.map((league) => {
          const count = products.filter((p) => p.league === league.key).length;
          return (
            <Link className="am-product" key={league.key} href={`/boutique?league=${league.key}`}>
              <span className="thumb" style={{ background: safeColor(league.color) }}>
                <Icon name="soccer" size="lg" />
                {league.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="league-logo-img"
                    src={league.logo}
                    alt=""
                    loading="lazy"
                    onError={(e) => e.currentTarget.remove()}
                  />
                )}
              </span>
              <div>
                <h4>{league.label}</h4>
                <p>
                  {count} maillot{count > 1 ? "s" : ""} en catalogue, saison 2026/2027
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    );

  const aidePanel = (): ReactNode => (
    <div className="am-links">
      <Link href="/#faq">
        <Icon name="info" size="sm" />
        Questions fréquentes
      </Link>
      <Link href="/#faq">
        <Icon name="shipping" size="sm" />
        Livraison &amp; paiement
      </Link>
      <Link href="/#faq">
        <Icon name="ruler" size="sm" />
        Guide des tailles
      </Link>
      <Link href="/#faq">
        <Icon name="swap" size="sm" />
        Retours &amp; échanges
      </Link>
      <div className="am-sep" />
      <Link href="/#contact">
        <Icon name="person" size="sm" />
        Nous contacter
      </Link>
    </div>
  );

  const menus: MenuDef[] = [
    { id: "boutique", label: "Boutique", renderPanel: boutiquePanel },
    { id: "championnats", label: "Championnats", renderPanel: leaguePanel },
    { id: "aide", label: "Aide", renderPanel: aidePanel },
  ];

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }

  function closeMenu() {
    openIdRef.current = null;
    setOpenId(null);
    setMorphing(false);
    const card = cardRef.current;
    if (card) {
      card.classList.remove("open");
      card.style.transform = `translateX(${boxRef.current.x}px) translateY(10px) scale(.85)`;
    }
  }

  function openMenu(id: string) {
    clearCloseTimer();
    const menu = menus.find((m) => m.id === id);
    const item = itemRefs.current[id];
    const ghost = ghostRefs.current[id];
    const card = cardRef.current;
    const shell = shellRef.current;
    if (!menu || !item || !ghost || !card || !shell) return;

    const ghostBox = ghost.getBoundingClientRect();
    const size = { w: Math.ceil(ghostBox.width), h: Math.ceil(ghostBox.height) };

    const shellBox = shell.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    let x = itemBox.left - shellBox.left + itemBox.width / 2 - size.w / 2;
    x = Math.max(0, Math.min(x, shellBox.width - size.w));

    const wasOpen = openIdRef.current !== null;
    openIdRef.current = id;
    setOpenId(id);

    if (!wasOpen) {
      setDisplayedId(id);
      setMorphing(false);
      card.style.width = size.w + "px";
      card.style.height = size.h + "px";
      card.style.transform = `translateX(${x}px) translateY(10px) scale(.85)`;
      card.classList.add("open");
      requestAnimationFrame(() => {
        card.style.transform = `translateX(${x}px) translateY(0) scale(1)`;
      });
      boxRef.current = { x, w: size.w, h: size.h };
      return;
    }

    if (swapTimerRef.current !== null) clearTimeout(swapTimerRef.current);

    if (reduce || typeof card.animate !== "function") {
      setDisplayedId(id);
      card.style.width = size.w + "px";
      card.style.height = size.h + "px";
      card.style.transform = `translateX(${x}px)`;
      boxRef.current = { x, w: size.w, h: size.h };
      return;
    }

    const from = boxRef.current;
    // La fonction linear() du ressort vit dans --am-spring (lmi.css) ; WAAPI
    // veut une chaîne résolue, pas une référence var() comme en CSS déclaratif.
    const springEasing =
      getComputedStyle(document.documentElement).getPropertyValue("--am-spring").trim() || "ease-out";
    setMorphing(true);
    card.animate(
      [
        { transform: `translateX(${from.x}px)`, width: from.w + "px", height: from.h + "px" },
        { transform: `translateX(${x}px)`, width: size.w + "px", height: size.h + "px" },
      ],
      { duration: MORPH_DURATION, easing: springEasing, fill: "forwards" }
    );
    swapTimerRef.current = setTimeout(() => {
      if (openIdRef.current !== id) return;
      setDisplayedId(id);
      setMorphing(false);
    }, CONTENT_SWAP_DELAY);

    card.style.width = size.w + "px";
    card.style.height = size.h + "px";
    card.style.transform = `translateX(${x}px)`;
    boxRef.current = { x, w: size.w, h: size.h };
  }

  // Fermeture au clavier (Échap), au scroll/resize, à la perte de focus de la
  // barre entière. Montés une seule fois sur la durée de vie du composant.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    function handleFocusOut(e: FocusEvent) {
      const next = e.relatedTarget as Node | null;
      if (next && shell!.contains(next)) return;
      closeMenu();
    }
    function handleKeydown(e: KeyboardEvent) {
      if (e.key !== "Escape" || !openIdRef.current) return;
      const closedId = openIdRef.current;
      closeMenu();
      itemRefs.current[closedId]?.querySelector<HTMLButtonElement>(".am-trigger")?.focus();
    }
    function handleScrollOrResize() {
      if (openIdRef.current) closeMenu();
    }
    function scheduleClose() {
      closeTimerRef.current = setTimeout(closeMenu, CLOSE_DELAY);
    }

    shell.addEventListener("mouseleave", scheduleClose);
    shell.addEventListener("mouseenter", clearCloseTimer);
    shell.addEventListener("focusout", handleFocusOut);
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      shell.removeEventListener("mouseleave", scheduleClose);
      shell.removeEventListener("mouseenter", clearCloseTimer);
      shell.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeMenu = menus.find((m) => m.id === displayedId);

  return (
    <>
      <div className="am-items">
        <div className="am-item">
          <Link className={"am-trigger" + (pathname === "/" ? " current" : "")} href="/">
            Accueil
          </Link>
        </div>
        {menus.map((menu) => (
          <div
            key={menu.id}
            className={"am-item" + (openId === menu.id ? " open" : "")}
            ref={(el) => {
              itemRefs.current[menu.id] = el;
            }}
            onMouseEnter={() => openMenu(menu.id)}
          >
            <button
              className={"am-trigger" + (openId === menu.id ? " active" : "")}
              aria-haspopup="true"
              aria-expanded={openId === menu.id}
              aria-controls="amCard"
              onClick={(e) => {
                e.preventDefault();
                if (openIdRef.current === menu.id) closeMenu();
                else openMenu(menu.id);
              }}
              onFocus={() => openMenu(menu.id)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown") return;
                e.preventDefault();
                openMenu(menu.id);
                setTimeout(() => {
                  cardRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
                }, 160);
              }}
            >
              {menu.label}
              <Icon name="expand" size="sm" className="chev" />
            </button>
          </div>
        ))}
        <div className="am-item">
          <Link
            className={"am-trigger" + (pathname === "/phototheque" ? " current" : "")}
            href="/phototheque"
            onMouseEnter={closeMenu}
          >
            Photothèque
          </Link>
        </div>
      </div>

      <div
        ref={cardRef}
        // "open" reste imposé aussi par classList.add/remove (openMenu/closeMenu,
        // synchrone, nécessaire au timing exact du FLIP à la première ouverture)
        // mais DOIT aussi dépendre de openId ici : sans ça, le prochain rendu React
        // déclenché pendant un changement de menu (setDisplayedId/setMorphing après
        // le minuteur de bascule) réécrit className depuis ce seul template et efface
        // "open" silencieusement, alors que le menu reste ouvert côté JS — panneau
        // vide en apparence. openId reste non-null tout au long d'un changement de
        // menu à un autre, donc le dériver ici referme ce trou.
        className={"am-card" + (openId ? " open" : "") + (morphing ? " morphing" : "")}
        id="amCard"
        onMouseEnter={clearCloseTimer}
      >
        <div className="am-card-inner">{activeMenu?.renderPanel()}</div>
      </div>

      <div className="am-ghost" aria-hidden="true">
        {menus.map((menu) => (
          <div
            key={menu.id}
            ref={(el) => {
              ghostRefs.current[menu.id] = el;
            }}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            {menu.renderPanel()}
          </div>
        ))}
      </div>
    </>
  );
}
