import type { Metadata } from "next";
import Script from "next/script";
import MiniApp from "@/components/miniapp/MiniApp";
import "../../../styles/miniapp.scss";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Mini ilova faqat Telegram ichida ochiladi — qidiruvga tushmasin.
export const metadata: Metadata = {
  title: "Sayohat katalogi",
  robots: { index: false, follow: false },
};

export default async function TelegramMiniAppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <MiniApp slug={slug} />
    </>
  );
}
