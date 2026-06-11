import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import ModerationBoard from "@/components/admin/ModerationBoard";
import { getAdminSession } from "@/lib/admin/session";

export const metadata = {
  title: "Moderatsiya | TravelorAI Admin",
};

export default async function AdminModerationPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell username={session.username}>
      <ModerationBoard />
    </AdminShell>
  );
}
