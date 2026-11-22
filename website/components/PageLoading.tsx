/**
 * Umumiy yuklanish holati. DIQQAT: app/loading.tsx (root) ATAYLAB yo'q — root
 * Suspense chegarasi sahifani darhol oqim bilan yuboradi va notFound() 404 o'rniga
 * 200 status qaytarardi (/tours/[id] uchun soft-404). Shuning uchun faqat
 * notFound() ishlatilmaydigan segmentlarda (loading.tsx) qo'llanadi.
 */
export default function PageLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        color: "#087a56",
        fontFamily: "var(--font-jakarta), system-ui, sans-serif",
      }}
    >
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-6.2-8.5">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite" />
        </path>
      </svg>
      <span style={{ fontSize: "0.95rem", color: "#5b6b66" }}>Yuklanmoqda…</span>
    </div>
  );
}
