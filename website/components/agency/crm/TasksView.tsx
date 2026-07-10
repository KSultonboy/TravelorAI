"use client";

import { useMemo, useState } from "react";
import { AlarmClock, CheckCircle2, Circle, ListTodo, Trash2 } from "lucide-react";
import { useCrm } from "@/lib/agency/useCrm";
import { deleteTask, toggleTask, type Task } from "@/lib/agency/crm";
import { formatDateTime } from "@/lib/agency/api";
import LeadDrawer from "./LeadDrawer";

function bucketOf(t: Task): "overdue" | "today" | "upcoming" | "nodate" {
  if (!t.dueAt) return "nodate";
  const due = new Date(t.dueAt).getTime();
  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (due < now) return "overdue";
  if (due <= endOfToday.getTime()) return "today";
  return "upcoming";
}

const GROUPS: { key: "overdue" | "today" | "upcoming" | "nodate"; label: string }[] = [
  { key: "overdue", label: "Muddati o'tgan" },
  { key: "today", label: "Bugun" },
  { key: "upcoming", label: "Kelgusi" },
  { key: "nodate", label: "Muddatsiz" },
];

export default function TasksView() {
  const { agencyId, tasks } = useCrm();
  const [openId, setOpenId] = useState("");

  const { open, done } = useMemo(() => {
    const o = tasks.filter((t) => !t.done);
    const d = tasks.filter((t) => t.done);
    return { open: o, done: d };
  }, [tasks]);

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = { overdue: [], today: [], upcoming: [], nodate: [] };
    for (const t of open) map[bucketOf(t)].push(t);
    for (const k of Object.keys(map)) map[k].sort((a, b) => new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime());
    return map;
  }, [open]);

  function Row({ t }: { t: Task }) {
    return (
      <li className={`crm-task crm-task--${bucketOf(t)}`}>
        <button className="crm-task__check" onClick={() => toggleTask(agencyId, t.id)} type="button" aria-label="Bajarildi">
          {t.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>
        <div className="crm-task__body">
          <p className={t.done ? "is-done" : ""}>{t.title}</p>
          <small>
            {t.dueAt ? <><AlarmClock size={12} /> {formatDateTime(t.dueAt)}</> : "muddatsiz"}
            {t.leadName ? (
              <> · <button className="crm-task__lead" onClick={() => t.leadId && setOpenId(t.leadId)} type="button">{t.leadName}</button></>
            ) : null}
          </small>
        </div>
        <button className="crm-icon-btn crm-task__del" onClick={() => deleteTask(agencyId, t.id)} type="button" aria-label="O'chirish">
          <Trash2 size={15} />
        </button>
      </li>
    );
  }

  return (
    <section className="agency-dashboard-section">
      <header className="agency-section-head">
        <div>
          <p className="agency-eyebrow">CRM · Follow-up</p>
          <h2>Vazifalar</h2>
          <p className="agency-muted">Hech bir leadni unutmang — qo&apos;ng&apos;iroqlar va eslatmalar shu yerda.</p>
        </div>
        <div className="crm-count-pill"><ListTodo size={14} /> {open.length} ochiq</div>
      </header>

      {open.length === 0 && done.length === 0 ? (
        <div className="agency-empty-state"><ListTodo size={28} /><p>Hali vazifa yo&apos;q. Lead ichida &quot;Eslatma qo&apos;shish&quot; orqali yarating.</p></div>
      ) : null}

      {GROUPS.map((g) =>
        grouped[g.key].length ? (
          <div className="crm-task-group" key={g.key}>
            <div className={`crm-task-group__label crm-task-group__label--${g.key}`}>{g.label} <span>{grouped[g.key].length}</span></div>
            <ul className="crm-task-list">{grouped[g.key].map((t) => <Row t={t} key={t.id} />)}</ul>
          </div>
        ) : null
      )}

      {done.length ? (
        <div className="crm-task-group">
          <div className="crm-task-group__label crm-task-group__label--done">Bajarilgan <span>{done.length}</span></div>
          <ul className="crm-task-list crm-task-list--done">{done.slice(0, 20).map((t) => <Row t={t} key={t.id} />)}</ul>
        </div>
      ) : null}

      {openId ? <LeadDrawer leadId={openId} onClose={() => setOpenId("")} /> : null}
    </section>
  );
}
