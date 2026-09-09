"use client";

import Link from "next/link";
import { useId } from "react";
import { Icon } from "@/components/icons/Icon";

/** Reused by the account and the customer tracking link, only after server-confirmed delivery. */
export function DeliverySuccess({ summary, reviewHref, ordersHref = "/football/compte/commandes", onContinue }: { summary?: string; reviewHref?: string | null; ordersHref?: string; onContinue?: () => void }) {
  const titleId = useId();
  return <section className="ik-delivery-success" aria-labelledby={titleId}>
    <div className="ik-success-mark" aria-hidden="true"><svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="43" /><path d="m29 51 14 14 29-31" /></svg></div>
    <p className="ik-eyebrow">BIEN REÇU. À VOUS DE JOUER.</p>
    <h2 id={titleId}>Commande livrée !</h2>
    <p className="ik-muted">La remise de vos articles est confirmée.<br />Merci de faire partie de l’aventure IKIGAI.</p>
    {summary ? <p className="ik-success-summary">{summary}</p> : null}
    <div className="ik-success-actions">
      {reviewHref ? <Link href={reviewHref} className="btn btn-primary btn-block"><Icon name="star" size="sm" />Partager mon avis</Link> : null}
      {onContinue ? <button type="button" className="btn btn-tonal btn-block" onClick={onContinue}>Voir le récapitulatif<Icon name="arrow-forward" size="sm" /></button> : <Link href={ordersHref} className="btn btn-tonal btn-block">Mes commandes<Icon name="arrow-forward" size="sm" /></Link>}
    </div>
  </section>;
}
