"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mkt">
      <main>
        <section className="mkt-section" style={{ textAlign: "center", minHeight: "70vh", display: "flex", alignItems: "center" }}>
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">Xatolik</span>
            <h1 className="mkt-h2" style={{ marginTop: 12 }}>Nimadir xato ketdi</h1>
            <p className="mkt-lead" style={{ margin: "12px auto 28px" }}>
              Sahifani yuklab bo‘lmadi. Bir necha soniyadan so‘ng qayta urinib ko‘ring.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" className="btn btn--gold btn--lg" onClick={() => reset()}>Qayta urinish</button>
              <Link className="btn btn--navy btn--lg" href="/">Bosh sahifa</Link>
            </div>
            {error.digest ? (
              <p style={{ marginTop: 20, color: "var(--subtle)", fontSize: "0.8rem" }}>Xato kodi: {error.digest}</p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
