import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { getAdminSession } from "@/lib/admin/session";

export const metadata = {
  title: "Admin kirish | TravelorAI",
};

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin");

  return (
    <main className="admin-login-screen">
      <div className="admin-login-screen__bg" />
      <AdminLoginForm />
    </main>
  );
}
