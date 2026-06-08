import { Suspense } from "react";
import AccountPortal from "@/components/AccountPortal";

export const metadata = {
  title: "Account va bookinglar | TravelorAI",
  description: "TravelorAI web va mobil akkauntingizdagi bookinglarni kuzating.",
};

export default function AccountPage() {
  return <Suspense fallback={null}><AccountPortal /></Suspense>;
}
