"use client";

// Panier — porté depuis js/main.js (getCart/saveCart/addToCart/removeFromCart/
// changeQty/renderCart/initCart). Toujours localStorage côté client en Phase 1
// (pas de compte client) ; la validation (stock, tailles) réutilise lib/cart.ts,
// déjà porté verbatim.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  buildWhatsappCartLink,
  cartDetails,
  cartTotal,
  normalizeCart,
  productStock,
  stockInfo,
  type CartDetailItem,
  type CartItem,
} from "@/lib/cart";
import type { Product, SiteSettings } from "@/lib/types";

const CART_KEY = "lmi_cart_v3";
const LEGACY_CART_KEYS = ["lmi_cart_v2", "lmi_cart"];

function readStoredCart(): unknown {
  try {
    let sourceKey = CART_KEY;
    let raw = localStorage.getItem(CART_KEY);
    if (raw == null) {
      sourceKey = LEGACY_CART_KEYS.find((k) => localStorage.getItem(k) != null) ?? CART_KEY;
      raw = localStorage.getItem(sourceKey);
    }
    if (raw == null) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeStoredCart(cart: CartItem[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    LEGACY_CART_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // stockage indisponible — le panier reste fonctionnel pour la session en cours
  }
}

export interface AddToCartResult {
  ok: boolean;
  message?: string;
}

interface CartContextValue {
  hydrated: boolean;
  details: CartDetailItem[];
  count: number;
  total: number;
  isPanelOpen: boolean;
  bumpSignal: number;
  whatsappLink: string;
  barRef: RefObject<HTMLButtonElement | null>;
  addToCart: (slug: string, size: string, qty: number) => AddToCartResult;
  removeFromCart: (index: number) => void;
  changeQty: (index: number, delta: number) => void;
  openPanel: (trigger?: HTMLElement | null) => void;
  closePanel: (restoreFocus?: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé sous <CartProvider>.");
  return ctx;
}

export function CartProvider({
  children,
  products,
  settings,
}: {
  children: ReactNode;
  products: Product[];
  settings: SiteSettings;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [bumpSignal, setBumpSignal] = useState(0);
  const barRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const catalogDataVerified = settings.catalogDataVerified;

  // Lecture localStorage possible seulement après montage (absent côté serveur).
  // Toujours réécrit (pas seulement si différent) : un JSON invalide dans le
  // stockage ne lève pas d'erreur (readStoredCart l'avale), mais laissé tel
  // quel il resterait corrompu indéfiniment — la comparaison par égalité ne
  // le détecte pas puisque `raw` vaut déjà [] dans ce cas.
  useEffect(() => {
    const raw = readStoredCart();
    const normalized = normalizeCart(raw, products, catalogDataVerified);
    writeStoredCart(normalized);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation panier, ne peut pas se faire pendant le rendu (localStorage)
    setCart(normalized);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((next: CartItem[]) => {
    writeStoredCart(next);
    setCart(next);
  }, []);

  const addToCart = useCallback(
    (slug: string, size: string, qty: number): AddToCartResult => {
      const product = products.find((p) => p.slug === slug);
      if (!product) return { ok: false, message: "Produit introuvable." };

      const st = stockInfo(product, catalogDataVerified);
      if (!st.available) return { ok: false, message: `${product.name} est en rupture de stock` };

      const cleanSize = String(size || "").trim();
      const cleanQty = Math.floor(Number(qty));
      if (!product.sizes.map(String).includes(cleanSize) || !Number.isFinite(cleanQty) || cleanQty < 1) {
        return { ok: false, message: "Choisissez une taille et une quantité valides" };
      }

      const max = productStock(product, catalogDataVerified);
      const inCart = cart.filter((i) => i.slug === slug).reduce((sum, i) => sum + i.qty, 0);
      if (inCart + cleanQty > max) {
        return { ok: false, message: `Stock limité : ${max} disponible(s) pour ${product.name}` };
      }

      const existing = cart.find((i) => i.slug === slug && i.size === cleanSize);
      const next = existing
        ? cart.map((i) => (i === existing ? { ...i, qty: i.qty + cleanQty } : i))
        : [...cart, { slug, size: cleanSize, qty: cleanQty }];
      persist(next);
      setBumpSignal((n) => n + 1); // rebond de la barre — uniquement à l'ajout, pas au retrait/qté
      return { ok: true };
    },
    [cart, products, catalogDataVerified, persist]
  );

  const removeFromCart = useCallback(
    (index: number) => {
      const next = cart.filter((_, i) => i !== index);
      persist(next);
    },
    [cart, persist]
  );

  const changeQty = useCallback(
    (index: number, delta: number) => {
      const item = cart[index];
      if (!item) return;
      const product = products.find((p) => p.slug === item.slug);
      if (!product) return;
      const max = productStock(product, catalogDataVerified);
      const otherSizesQty = cart.reduce(
        (sum, other, i) => sum + (i !== index && other.slug === item.slug ? other.qty : 0),
        0
      );
      const nextQty = item.qty + delta;
      if (otherSizesQty + nextQty > max) return; // le panier reste inchangé, l'appelant peut afficher un toast
      const next = cart.map((c, i) => (i === index ? { ...c, qty: Math.max(1, nextQty) } : c));
      persist(next);
    },
    [cart, products, catalogDataVerified, persist]
  );

  const openPanel = useCallback((trigger?: HTMLElement | null) => {
    lastFocusRef.current = trigger ?? (document.activeElement as HTMLElement | null);
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback((restoreFocus = true) => {
    setIsPanelOpen(false);
    if (!restoreFocus) return;
    requestAnimationFrame(() => {
      let target = lastFocusRef.current;
      if (!target || !target.isConnected) target = document.querySelector<HTMLElement>(".cart-btn");
      target?.focus();
    });
  }, []);

  const details = useMemo(() => cartDetails(cart, products), [cart, products]);
  const count = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const total = useMemo(() => cartTotal(details), [details]);
  const whatsappLink = useMemo(() => buildWhatsappCartLink(cart, products, settings), [cart, products, settings]);

  const value: CartContextValue = {
    hydrated,
    details,
    count,
    total,
    isPanelOpen,
    bumpSignal,
    whatsappLink,
    barRef,
    addToCart,
    removeFromCart,
    changeQty,
    openPanel,
    closePanel,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
