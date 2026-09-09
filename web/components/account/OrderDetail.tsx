"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { FCFA } from "@/lib/cart";
import { customerOrderMessage, type CustomerOrderView } from "@/lib/customerOrderView";
import { ORDER_STATUS_LABELS, TERMINAL_ORDER_STATUSES } from "@/lib/orderWorkflow";
import { openCustomerTrackingAction } from "@/lib/actions/customerTracking";
import { usePrivatePolling } from "@/lib/hooks/usePrivatePolling";
import { OrderTimeline, orderDate } from "@/components/account/OrderTimeline";
import { DeliverySuccess } from "@/components/account/DeliverySuccess";

function DeliveryCode({ code }: { code: string }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    let disposed = false;
    import("qrcode").then((module) => module.toDataURL(code, { width: 220, margin: 1, errorCorrectionLevel: "M" }))
      .then((value) => { if (!disposed) setQr(value); }).catch(() => {});
    return () => { disposed = true; };
  }, [code]);
  return <details className="ik-remise-ticket"><summary><Icon name="qr-scanner" /><span>Mon code de remise<small>À montrer quand vous recevez vos articles</small></span><Icon name="expand" size="sm" /></summary>
    <div>{qr ? (
      // eslint-disable-next-line @next/next/no-img-element -- local QR data URL
      <img src={qr} width={180} height={180} alt="QR de votre code de remise" />
    ) : null}<strong className="ik-ticket-code" aria-label={`Code de remise : ${code.split("").join(" ")}`}>{code}</strong><p className="ik-muted">Présentez le QR ou donnez ces quatre chiffres au livreur lors de la remise. Gardez-les pour vous jusque-là.</p></div>
  </details>;
}

function ConfirmationDialog({ order, onClose }: { order: CustomerOrderView; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="ik-success-dialog" aria-label="Commande livrée" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <button type="button" className="ik-round-button ik-success-close" onClick={onClose} aria-label="Fermer la confirmation"><Icon name="close" /></button>
    <DeliverySuccess summary={order.summary} reviewHref={order.reviewHref} onContinue={onClose} />
  </dialog>;
}

function pollingInterval(order: CustomerOrderView) {
  return TERMINAL_ORDER_STATUSES.has(order.status) ? 0 : ["en_route", "arrivee"].includes(order.status) ? 6000 : 20000;
}

export function OrderDetail({ initialOrder, sport, supportPhone }: { initialOrder: CustomerOrderView; sport: string; supportPhone: string }) {
  const router = useRouter();
  const { data: order, warning, refreshing, updatedAt, refresh } = usePrivatePolling(`/api/customer/orders?orderId=${encodeURIComponent(initialOrder.id)}`, initialOrder, pollingInterval);
  const [dismissed, setDismissed] = useState(false);
  const celebrate = initialOrder.status !== "livree" && order.status === "livree" && !dismissed;
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  async function openTracking() {
    setOpening(true); setError("");
    try {
      const result = await openCustomerTrackingAction(order.id);
      if (!result.ok) { setError(result.error); void refresh(); return; }
      router.push(result.href);
    } catch { setError("Le suivi n’a pas pu s’ouvrir. Réessayez."); }
    finally { setOpening(false); }
  }
  const active = order.status === "en_route" || order.status === "arrivee";
  const payments = { paid: "Paiement reçu", unpaid: "Paiement à convenir", pending: "Paiement en cours de vérification", failed: "Paiement non abouti", review: "Paiement reçu, vérification en cours" };
  return <>
    <div className="ik-order-detail-top"><Link href={`/${sport}/compte/commandes`} className="ik-round-button" aria-label="Retour à mes commandes"><Icon name="arrow-back" /></Link><div><p className="ik-eyebrow">MA COMMANDE</p><h1>#{order.id.slice(-6).toUpperCase()}</h1></div><button type="button" className="ik-round-button" onClick={() => void refresh()} disabled={refreshing} aria-label="Actualiser le statut"><Icon name="refresh" /></button></div>
    <p className="ik-order-sync" role="status">{warning || (refreshing ? "Actualisation…" : updatedAt ? `Actualisé à ${new Date(updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Le statut se met à jour automatiquement sur cette page.")}</p>
    {order.status === "livree" ? <DeliverySuccess summary={order.summary} reviewHref={order.reviewHref} ordersHref={`/${sport}/compte/commandes`} /> : <section className={`ik-order-state ik-order-state--${order.status}`} aria-live="polite"><span className="ik-order-parcel"><Icon name={active ? "shipping" : order.status === "annulee" || order.status === "reportee" ? "info" : "inventory"} /></span><div><span className="ik-eyebrow">{order.deliverySlot ? "VOTRE LIVRAISON" : "ÉTAT ACTUEL"}</span><h2>{ORDER_STATUS_LABELS[order.status]}</h2><p>{customerOrderMessage(order)}</p></div></section>}
    {order.status !== "livree" && order.deliverySlot ? <p className="ik-order-slot"><Icon name="schedule" />Créneau convenu : {order.deliverySlot}</p> : null}
    <div className="ik-order-detail-grid"><section className="ik-order-card"><div className="ik-section-label"><h2>Le parcours de votre commande</h2><Icon name="shipping" /></div><OrderTimeline order={order} />
      {active ? <button type="button" className="btn btn-primary btn-block" onClick={openTracking} disabled={opening}><Icon name="location" />{opening ? "Ouverture…" : "Suivre mon livreur"}</button> : !TERMINAL_ORDER_STATUSES.has(order.status) ? <p className="ik-order-footnote">Votre commande reste visible ici à chaque étape. Le suivi GPS s’active au départ du livreur.</p> : null}
      {error ? <p role="alert" className="ik-inline-warning">{error}</p> : null}
    </section><div className="ik-order-detail-aside">
      {order.deliveryCode ? <DeliveryCode code={order.deliveryCode} /> : null}
      <section className="ik-order-card"><div className="ik-section-label"><h2>Récapitulatif</h2><Icon name="inventory" /></div><p className="ik-order-items">{order.summary}</p>
        <dl className="ik-order-facts"><div><dt>Commande passée</dt><dd>{orderDate(order.createdAt, true)}</dd></div><div><dt>Destinataire</dt><dd>{order.customerName}</dd></div><div><dt>Lieu de livraison</dt><dd>{order.address || "À préciser avec IKIGAI Sport"}</dd></div><div><dt>Paiement</dt><dd>{payments[order.paymentStatus] || "À vérifier avec IKIGAI Sport"}</dd></div>{order.total !== null ? <div className="ik-order-total"><dt>Total enregistré</dt><dd>{FCFA(order.total)}</dd></div> : null}</dl>
      </section>
      {supportPhone ? <a className="ik-help-card" href={`https://wa.me/${supportPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour IKIGAI Sport, j’ai une question sur ma commande #${order.id.slice(-6).toUpperCase()}.`)}`} target="_blank" rel="noopener noreferrer"><Icon name="chat" /><span><strong>Besoin d’un coup de main ?</strong><small>Parlons de votre commande</small></span><Icon name="arrow-forward" size="sm" /></a> : null}
    </div></div>
    {celebrate ? <ConfirmationDialog order={order} onClose={() => setDismissed(true)} /> : null}
  </>;
}
