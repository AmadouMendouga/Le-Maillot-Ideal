import { requireAdminOrRedirect } from "@/lib/auth/dal";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminTabs } from "@/components/admin/AdminTabs";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminOrRedirect();

  return (
    <>
      <a href="#adminMain" className="skip-link">Aller au contenu</a>
      <AdminHeader email={admin.email} />
      <div className="adm-workspace">
      <AdminTabs />
      <main id="adminMain" className="adm-main">
        {children}
      </main>
      </div>
    </>
  );
}
