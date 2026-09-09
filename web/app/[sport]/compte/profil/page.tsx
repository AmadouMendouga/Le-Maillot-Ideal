import { requireCustomerOrRedirect } from "@/lib/auth/dal";
import { getCustomerProfile } from "@/lib/data/customer";
import { getSiteSettings } from "@/lib/data/settings";
import { ProfileSettings } from "@/components/account/ProfileSettings";

export const metadata = { title: "Mon compte — IKIGAI Sport", robots: { index: false, follow: false } };
export default async function ProfilePage({ params }: PageProps<"/[sport]/compte/profil">) {
  const { sport } = await params;
  await requireCustomerOrRedirect(sport);
  const [profile, settings] = await Promise.all([getCustomerProfile(), getSiteSettings()]);
  return <main id="main" className="container ik-profile-page"><ProfileSettings initialProfile={profile} sport={sport} supportPhone={settings.whatsapp} /></main>;
}
