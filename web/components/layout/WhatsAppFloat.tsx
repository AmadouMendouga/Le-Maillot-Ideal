import { Icon } from "@/components/icons/Icon";
import { whatsappNumber } from "@/lib/cart";
import type { SiteSettings } from "@/lib/types";

export function WhatsAppFloat({ settings }: { settings: SiteSettings }) {
  return (
    <a
      className="wa-float"
      href={`https://wa.me/${whatsappNumber(settings)}`}
      target="_blank"
      rel="noopener"
      aria-label="Nous contacter sur WhatsApp"
    >
      <Icon name="whatsapp" />
    </a>
  );
}
