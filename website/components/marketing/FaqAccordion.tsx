"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type Item = { q: string; a: string };

export default function FaqAccordion({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number>(0);

  return (
    <div className="mkt-faq">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className={`mkt-faq__item${isOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="mkt-faq__q"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span>{item.q}</span>
              <ChevronDown size={20} className="mkt-faq__chev" />
            </button>
            <div className="mkt-faq__a" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
              <div><p>{item.a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
