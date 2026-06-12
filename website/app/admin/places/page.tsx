import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import PlacesBoard from "@/components/admin/PlacesBoard";
import { getAdminSession } from "@/lib/admin/session";

export const metadata = {
  title: "Joylar | TravelorAI Admin",
};

export default async function AdminPlacesPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell username={session.username}>
      <PlacesBoard />
    </AdminShell>
  );
}
