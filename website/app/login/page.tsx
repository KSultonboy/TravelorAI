import { Suspense } from "react";
import AccountPortal from "@/components/AccountPortal";

export const metadata = {
  title: "Kirish | TravelorAI",
  description: "TravelorAI foydalanuvchi hisobiga kirish yoki ro‘yxatdan o‘tish.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AccountPortal />
    </Suspense>
  );
}
