import Link from "next/link";

type LogoProps = {
  /** Quyuq fon uchun oq variant (hero ustida) */
  light?: boolean;
  href?: string;
  className?: string;
};

/**
 * TravelorAI belgisi — maxsus kompas mili (shimol: oltin) + AI uchquni.
 * Emerald plitka .tv-logo__mark CSS'dan keladi; bu yerda faqat oq/oltin glif.
 * (Ilgari lucide Compass ikonkasi edi — endi brendга atalgan belgi.)
 */
function BrandMark() {
  return (
    <svg viewBox="0 0 64 64" width="24" height="24" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="20" fill="none" stroke="#ffffff" strokeOpacity="0.32" strokeWidth="1.8" />
      <g transform="rotate(-38 32 32)">
        <path d="M32 12 L38.5 33 L25.5 33 Z" fill="#F5C74B" />
        <path d="M25.5 33 L38.5 33 L32 53 Z" fill="#ffffff" />
      </g>
      <circle cx="32" cy="32" r="3.4" fill="#0C4026" stroke="#ffffff" strokeWidth="1.4" />
      <path d="M46 8 C46.8 12.6 49.4 15.2 54 16 C49.4 16.8 46.8 19.4 46 24 C45.2 19.4 42.6 16.8 38 16 C42.6 15.2 45.2 12.6 46 8 Z" fill="#F5C74B" />
    </svg>
  );
}

export default function Logo({ light = false, href = "/", className = "" }: LogoProps) {
  return (
    <Link href={href} className={`tv-logo ${light ? "tv-logo--light" : ""} ${className}`} aria-label="TravelorAI — bosh sahifa">
      <span className="tv-logo__mark" aria-hidden="true">
        <BrandMark />
      </span>
      <span className="tv-logo__word">
        Travelor<span>AI</span>
      </span>
    </Link>
  );
}
