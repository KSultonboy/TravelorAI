import Link from "next/link";
import { Compass, Facebook, Instagram, Send } from "lucide-react";

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      ["AI Trip Planner", "#about"],
      ["Explore Destinations", "#features"],
      ["Traveler Stories", "#about"],
      ["Mobile App", "#features"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About Us", "#about"],
      ["Careers", "#contact"],
      ["Press", "#contact"],
      ["Blog", "#about"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Help Center", "#contact"],
      ["Contact Us", "#contact"],
      ["Privacy Policy", "#home"],
      ["Terms of Service", "#home"],
    ],
  },
];

const SOCIALS = [
  { label: "Facebook", href: "#contact", icon: Facebook },
  { label: "Telegram", href: "#contact", icon: Send },
  { label: "Instagram", href: "#contact", icon: Instagram },
];

export default function Footer() {
  return (
    <footer id="contact" className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer__grid">
          <div className="lp-footer__brand">
            <Link href="#home" className="site-brand">
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
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <a key={label} href={href} aria-label={label}>
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
          <span className="lp-footer__legal">
            <Link href="#home">Privacy</Link>
            <span>&middot;</span>
            <Link href="#home">Terms</Link>
            <span>&middot;</span>
            <Link href="#home">Cookies</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
