import Link from "next/link";
import { Compass, Instagram, Youtube } from "lucide-react";

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
  { label: "TravelorAI Instagram", href: "https://www.instagram.com/traveloraai/", icon: Instagram },
  { label: "TravelorAI YouTube", href: "https://www.youtube.com/@TravelorAI", icon: Youtube },
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
                <a key={label} href={href} aria-label={label} target="_blank" rel="noopener noreferrer">
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
