import { customerOrderTimeline, type CustomerOrderView } from "@/lib/customerOrderView";
import { Icon } from "@/components/icons/Icon";

export function orderDate(value: string, time = false) {
  if (!Number.isFinite(Date.parse(value))) return "Date non renseignée";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", ...(time ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" }), timeZone: "Africa/Douala" }).format(new Date(value));
}

export function OrderTimeline({ order }: { order: CustomerOrderView }) {
  return <ol className="ik-order-timeline" aria-label="Avancement de la commande">
    {customerOrderTimeline(order).map((step) => <li key={step.status} className={step.complete ? "is-complete" : step.current ? "is-current" : "is-waiting"} aria-current={step.current ? "step" : undefined}>
      <span className="ik-timeline-dot" aria-hidden="true">{step.complete ? <Icon name="check-circle" size="sm" /> : null}</span>
      <div><strong>{step.title}<span className="sr-only"> — {step.complete ? "étape terminée" : step.current ? "étape en cours" : "étape à venir"}</span></strong>
        <p>{step.current ? step.description : step.complete ? "Étape terminée" : "À venir"}</p>
        {step.at ? <time dateTime={step.at}>{orderDate(step.at, true)}</time> : null}
      </div>
    </li>)}
  </ol>;
}
