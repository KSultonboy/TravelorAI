import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import HeroSlidesAdmin from "@/components/admin/HeroSlidesAdmin";
import { getAdminSession } from "@/lib/admin/session";

export const metadata = {
  title: "Hero slaydlar | TravelorAI Admin",
};

export default async function AdminHeroPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell username={session.username}>
      <HeroSlidesAdmin username={session.username} />
    </AdminShell>
  );
}
