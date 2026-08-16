import "../../styles/agency-karvon.scss";
import { AgencySessionProvider } from "@/lib/agency/session";

export const metadata = {
  title: "Agentlik CRM | TravelorAI",
  robots: { index: false, follow: false },
};

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return <AgencySessionProvider>{children}</AgencySessionProvider>;
}
