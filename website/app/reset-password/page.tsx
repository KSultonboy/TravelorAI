import UserResetForm from "@/components/UserResetForm";

export const metadata = {
  title: "Parolni yangilash | TravelorAI",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; code?: string }>;
}) {
  const { email = "", code = "" } = await searchParams;
  return <UserResetForm email={email} code={code} />;
}
