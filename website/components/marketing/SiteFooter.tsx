import Link from "next/link";
import { Instagram, Mail, MapPin, Phone, Send, Youtube } from "lucide-react";
import Logo from "./Logo";

const COLS = [
  {
    title: "Platforma",
    links: [
      ["Turlar", "/tours"],
      ["Yo‘nalishlar", "/destinations"],
      ["AI sayohat rejasi", "/account"],
      ["Mening safarlarim", "/my-trips"],
    ],
  },
  {
    title: "Hamkorlar uchun",
    links: [
      ["Hamkor bo‘lish", "/partners"],
      ["Tariflar", "/pricing"],
      ["Agentlik portali", "/agency"],
      ["Aloqa", "/contact"],
    ],
  },
  {
    title: "Huquqiy",
    links: [
      ["Ommaviy oferta", "/offer"],
      ["Maxfiylik siyosati", "/privacy"],
      ["Foydalanish shartlari", "/terms"],
    ],
  },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mkt-footer">
      <div className="mkt-wrap">
        <div className="mkt-footer__grid">
          <div className="mkt-footer__brand">
            <Logo light />
            <p>
              Sun’iy intellektga asoslangan yagona sayohat platformasi — chiqish, ichki va kirish
              turizmini bir joyda. Tasdiqlangan agentliklar, aqlli rejalar, ishonchli bron.
            </p>
            <div className="mkt-footer__socials">
              <a href="https://www.instagram.com/traveloraai/" aria-label="Instagram" target="_blank" rel="noopener noreferrer"><Instagram size={17} /></a>
              <a href="https://www.youtube.com/@TravelorAI" aria-label="YouTube" target="_blank" rel="noopener noreferrer"><Youtube size={17} /></a>
              <a href="https://t.me/travelorai" aria-label="Telegram" target="_blank" rel="noopener noreferrer"><Send size={16} /></a>
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map(([label, href]) => (
                  <li key={label}><Link href={href}>{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mkt-footer__bottom">
          <span>© {year} TravelorAI. Barcha huquqlar himoyalangan.</span>
          <span style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
            <span className="mkt-footer__contact" style={{ margin: 0 }}><MapPin size={15} /> Toshkent, O‘zbekiston</span>
            <span className="mkt-footer__contact" style={{ margin: 0 }}><Phone size={15} /> +998 90 000 00 00</span>
            <span className="mkt-footer__contact" style={{ margin: 0 }}><Mail size={15} /> support@travelorai.com</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
