"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Phone, Search, Sparkles, Users } from "lucide-react";
import { formatMoney } from "@/lib/agency/api";
import { useCrm } from "@/lib/agency/useCrm";
import { STAGE_LABEL, greetingTemplate, timeAgo, whatsappLink } from "@/lib/agency/crm";
import LeadDrawer from "./LeadDrawer";

export default function CustomersView() {
  const { customers } = useCrm();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState("");
  const [expanded, setExpanded] = useState<string>("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return customers;
    return customers.filter((c) => `${c.name} ${c.phone || ""} ${c.email || ""}`.toLowerCase().includes(t));
  }, [customers, q]);

  return (
    <section className="agency-dashboard-section">
      <header className="agency-section-head">
        <div>
          <p className="agency-eyebrow">CRM · Mijozlar bazasi</p>
          <h2>Mijozlar</h2>
          <p className="agency-muted">Bir mijozning barcha so&apos;rovlari telefon/email bo&apos;yicha birlashtiriladi.</p>
        </div>
      </header>

      <div className="crm-toolbar">
        <div className="crm-search">
          <Search size={15} />
          <input placeholder="Mijoz qidirish..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="crm-count-pill"><Users size={14} /> {customers.length} mijoz</div>
      </div>

      {filtered.length ? (
        <div className="crm-customer-list">
          {filtered.map((c) => {
            const wa = whatsappLink(c.phone, greetingTemplate({ customerName: c.name, tourTitle: c.leads[0]?.tourTitle }));
            const isOpen = expanded === c.keyId;
            return (
              <article className="crm-customer" key={c.keyId}>
                <div className="crm-customer__main" onClick={() => setExpanded(isOpen ? "" : c.keyId)}>
                  <div className="crm-customer__avatar">{c.name.slice(0, 1).toUpperCase()}</div>
                  <div className="crm-customer__id">
                    <h4>{c.name}{c.wonCount > 1 ? <span className="crm-repeat"><Sparkles size={12} /> Takroriy</span> : null}</h4>
                    <small>{c.phone || c.email || "Kontakt yo'q"} · oxirgi: {timeAgo(c.lastAt)}</small>
                    {c.tags.length ? (
                      <div className="crm-card__tags">{c.tags.slice(0, 4).map((t) => <span key={t} className="crm-chip">{t}</span>)}</div>
                    ) : null}
                  </div>
                  <div className="crm-customer__stats">
                    <div><b>{c.leads.length}</b><small>so&apos;rov</small></div>
                    <div><b>{c.wonCount}</b><small>kelishuv</small></div>
                    <div><b>{formatMoney(c.totalValue)}</b><small>qiymat</small></div>
                  </div>
                  <div className="crm-customer__quick" onClick={(e) => e.stopPropagation()}>
                    {c.phone ? <a className="crm-icon-btn" href={`tel:${c.phone}`} title="Qo'ng'iroq"><Phone size={16} /></a> : null}
                    {wa ? <a className="crm-icon-btn" href={wa} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle size={16} /></a> : null}
                  </div>
                </div>
                {isOpen ? (
                  <div className="crm-customer__history">
                    {c.leads.map((l) => (
                      <button className="crm-history-row" key={l.id} onClick={() => setOpenId(l.id)} type="button">
                        <span className={`crm-dot crm-dot--${l.stage}`} />
                        <span className="crm-history-row__tour">{l.tourTitle || "Tur ko'rsatilmagan"}</span>
                        <span className="crm-history-row__stage">{STAGE_LABEL[l.stage]}</span>
                        <span className="crm-history-row__val">{l.totalEstimate ? formatMoney(l.totalEstimate) : "—"}</span>
                        <span className="crm-history-row__ago">{timeAgo(l.createdAt)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="agency-empty-state"><Users size={28} /><p>Hozircha mijoz yo&apos;q. Birinchi lead kelganda shu yerda paydo bo&apos;ladi.</p></div>
      )}

      {openId ? <LeadDrawer leadId={openId} onClose={() => setOpenId("")} /> : null}
    </section>
  );
}
