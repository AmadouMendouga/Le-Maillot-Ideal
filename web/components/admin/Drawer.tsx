"use client";

// Tiroir d'édition modal — porté depuis admin-src/src/components/shared/Drawer.jsx
// (lui-même porté de l'ancien js/admin.js, piège de focus inclus). Pas de <dialog>
// natif : on a besoin de contrôler `inert`/`aria-hidden` explicitement.
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/names";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  titleIcon?: IconName;
  title?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Drawer({ open, onClose, titleIcon = "edit", title, children, footer }: DrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      lastFocusRef.current = document.activeElement;
      const raf = requestAnimationFrame(() => closeButtonRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    const target = lastFocusRef.current as HTMLElement | null;
    if (target && typeof target.focus === "function" && document.contains(target)) target.focus();
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeydown(e: KeyboardEvent) {
      const drawer = drawerRef.current;
      if (!drawer) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.getClientRects().length > 0);
      if (!focusable.length) {
        e.preventDefault();
        drawer.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, onClose]);

  return (
    <>
      <div className={"adm-overlay" + (open ? " open" : "")} onClick={onClose} />
      <aside
        ref={drawerRef}
        className={"adm-drawer" + (open ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-labelledby="admDrawerTitle"
        tabIndex={-1}
        inert={!open}
      >
        <div className="adm-drawer-head">
          <Icon name={titleIcon} size="lg" />
          <span id="admDrawerTitle">{title}</span>
          <button ref={closeButtonRef} type="button" className="icon-btn plain close" aria-label="Fermer" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="adm-drawer-body">{children}</div>
        {footer ? <div className="adm-drawer-foot">{footer}</div> : null}
      </aside>
    </>
  );
}
