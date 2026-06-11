import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import AgenciesBoard from "@/components/admin/AgenciesBoard";
import { getAdminSession } from "@/lib/admin/session";

export const metadata = {
  title: "Agentliklar | TravelorAI Admin",
};

export default async function AdminAgenciesPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell username={session.username}>
      <AgenciesBoard />
    </AdminShell>
  );
}
