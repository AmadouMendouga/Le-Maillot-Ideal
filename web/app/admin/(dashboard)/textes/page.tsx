import { getSiteSettings } from "@/lib/data/adminCatalog";
import { SiteSettingsAdmin } from "@/components/admin/SiteSettingsAdmin";

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();
  return <SiteSettingsAdmin initialSettings={settings} />;
}
