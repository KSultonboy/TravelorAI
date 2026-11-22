import { ImageResponse } from "next/og";

// Ijtimoiy tarmoqlar (Telegram, Facebook, X) SVG preview'ni ko'rsatmaydi —
// shu sababli OG rasm PNG sifatida build vaqtida generatsiya qilinadi.
export const alt = "TravelorAI — AI sayohat platformasi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #07171d 0%, #0c6d58 58%, #c8a65a 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 7, color: "#b7f3da" }}>
          AI SAYOHAT PLATFORMASI
        </div>
        <div style={{ fontSize: 120, fontWeight: 800, marginTop: 24 }}>TravelorAI</div>
        <div style={{ fontSize: 38, marginTop: 16, color: "#e5f4ee" }}>
          Aqlli rejalashtiring. Yaxshiroq sayohat qiling.
        </div>
        <div style={{ fontSize: 28, marginTop: 40, color: "#d9efe7" }}>
          Tasdiqlangan agentliklar turlari · travelorai.com
        </div>
      </div>
    ),
    { ...size }
  );
}
