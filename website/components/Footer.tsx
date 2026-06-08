import Link from "next/link";
import { Compass, Instagram, Youtube } from "lucide-react";

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      ["AI Trip Planner", "#how-it-works"],
      ["Explore Destinations", "#features"],
      ["How It Works", "#how-it-works"],
      ["Agency Portal", "/agency"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About Us", "#how-it-works"],
      ["Instagram", "https://www.instagram.com/traveloraai/"],
      ["YouTube", "https://www.youtube.com/@TravelorAI"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Help Center", "mailto:support@travelorai.com"],
      ["Contact Us", "mailto:support@travelorai.com"],
      ["Privacy Policy", "__PRIVACY__"],
      ["Delete Account", "__DELETE_ACCOUNT__"],
    ],
  },
];

const SOCIALS = [
  { label: "TravelorAI Instagram", href: "https://www.instagram.com/traveloraai/", icon: Instagram },
  { label: "TravelorAI YouTube", href: "https://www.youtube.com/@TravelorAI", icon: Youtube },
];

export default function Footer() {
  const configuredApi = process.env.NEXT_PUBLIC_API_URL || "";
  const backendOrigin = /^https?:\/\//i.test(configuredApi)
    ? configuredApi.replace(/\/api\/v1\/?$/i, "")
    : process.env.NODE_ENV === "production"
      ? ""
      : "http://localhost:4000";
  const privacyUrl = `${backendOrigin}/privacy-policy`;
  const deleteAccountUrl = `${backendOrigin}/account-deletion`;
  const currentYear = new Date().getFullYear();

  function resolveHref(href: string) {
    if (href === "__PRIVACY__") return privacyUrl;
    if (href === "__DELETE_ACCOUNT__") return deleteAccountUrl;
    return href;
  }

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
                    {/^(https?:|mailto:)/.test(resolveHref(href)) ? (
                      <a
                        href={resolveHref(href)}
                        target={resolveHref(href).startsWith("http") ? "_blank" : undefined}
                        rel={resolveHref(href).startsWith("http") ? "noopener noreferrer" : undefined}
                      >
                        {label}
                      </a>
                    ) : (
                      <Link href={resolveHref(href)}>{label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="lp-footer__bottom">
          <span>&copy; {currentYear} TravelorAI. All rights reserved.</span>
          <span className="lp-footer__legal">
            <a href={privacyUrl} target="_blank" rel="noopener noreferrer">Privacy</a>
            <span>&middot;</span>
            <Link href="#how-it-works">How it works</Link>
            <span>&middot;</span>
            <a href={deleteAccountUrl} target="_blank" rel="noopener noreferrer">Delete account</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
