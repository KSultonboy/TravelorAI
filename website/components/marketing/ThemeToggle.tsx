"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "travelorai_theme";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem(KEY) === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("theme-dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem(KEY, next ? "dark" : "light"); } catch { /* jim */ }
    document.documentElement.classList.toggle("theme-dark", next);
  };

  return (
    <button
      className="mkt-theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={dark ? "Kunduzgi rejim" : "Tungi rejim"}
      title={dark ? "Kunduzgi rejim" : "Tungi rejim"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
