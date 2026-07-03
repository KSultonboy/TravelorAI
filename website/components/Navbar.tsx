"use client";

import { useState } from "react";
import { Compass, Menu, X } from "lucide-react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#home", label: "Asosiy" },
  { href: "#features", label: "Yo‘nalishlar" },
  { href: "/tours", label: "Turlar", page: true },
  { href: "#how-it-works", label: "Qanday ishlaydi" },
  { href: "#contact", label: "Aloqa" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  function scrollToTarget(href: string) {
    setMenuOpen(false);
    if (href === "#home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <header className="site-nav">
      <nav className="site-nav__bar" aria-label="Asosiy navigatsiya">
        <a
          href="#home"
          className="site-brand"
          onClick={(event) => {
            event.preventDefault();
            scrollToTarget("#home");
          }}
        >
          <span className="site-brand__mark">
            <Compass size={16} />
          </span>
          <span className="site-brand__text">
            Travelor<span>AI</span>
          </span>
        </a>

        <div className="site-nav__links">
          {NAV_LINKS.map((item) =>
            item.page ? (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </Link>
            ) : (
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
            )
          )}
        </div>

        <button
          className="site-nav__toggle"
          type="button"
          aria-label={menuOpen ? "Menyuni yopish" : "Menyuni ochish"}
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={17} /> : <Menu size={17} />}
        </button>
        <Link className="site-nav__account" href="/signin">Kirish</Link>
      </nav>

      {menuOpen && (
        <div className="site-nav__mobile" id="mobile-navigation">
          <div className="site-nav__mobile-links">
            {NAV_LINKS.map((item) =>
              item.page ? (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </Link>
              ) : (
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
              )
            )}
            <Link href="/signin">Kirish / Ro‘yxatdan o‘tish</Link>
          </div>
        </div>
      )}
    </header>
  );
}
