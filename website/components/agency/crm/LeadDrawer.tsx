"use client";

import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarClock,
  CalendarPlus,
  Check,
  Copy,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Tag,
  Users,
  X,
} from "lucide-react";
import { formatDateTime, formatMoney } from "@/lib/agency/api";
import { useCrm } from "@/lib/agency/useCrm";
import {
  addActivity,
  addTask,
  CRM_STAGES,
  greetingTemplate,
  SUGGESTED_TAGS,
  telegramLink,
  timeAgo,
  toggleTag,
  whatsappLink,
  type CrmStage,
} from "@/lib/agency/crm";

const ACT_ICON: Record<string, string> = { note: "📝", stage: "🔀", call: "📞", message: "💬", created: "✨" };

export default function LeadDrawer({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { agencyId, leads, move, busyId } = useCrm();
  const lead = useMemo(() => leads.find((l) => l.id === leadId), [leads, leadId]);
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [copied, setCopied] = useState(false);

  if (!lead) return null;

  const greeting = greetingTemplate(lead);
  const wa = whatsappLink(lead.customerPhone, greeting);
  const tg = telegramLink(lead.customerPhone);

  function logCall() {
    addActivity(agencyId, lead!.id, "call", "Qo'ng'iroq qilindi");
  }
  function copyPhone() {
    if (!lead?.customerPhone) return;
    void navigator.clipboard.writeText(lead.customerPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  function submitNote() {
    if (!note.trim()) return;
    addActivity(agencyId, lead!.id, "note", note.trim());
    setNote("");
  }
  function submitTask() {
    if (!taskTitle.trim()) return;
    addTask(agencyId, {
      leadId: lead!.id,
      leadName: lead!.customerName,
      title: taskTitle.trim(),
      dueAt: taskDue ? new Date(taskDue).toISOString() : undefined,
    });
    setTaskTitle("");
    setTaskDue("");
  }

  return (
    <div className="crm-drawer-backdrop" onClick={onClose}>
      <aside className="crm-drawer" onClick={(e) => e.stopPropagation()} aria-label="Lead tafsilotlari">
        <header className="crm-drawer__head">
          <div>
            <span className={`crm-source crm-source--${lead.source}`}>
              {lead.source === "manual" ? "Qo'lda" : "Marketplace"}
            </span>
            <h3>{lead.customerName}</h3>
            <small>
              {lead.tourTitle || "Tur ko'rsatilmagan"}
              {lead.tourCity ? ` · ${lead.tourCity}` : ""}
            </small>
          </div>
          <button className="crm-icon-btn" onClick={onClose} aria-label="Yopish" type="button">
            <X size={18} />
          </button>
        </header>

        {/* quick actions */}
        <div className="crm-drawer__actions">
          {lead.customerPhone ? (
            <a className="crm-qa crm-qa--call" href={`tel:${lead.customerPhone}`} onClick={logCall}>
              <Phone size={16} /> Qo'ng'iroq
            </a>
          ) : null}
          {wa ? (
            <a className="crm-qa crm-qa--wa" href={wa} target="_blank" rel="noreferrer" onClick={() => addActivity(agencyId, lead.id, "message", "WhatsApp xabari yuborildi")}>
              <MessageCircle size={16} /> WhatsApp
            </a>
          ) : null}
          {tg ? (
            <a className="crm-qa crm-qa--tg" href={tg} target="_blank" rel="noreferrer" onClick={() => addActivity(agencyId, lead.id, "message", "Telegram ochildi")}>
              <Send size={16} /> Telegram
            </a>
          ) : null}
          {lead.customerEmail ? (
            <a className="crm-qa" href={`mailto:${lead.customerEmail}`}>
              <Mail size={16} /> Email
            </a>
          ) : null}
          {lead.customerPhone ? (
            <button className="crm-qa" onClick={copyPhone} type="button">
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Nusxalandi" : "Raqam"}
            </button>
          ) : null}
        </div>

        {/* contact facts */}
        <div className="crm-facts">
          {lead.customerPhone ? <span><Phone size={13} /> {lead.customerPhone}</span> : null}
          {lead.customerEmail ? <span><Mail size={13} /> {lead.customerEmail}</span> : null}
          <span><Users size={13} /> {lead.travelers} kishi</span>
          {lead.travelDate ? <span><CalendarClock size={13} /> {formatDateTime(lead.travelDate)}</span> : null}
          {lead.totalEstimate ? <span><BadgeDollarSign size={13} /> {formatMoney(lead.totalEstimate)}</span> : null}
        </div>

        {lead.message ? <p className="crm-drawer__msg">“{lead.message}”</p> : null}

        {/* stage */}
        <div className="crm-block">
          <div className="crm-block__label">Bosqich</div>
          <div className="crm-stage-pills">
            {CRM_STAGES.map((s) => (
              <button
                key={s.key}
                className={`crm-stage-pill crm-stage-pill--${s.key}${lead.stage === s.key ? " is-active" : ""}`}
                onClick={() => void move(lead, s.key as CrmStage)}
                disabled={busyId === lead.id}
                title={s.hint}
                type="button"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* tags */}
        <div className="crm-block">
          <div className="crm-block__label"><Tag size={13} /> Teglar</div>
          <div className="crm-tags">
            {SUGGESTED_TAGS.map((t) => (
              <button
                key={t}
                className={`crm-tag${lead.tags.includes(t) ? " is-active" : ""}`}
                onClick={() => toggleTag(agencyId, lead.id, t)}
                type="button"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* add task */}
        <div className="crm-block">
          <div className="crm-block__label"><CalendarPlus size={13} /> Eslatma / vazifa</div>
          <div className="crm-task-add">
            <input
              placeholder="Masalan: ertaga qo'ng'iroq qilish"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <input type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            <button onClick={submitTask} type="button" disabled={!taskTitle.trim()}>Qo'shish</button>
          </div>
        </div>

        {/* add note */}
        <div className="crm-block">
          <div className="crm-block__label">Izoh qo'shish</div>
          <div className="crm-note-add">
            <textarea placeholder="Suhbat natijasi, kelishuv..." value={note} onChange={(e) => setNote(e.target.value)} />
            <button onClick={submitNote} type="button" disabled={!note.trim()}>Saqlash</button>
          </div>
        </div>

        {/* timeline */}
        <div className="crm-block">
          <div className="crm-block__label">Faoliyat tarixi</div>
          {lead.activities.length ? (
            <ul className="crm-timeline">
              {lead.activities.map((a) => (
                <li key={a.id}>
                  <span className="crm-timeline__ico">{ACT_ICON[a.type] || "•"}</span>
                  <div>
                    <p>{a.text}</p>
                    <small>{timeAgo(a.at)}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="crm-muted">Hali faoliyat yo'q. Qo'ng'iroq qiling yoki izoh qoldiring.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
