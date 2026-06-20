import Link from "next/link";
import { Compass } from "lucide-react";

type LogoProps = {
  /** Quyuq fon uchun oq variant (hero ustida) */
  light?: boolean;
  href?: string;
  className?: string;
};

export default function Logo({ light = false, href = "/", className = "" }: LogoProps) {
  return (
    <Link href={href} className={`tv-logo ${light ? "tv-logo--light" : ""} ${className}`} aria-label="TravelorAI — bosh sahifa">
      <span className="tv-logo__mark" aria-hidden="true">
        <Compass size={18} strokeWidth={2.4} />
      </span>
      <span className="tv-logo__word">
        Travelor<span>AI</span>
      </span>
    </Link>
  );
}
