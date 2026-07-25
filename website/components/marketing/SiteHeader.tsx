"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Menu, UserRound, X } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "./useAuth";

const NAV = [
  { href: "/destinations", label: "Yo‘nalishlar" },
  { href: "/tours", label: "Turlar" },
  { href: "/about", label: "Biz haqimizda" },
  { href: "/contact", label: "Aloqa" },
];

/** transparentOverHero: hero ustida shaffof (faqat scroll'da solid bo'ladi) */
export default function SiteHeader({ transparentOverHero = false }: { transparentOverHero?: boolean }) {
  const [solid, setSolid] = useState(!transparentOverHero);
  const [open, setOpen] = useState(false);
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!transparentOverHero) return;
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparentOverHero]);

  return (
    <header
      className={`mkt-header ${transparentOverHero ? "mkt-header--transparent" : ""} ${solid ? "mkt-header--solid" : ""}`}
    >
      <div className="mkt-wrap mkt-header__bar">
        <Logo light={transparentOverHero && !solid} />

        <nav className="mkt-nav" aria-label="Asosiy navigatsiya">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} prefetch={false}>{item.label}</Link>
          ))}
        </nav>

        <div className="mkt-header__actions">
          <ThemeToggle />
          {!loading && user ? (
            <>
              <Link className="btn btn--ghost btn--md" href="/my-trips"><UserRound size={17} /> Mening safarlarim</Link>
              <button className="btn btn--navy btn--md" onClick={signOut} type="button"><LogOut size={16} /> Chiqish</button>
            </>
          ) : (
            <>
              <Link className="btn btn--ghost btn--md" href="/signin">Kirish</Link>
              <Link className="btn btn--gold btn--md" href="/tours">Turlarni ko‘rish</Link>
            </>
          )}
          <button
            className="mkt-header__burger"
            type="button"
            aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mkt-mobile">
          <div className="mkt-wrap mkt-mobile__inner">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} prefetch={false} onClick={() => setOpen(false)}>{item.label}</Link>
            ))}
            {!loading && user ? (
              <>
                <Link href="/my-trips" onClick={() => setOpen(false)}>Mening safarlarim</Link>
                <button type="button" onClick={() => { setOpen(false); void signOut(); }}>Chiqish</button>
              </>
            ) : (
              <Link href="/signin" onClick={() => setOpen(false)}>Kirish / Ro‘yxatdan o‘tish</Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
