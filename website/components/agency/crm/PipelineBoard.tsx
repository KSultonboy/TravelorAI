"use client";

import { useMemo, useState } from "react";
import { Clock3, Filter, Phone, Plus, Search, Users } from "lucide-react";
import { formatMoney } from "@/lib/agency/api";
import { useCrm } from "@/lib/agency/useCrm";
import { CRM_STAGES, SUGGESTED_TAGS, timeAgo, type CrmLead, type CrmStage } from "@/lib/agency/crm";
import LeadDrawer from "./LeadDrawer";
import ManualLeadModal from "./ManualLeadModal";

export default function PipelineBoard() {
  const { agencyId, leads, move, busyId } = useCrm();
  const [openId, setOpenId] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [dragId, setDragId] = useState<string>("");
  const [overStage, setOverStage] = useState<CrmStage | "">("");

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return leads.filter((l) => {
      const hay = `${l.customerName} ${l.customerPhone || ""} ${l.customerEmail || ""} ${l.tourTitle || ""}`.toLowerCase();
      const textOk = !text || hay.includes(text);
      const tagOk = !tag || l.tags.includes(tag);
      return textOk && tagOk;
    });
  }, [leads, q, tag]);

  const byStage = useMemo(() => {
    const map: Record<CrmStage, CrmLead[]> = { new: [], contacted: [], quoted: [], won: [], completed: [], lost: [] };
    for (const l of filtered) map[l.stage].push(l);
    return map;
  }, [filtered]);

  function onDrop(stage: CrmStage) {
    setOverStage("");
    const lead = leads.find((l) => l.id === dragId);
    setDragId("");
    if (lead) void move(lead, stage);
  }

  return (
    <section className="agency-dashboard-section crm-pipe">
      <header className="agency-section-head crm-pipe__head">
        <div>
          <p className="agency-eyebrow">CRM · Savdo quvuri</p>
          <h2>Pipeline</h2>
          <p className="agency-muted">Har bir leadni bosqichma-bosqich yuriting — kartani suring yoki bosib boshqaring.</p>
        </div>
        <button className="crm-btn crm-btn--primary" onClick={() => setShowAdd(true)} type="button">
          <Plus size={16} /> Lead qo&apos;shish
        </button>
      </header>

      <div className="crm-toolbar">
        <div className="crm-search">
          <Search size={15} />
          <input placeholder="Ism, telefon yoki tur bo'yicha qidirish..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="crm-tagfilter">
          <Filter size={14} />
          <button className={!tag ? "is-active" : ""} onClick={() => setTag("")} type="button">Barchasi</button>
          {SUGGESTED_TAGS.map((t) => (
            <button key={t} className={tag === t ? "is-active" : ""} onClick={() => setTag(tag === t ? "" : t)} type="button">{t}</button>
          ))}
        </div>
      </div>

      <div className="crm-board">
        {CRM_STAGES.map((s) => {
          const items = byStage[s.key];
          const sum = items.reduce((acc, l) => acc + (l.totalEstimate || 0), 0);
          return (
            <div
              key={s.key}
              className={`crm-col crm-col--${s.key}${overStage === s.key ? " is-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOverStage(s.key as CrmStage); }}
              onDragLeave={() => setOverStage((cur) => (cur === s.key ? "" : cur))}
              onDrop={() => onDrop(s.key as CrmStage)}
            >
              <div className="crm-col__head">
                <span className={`crm-dot crm-dot--${s.key}`} />
                <b>{s.label}</b>
                <span className="crm-col__count">{items.length}</span>
                {sum > 0 ? <span className="crm-col__sum">{formatMoney(sum)}</span> : null}
              </div>
              <div className="crm-col__body">
                {items.map((l) => (
                  <article
                    key={l.id}
                    className={`crm-card${busyId === l.id ? " is-busy" : ""}`}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => setDragId("")}
                    onClick={() => setOpenId(l.id)}
                  >
                    <div className="crm-card__top">
                      <h4>{l.customerName}</h4>
                      {l.source === "manual" ? <span className="crm-mini-badge">Qo&apos;lda</span> : null}
                    </div>
                    {l.tourTitle ? <p className="crm-card__tour">{l.tourTitle}</p> : null}
                    <div className="crm-card__meta">
                      <span><Users size={12} /> {l.travelers}</span>
                      {l.totalEstimate ? <span className="crm-card__val">{formatMoney(l.totalEstimate)}</span> : null}
                      {l.customerPhone ? <span><Phone size={12} /></span> : null}
                      <span className="crm-card__ago"><Clock3 size={12} /> {timeAgo(l.createdAt)}</span>
                    </div>
                    {l.tags.length ? (
                      <div className="crm-card__tags">
                        {l.tags.slice(0, 3).map((t) => <span key={t} className="crm-chip">{t}</span>)}
                      </div>
                    ) : null}
                    {/* mobile / no-drag stage mover */}
                    <select
                      className="crm-card__move"
                      value={l.stage}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); void move(l, e.target.value as CrmStage); }}
                    >
                      {CRM_STAGES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                    </select>
                  </article>
                ))}
                {items.length === 0 ? <div className="crm-col__empty">Bo&apos;sh</div> : null}
              </div>
            </div>
          );
        })}
      </div>

      {openId ? <LeadDrawer leadId={openId} onClose={() => setOpenId("")} /> : null}
      {showAdd ? <ManualLeadModal agencyId={agencyId} onClose={() => setShowAdd(false)} onCreated={(id) => setOpenId(id)} /> : null}
    </section>
  );
}
