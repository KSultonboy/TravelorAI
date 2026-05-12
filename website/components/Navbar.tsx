"use client";

import { useState } from "react";
import { Compass, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "#destinations", label: "Explore" },
  { href: "#how", label: "How it works" },
  { href: "#stories", label: "Stories" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  function scrollToTarget(href: string) {
    setMenuOpen(false);
    if (href === "#top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <header className="site-nav">
      <nav className="site-nav__bar" aria-label="Asosiy navigatsiya">
        <a href="#top" className="site-brand" onClick={(event) => { event.preventDefault(); scrollToTarget("#top"); }}>
          <span className="site-brand__mark">
            <Compass size={16} />
          </span>
          <span className="site-brand__text">
            Travelor<span>AI</span>
          </span>
        </a>

        <div className="site-nav__links">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(event) => {
                event.preventDefault();
                scrollToTarget(item.href);
              }}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="site-nav__actions">
          <a href="https://agency.travelorai.com" className="site-nav__login">
            For agencies
          </a>
          <a
            href="#destinations"
            className="site-nav__login"
            onClick={(event) => {
              event.preventDefault();
              scrollToTarget("#destinations");
            }}
          >
            Explore
          </a>
          <a
            href="#how"
            className="site-nav__register"
            onClick={(event) => {
              event.preventDefault();
              scrollToTarget("#how");
            }}
          >
            Learn more
          </a>
        </div>

        <button
          className="site-nav__toggle"
          type="button"
          aria-label="Menyuni ochish"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={17} /> : <Menu size={17} />}
        </button>
      </nav>

      {menuOpen && (
        <div className="site-nav__mobile">
          <div className="site-nav__mobile-links">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToTarget(item.href);
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="site-nav__mobile-actions">
            <a className="site-nav__login" href="https://agency.travelorai.com">
              For agencies
            </a>
            <a
              className="site-nav__login"
              href="#destinations"
              onClick={(event) => {
                event.preventDefault();
                scrollToTarget("#destinations");
              }}
            >
              Explore
            </a>
            <a
              className="site-nav__register"
              href="#how"
              onClick={(event) => {
                event.preventDefault();
                scrollToTarget("#how");
              }}
            >
              Learn more
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
