import "../../styles/agency-v1.scss";
import { AgencySessionProvider } from "@/lib/agency/session";
import AgencyShell from "@/components/agency/AgencyShell";

export const metadata = {
  title: "Agency Portal | TravelorAI",
  description: "TravelorAI tour agency boshqaruv paneli.",
};

export default function AgencyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AgencySessionProvider>
      <AgencyShell>{children}</AgencyShell>
    </AgencySessionProvider>
  );
}
