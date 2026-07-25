import type { Metadata } from "next";
import { Suspense } from "react";
import SignInClient from "@/components/marketing/SignInClient";

export const metadata: Metadata = {
  title: "Kirish",
  description: "TravelorAI hisobingizga kiring yoki ro'yxatdan o'ting — sayohatchi yoki hamkor sifatida.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/signin" },
};

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInClient />
    </Suspense>
  );
}
