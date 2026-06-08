"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccounts = {
  id: {
    initialize: (options: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
      auto_select?: boolean;
      cancel_on_tap_outside?: boolean;
    }) => void;
    renderButton: (
      parent: HTMLElement,
      options: {
        type: "standard";
        theme: "outline";
        size: "large";
        text: "continue_with";
        shape: "pill";
        logo_alignment: "left";
        width: number;
      }
    ) => void;
  };
};

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

export default function GoogleContinueButton({
  onCredential,
  onError,
  disabled = false,
}: {
  onCredential: (idToken: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || "";

  useEffect(() => {
    if (!scriptReady || !clientId || !containerRef.current || !window.google?.accounts) return;

    const container = containerRef.current;
    container.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        if (!response.credential) {
          onError("Google ID token olinmadi.");
          return;
        }
        onCredential(response.credential);
      },
    });
    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      logo_alignment: "left",
      width: Math.min(376, Math.max(240, container.clientWidth)),
    });
  }, [clientId, onCredential, onError, scriptReady]);

  if (!clientId) {
    return (
      <button
        className="account-google"
        type="button"
        onClick={() => onError("Google login uchun Web Client ID hali sozlanmagan.")}
        title="NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID sozlanmagan"
      >
        <span>G</span> Google bilan davom etish
      </button>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => onError("Google login skripti yuklanmadi.")}
      />
      <div className={`account-google-host ${disabled ? "is-disabled" : ""}`} ref={containerRef}>
        {!scriptReady ? <span>Google yuklanmoqda...</span> : null}
      </div>
    </>
  );
}
