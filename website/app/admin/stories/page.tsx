import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import StoriesBoard from "@/components/admin/StoriesBoard";
import { getAdminSession } from "@/lib/admin/session";

export const metadata = {
  title: "Fikrlar | TravelorAI Admin",
};

export default async function AdminStoriesPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell username={session.username}>
      <StoriesBoard />
    </AdminShell>
  );
}
