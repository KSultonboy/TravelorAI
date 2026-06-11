import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import AdminLeadsBoard from "@/components/admin/AdminLeadsBoard";
import { getAdminSession } from "@/lib/admin/session";

export const metadata = {
  title: "Leadlar | TravelorAI Admin",
};

export default async function AdminLeadsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell username={session.username}>
      <AdminLeadsBoard />
    </AdminShell>
  );
}
