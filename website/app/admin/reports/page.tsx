import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import ReportsBoard from "@/components/admin/ReportsBoard";
import { getAdminSession } from "@/lib/admin/session";

export const metadata = {
  title: "Hisobotlar | TravelorAI Admin",
};

export default async function AdminReportsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell username={session.username}>
      <ReportsBoard />
    </AdminShell>
  );
}
