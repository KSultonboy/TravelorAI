"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { isPublicMarketingPath } from "@/lib/umami";

type UmamiWindow = Window & { umami?: { track: (...args: unknown[]) => unknown } };

function trackPageview() {
  try {
    (window as UmamiWindow).umami?.track();
  } catch {
    /* analitika hech qachon sahifani buzmasin */
  }
}

/**
 * Umami skripti faqat ommaviy sahifa ochilganda yuklanadi va avtomatik kuzatuv
 * O'CHIQ (`data-auto-track="false"`): sahifa ko'rishni o'zimiz, faqat ommaviy
 * yo'llarda yuboramiz — SPA orqali /agency yoki /admin'ga o'tilsa ham hech narsa ketmaydi.
 */
export default function UmamiAnalytics({ src, websiteId, nonce }: { src: string; websiteId: string; nonce?: string }) {
  const pathname = usePathname();
  const isPublic = isPublicMarketingPath(pathname);
  // Bir marta ommaviy sahifa ochilsa skript qoladi (qayta yuklanmaydi).
  const [wanted, setWanted] = useState(isPublic);
  if (isPublic && !wanted) setWanted(true);

  useEffect(() => {
    if (isPublic) trackPageview(); // skript hali yuklanmagan bo'lsa — onLoad yuboradi
  }, [isPublic, pathname]);

  if (!wanted) return null;
  return (
    <Script
      src={src}
      data-website-id={websiteId}
      data-auto-track="false"
      nonce={nonce}
      strategy="afterInteractive"
      onLoad={() => {
        if (isPublicMarketingPath(window.location.pathname)) trackPageview();
      }}
    />
  );
}
