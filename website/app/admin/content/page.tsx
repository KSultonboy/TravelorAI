import { redirect } from "next/navigation";
import LandingContentAdmin from "@/components/admin/LandingContentAdmin";
import { getAdminSession } from "@/lib/admin/session";

export const metadata = {
  title: "Landing content | TravelorAI Admin",
};

export default async function AdminContentPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return <LandingContentAdmin username={session.username} />;
}
