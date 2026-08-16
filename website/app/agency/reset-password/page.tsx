import AgencyResetForm from "@/components/AgencyResetForm";

export const metadata = {
  title: "Parolni yangilash | TravelorAI Agentlik",
  robots: { index: false, follow: false },
};

export default async function AgencyResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; code?: string }>;
}) {
  const { email = "", code = "" } = await searchParams;
  return <AgencyResetForm email={email} code={code} />;
}
