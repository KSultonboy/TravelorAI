"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type RouteStop = { name: string; lat: number; lng: number };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Marshrut xaritasi — nuqtalar raqamlangan belgilar bilan, orasi uzuq chiziq.
// Ataylab yo'l marshruti EMAS: samolyotli turlarda yo'l bo'lmaydi, sayohat chizig'i esa
// har qanday turda (Toshkent→Makka ham, Toshkent→Samarqand ham) to'g'ri ko'rinadi.
export default function RouteMap({ stops, compact = false }: { stops: RouteStop[]; compact?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || mapRef.current || stops.length === 0) return;
    let cancelled = false;

    // Sahifada bir nechta xarita bo'lishi mumkin (umumiy marshrut + har bir kun).
    // Hammasini darhol yuklash sekin internetda og'ir — ekranga yaqinlashgandagina ishga tushiramiz.
    const start = async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !boxRef.current || mapRef.current) return;

      const map = L.map(boxRef.current, {
        scrollWheelZoom: false, // mobil aylantirishni o'g'irlamasin
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      }).addTo(map);

      const points = stops.map((s) => [s.lat, s.lng] as [number, number]);

      if (points.length > 1) {
        L.polyline(points, {
          color: "#0f5132",
          weight: 3,
          opacity: 0.9,
          dashArray: "7 9",
          lineCap: "round",
        }).addTo(map);
      }

      stops.forEach((stop, i) => {
        const last = i === stops.length - 1 && stops.length > 1;
        const icon = L.divIcon({
          className: "route-pin-wrap",
          html: `<span class="route-pin${last ? " route-pin--end" : ""}">${i + 1}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        L.marker([stop.lat, stop.lng], { icon, title: stop.name })
          .addTo(map)
          .bindPopup(`<b>${i + 1}. ${escapeHtml(stop.name)}</b>`);
      });

      if (points.length === 1) map.setView(points[0], compact ? 14 : 11);
      else map.fitBounds(L.latLngBounds(points), { padding: compact ? [34, 34] : [46, 46] });

      // Foydalanuvchi xaritani bosgandan keyingina g'ildirak bilan kattalashtirish yoqiladi
      map.on("click", () => map.scrollWheelZoom.enable());
    };

    // Ekranga kirganda ishga tushiramiz — LEKIN kontentni ko'rinishga bog'lab qo'ymaymiz.
    // Aylantirmaydigan muhitlarda (headless render, ichki brauzerlar) IntersectionObserver
    // hech qachon ishlamaydi va xarita mangu bo'sh qolardi. Shuning uchun zaxira taymer:
    // qaysi biri oldin bo'lsa — o'sha ishga tushiradi.
    let io: IntersectionObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const launch = () => {
      if (io) { io.disconnect(); io = null; }
      if (timer) { clearTimeout(timer); timer = null; }
      void start();
    };

    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => { if (entries.some((e) => e.isIntersecting)) launch(); },
        { rootMargin: "300px 0px" }
      );
      io.observe(box);
      timer = setTimeout(launch, 1200); // zaxira — hech qachon bo'sh qolmasin
    } else {
      void start();
    }

    return () => {
      cancelled = true;
      if (io) io.disconnect();
      if (timer) clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stops, compact]);

  return (
    <div
      className={`pres-route__map${compact ? " pres-route__map--sm" : ""}`}
      ref={boxRef}
      role="img"
      aria-label={`Marshrut: ${stops.map((s) => s.name).join(" → ")}`}
    />
  );
}
