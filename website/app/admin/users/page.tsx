import { redirect } from "next/navigation";
import UsersAdmin from "@/components/admin/UsersAdmin";
import { getAdminSession } from "@/lib/admin/session";

export const metadata = {
  title: "Foydalanuvchilar | TravelorAI Admin",
};

export default async function AdminUsersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return <UsersAdmin username={session.username} />;
}
