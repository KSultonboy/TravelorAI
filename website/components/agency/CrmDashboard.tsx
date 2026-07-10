"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlarmClock,
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  Flame,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatMoney } from "@/lib/agency/api";
import { useAgencySession } from "@/lib/agency/session";
import { useCrm } from "@/lib/agency/useCrm";
import { CRM_STAGES, timeAgo, type CrmStage } from "@/lib/agency/crm";
import LeadDrawer from "./crm/LeadDrawer";

const OPEN_STAGES: CrmStage[] = ["new", "contacted", "quoted", "won"];

export default function CrmDashboard() {
  const { me } = useAgencySession();
  const { leads, tasks, customers } = useCrm();
  const [openId, setOpenId] = useState("");

  const m = useMemo(() => {
    const count = (s: CrmStage) => leads.filter((l) => l.stage === s).length;
    const stageCounts = Object.fromEntries(CRM_STAGES.map((s) => [s.key, count(s.key)])) as Record<CrmStage, number>;
    const won = stageCounts.won + stageCounts.completed;
    const decided = won + stageCounts.lost;
    const pipelineValue = leads.filter((l) => OPEN_STAGES.includes(l.stage)).reduce((a, l) => a + (l.totalEstimate || 0), 0);
    const revenue = leads.filter((l) => l.stage === "won" || l.stage === "completed").reduce((a, l) => a + (l.totalEstimate || 0), 0);
    const now = Date.now();
    const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
    const dueToday = tasks.filter((t) => !t.done && t.dueAt && new Date(t.dueAt).getTime() <= endToday.getTime());
    return {
      stageCounts,
      newLeads: stageCounts.new,
      pipelineValue,
      revenue,
      winRate: decided ? Math.round((won / decided) * 100) : 0,
      dueToday: dueToday.length,
      overdue: tasks.filter((t) => !t.done && t.dueAt && new Date(t.dueAt).getTime() < now).length,
    };
  }, [leads, tasks]);

  const dueTasks = useMemo(
    () => tasks.filter((t) => !t.done).sort((a, b) => new Date(a.dueAt || "9999").getTime() - new Date(b.dueAt || "9999").getTime()).slice(0, 5),
    [tasks]
  );
  const recent = useMemo(() => leads.slice(0, 6), [leads]);
  const maxStage = Math.max(1, ...CRM_STAGES.map((s) => m.stageCounts[s.key]));

  return (
    <>
      <header className="agency-dashboard-topbar">
        <div>
          <p className="agency-eyebrow">CRM boshqaruvi</p>
          <h2>{me?.agency?.name || "Agency CRM"}</h2>
          <p className="agency-muted">{me?.agency?.city || "Global"} · {me?.agency?.specialty || "Tours"}</p>
        </div>
        <Link className="agency-cta" href="/agency/pipeline">Pipeline <ArrowRight size={15} /></Link>
      </header>

      <section className="crm-kpi-grid">
        <div className={`crm-kpi${m.newLeads ? " crm-kpi--hot" : ""}`}>
          <span><Flame size={18} /></span>
          <b>{m.newLeads}</b><small>Yangi lead — javob kerak</small>
        </div>
        <div className="crm-kpi">
          <span><BadgeDollarSign size={18} /></span>
          <b>{formatMoney(m.pipelineValue)}</b><small>Faol pipeline qiymati</small>
        </div>
        <div className="crm-kpi">
          <span><Target size={18} /></span>
          <b>{m.winRate}%</b><small>Konversiya (win rate)</small>
        </div>
        <div className="crm-kpi">
          <span><TrendingUp size={18} /></span>
          <b>{formatMoney(m.revenue)}</b><small>Yopilgan aylanma</small>
        </div>
        <div className="crm-kpi">
          <span><Users size={18} /></span>
          <b>{customers.length}</b><small>Jami mijozlar</small>
        </div>
        <div className={`crm-kpi${m.overdue ? " crm-kpi--alert" : ""}`}>
          <span><AlarmClock size={18} /></span>
          <b>{m.dueToday}</b><small>Bugungi vazifalar{m.overdue ? ` · ${m.overdue} kechikkan` : ""}</small>
        </div>
      </section>

      <div className="crm-dash-cols">
        {/* funnel */}
        <section className="agency-dashboard-section">
          <header className="agency-section-head">
            <div><h3><Target size={18} /> Savdo voronkasi</h3><p className="agency-muted">Leadlar bosqichlar bo&apos;yicha.</p></div>
            <Link className="agency-link" href="/agency/pipeline">Ochish <ArrowRight size={15} /></Link>
          </header>
          <div className="crm-funnel">
            {CRM_STAGES.map((s) => (
              <div className="crm-funnel__row" key={s.key}>
                <span className="crm-funnel__label"><i className={`crm-dot crm-dot--${s.key}`} /> {s.label}</span>
                <div className="crm-funnel__bar"><div className={`crm-funnel__fill crm-funnel__fill--${s.key}`} style={{ width: `${(m.stageCounts[s.key] / maxStage) * 100}%` }} /></div>
                <span className="crm-funnel__num">{m.stageCounts[s.key]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* tasks due */}
        <section className="agency-dashboard-section">
          <header className="agency-section-head">
            <div><h3><CalendarClock size={18} /> Yaqin vazifalar</h3><p className="agency-muted">Follow-up&apos;ni o&apos;tkazib yubormang.</p></div>
            <Link className="agency-link" href="/agency/tasks">Barchasi <ArrowRight size={15} /></Link>
          </header>
          {dueTasks.length ? (
            <ul className="crm-dash-tasks">
              {dueTasks.map((t) => (
                <li key={t.id} className={t.dueAt && new Date(t.dueAt).getTime() < Date.now() ? "is-overdue" : ""}>
                  <CheckCircle2 size={15} />
                  <div><p>{t.title}</p><small>{t.leadName || "—"} · {t.dueAt ? timeAgo(t.dueAt) : "muddatsiz"}</small></div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="agency-empty-state agency-empty-state--slim"><CheckCircle2 size={22} /><p>Bugun kutilayotgan vazifa yo&apos;q. 👏</p></div>
          )}
        </section>
      </div>

      {/* recent leads */}
      <section className="agency-dashboard-section">
        <header className="agency-section-head">
          <div><h3><Flame size={18} /> So&apos;nggi leadlar</h3><p className="agency-muted">Eng yangi so&apos;rovlar — bosib batafsil ko&apos;ring.</p></div>
          <Link className="agency-link" href="/agency/pipeline">Pipeline <ArrowRight size={15} /></Link>
        </header>
        {recent.length ? (
          <div className="crm-recent">
            {recent.map((l) => (
              <button className="crm-recent__row" key={l.id} onClick={() => setOpenId(l.id)} type="button">
                <span className={`crm-dot crm-dot--${l.stage}`} />
                <span className="crm-recent__name">{l.customerName}</span>
                <span className="crm-recent__tour">{l.tourTitle || "Tur ko'rsatilmagan"}</span>
                <span className="crm-recent__val">{l.totalEstimate ? formatMoney(l.totalEstimate) : "—"}</span>
                <span className="crm-recent__ago">{timeAgo(l.createdAt)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="agency-empty-state agency-empty-state--slim"><Users size={22} /><p>Hozircha lead yo&apos;q.</p></div>
        )}
      </section>

      {openId ? <LeadDrawer leadId={openId} onClose={() => setOpenId("")} /> : null}
    </>
  );
}
