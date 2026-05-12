import Link from "next/link";
import { Compass, Facebook, Instagram, Send } from "lucide-react";

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      ["AI Trip Planner", "#how"],
      ["Explore Destinations", "#destinations"],
      ["Traveler Stories", "#stories"],
      ["Mobile App", "#"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About Us", "#"],
      ["Careers", "#"],
      ["Press", "#"],
      ["Blog", "#"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Help Center", "#"],
      ["Contact Us", "#"],
      ["Privacy Policy", "#"],
      ["Terms of Service", "#"],
    ],
  },
];

const SOCIALS = [
  { label: "Facebook", icon: Facebook },
  { label: "Telegram", icon: Send },
  { label: "Instagram", icon: Instagram },
];

export default function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer__grid">
          <div className="lp-footer__brand">
            <Link href="/" className="site-brand">
              <span className="site-brand__mark">
                <Compass size={16} />
              </span>
              <span className="site-brand__text">
                Travelor<span>AI</span>
              </span>
            </Link>
            <p>
              Redefining exploration with the power of artificial intelligence. Your personal
              travel companion, available 24/7.
            </p>
            <div className="lp-footer__socials">
              {SOCIALS.map(({ label, icon: Icon }) => (
                <a key={label} href="#" aria-label={label}>
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h4>{column.title}</h4>
              <ul>
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="lp-footer__bottom">
          <span>&copy; 2026 TravelorAI. All rights reserved.</span>
          <span>Privacy · Terms · Cookies</span>
        </div>
      </div>
    </footer>
  );
}
