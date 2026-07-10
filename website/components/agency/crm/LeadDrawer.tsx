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
  Pencil,
  Phone,
  RotateCcw,
  Send,
  Tag,
  Trash2,
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
  removeLead,
  setHidden,
  setOverride,
  SUGGESTED_TAGS,
  telegramLink,
  timeAgo,
  toggleTag,
  updateManualLead,
  whatsappLink,
  type CrmStage,
} from "@/lib/agency/crm";

const ACT_ICON: Record<string, string> = { note: "📝", stage: "🔀", call: "📞", message: "💬", created: "✨" };

export default function LeadDrawer({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { agencyId, leads, hiddenLeads, move, busyId } = useCrm();
  const lead = useMemo(() => [...leads, ...hiddenLeads].find((l) => l.id === leadId), [leads, hiddenLeads, leadId]);
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  // edit fields
  const [eName, setEName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [eTravelers, setETravelers] = useState(1);
  const [eDate, setEDate] = useState("");
  const [eEstimate, setEEstimate] = useState("");
  const [eTour, setETour] = useState("");

  if (!lead) return null;

  const greeting = greetingTemplate(lead);
  const wa = whatsappLink(lead.customerPhone, greeting);
  const tg = telegramLink(lead.customerPhone);

  function startEdit() {
    setEName(lead!.customerName);
    setEPhone(lead!.customerPhone || "");
    setEEmail(lead!.customerEmail || "");
    setETravelers(lead!.travelers || 1);
    setEDate(lead!.travelDate ? String(lead!.travelDate).slice(0, 10) : "");
    setEEstimate(lead!.totalEstimate ? String(lead!.totalEstimate) : "");
    setETour(lead!.tourTitle || "");
    setEditing(true);
  }
  function saveEdit() {
    const patch = {
      customerName: eName.trim() || lead!.customerName,
      customerPhone: ePhone.trim() || undefined,
      customerEmail: eEmail.trim() || undefined,
      travelers: Math.max(1, Number(eTravelers) || 1),
      tourTitle: eTour.trim() || undefined,
      totalEstimate: eEstimate ? Number(eEstimate.replace(/[^\d]/g, "")) : null,
      travelDate: eDate || null,
    };
    if (lead!.source === "manual") updateManualLead(agencyId, lead!.id, patch);
    else setOverride(agencyId, lead!.id, patch);
    setEditing(false);
  }
  function onDelete() {
    const msg = lead!.source === "manual" ? "Bu leadni o'chirasizmi?" : "Bu leadni arxivlaysizmi?";
    if (!window.confirm(msg)) return;
    removeLead(agencyId, lead!);
    onClose();
  }

  function logCall() { addActivity(agencyId, lead!.id, "call", "Qo'ng'iroq qilindi"); }
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
    addTask(agencyId, { leadId: lead!.id, leadName: lead!.customerName, title: taskTitle.trim(), dueAt: taskDue ? new Date(taskDue).toISOString() : undefined });
    setTaskTitle("");
    setTaskDue("");
  }

  return (
    <div className="crm-drawer-backdrop" onClick={onClose}>
      <aside className="crm-drawer" onClick={(e) => e.stopPropagation()} aria-label="Lead tafsilotlari">
        <header className="crm-drawer__head">
          <div>
            <span className={`crm-source crm-source--${lead.source}`}>{lead.source === "manual" ? "Qo'lda" : "Marketplace"}</span>
            {lead.hidden ? <span className="crm-source" style={{ background: "#eef0f3", color: "#737985", marginLeft: 6 }}>Arxivda</span> : null}
            <h3>{lead.customerName}</h3>
            <small>{lead.tourTitle || "Tur ko'rsatilmagan"}{lead.tourCity ? ` · ${lead.tourCity}` : ""}</small>
          </div>
          <div className="crm-drawer__headbtns">
            {lead.hidden ? (
              <button className="crm-icon-btn" onClick={() => { setHidden(agencyId, lead.id, false); }} title="Arxivdan tiklash" type="button"><RotateCcw size={16} /></button>
            ) : (
              <button className="crm-icon-btn" onClick={startEdit} title="Tahrirlash" type="button"><Pencil size={16} /></button>
            )}
            <button className="crm-icon-btn crm-icon-btn--danger" onClick={onDelete} title={lead.source === "manual" ? "O'chirish" : "Arxivlash"} type="button"><Trash2 size={16} /></button>
            <button className="crm-icon-btn" onClick={onClose} aria-label="Yopish" type="button"><X size={18} /></button>
          </div>
        </header>

        {editing ? (
          <div className="crm-edit">
            <div className="crm-form__row">
              <label>Ism<input value={eName} onChange={(e) => setEName(e.target.value)} /></label>
              <label>Telefon<input value={ePhone} onChange={(e) => setEPhone(e.target.value)} /></label>
            </div>
            <div className="crm-form__row">
              <label>Email<input value={eEmail} onChange={(e) => setEEmail(e.target.value)} /></label>
              <label>Sayohatchilar<input type="number" min={1} value={eTravelers} onChange={(e) => setETravelers(Number(e.target.value))} /></label>
            </div>
            <div className="crm-form__row">
              <label>Tur<input value={eTour} onChange={(e) => setETour(e.target.value)} /></label>
              <label>Sana<input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} /></label>
            </div>
            <label>Summa ($)<input value={eEstimate} onChange={(e) => setEEstimate(e.target.value)} /></label>
            <div className="crm-edit__actions">
              <button className="crm-btn" onClick={() => setEditing(false)} type="button">Bekor</button>
              <button className="crm-btn crm-btn--primary" onClick={saveEdit} type="button"><Check size={15} /> Saqlash</button>
            </div>
          </div>
        ) : (
          <>
            <div className="crm-drawer__actions">
              {lead.customerPhone ? <a className="crm-qa crm-qa--call" href={`tel:${lead.customerPhone}`} onClick={logCall}><Phone size={16} /> Qo&apos;ng&apos;iroq</a> : null}
              {wa ? <a className="crm-qa crm-qa--wa" href={wa} target="_blank" rel="noreferrer" onClick={() => addActivity(agencyId, lead.id, "message", "WhatsApp xabari yuborildi")}><MessageCircle size={16} /> WhatsApp</a> : null}
              {tg ? <a className="crm-qa crm-qa--tg" href={tg} target="_blank" rel="noreferrer" onClick={() => addActivity(agencyId, lead.id, "message", "Telegram ochildi")}><Send size={16} /> Telegram</a> : null}
              {lead.customerEmail ? <a className="crm-qa" href={`mailto:${lead.customerEmail}`}><Mail size={16} /> Email</a> : null}
              {lead.customerPhone ? <button className="crm-qa" onClick={copyPhone} type="button">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Nusxalandi" : "Raqam"}</button> : null}
            </div>

            <div className="crm-facts">
              {lead.customerPhone ? <span><Phone size={13} /> {lead.customerPhone}</span> : null}
              {lead.customerEmail ? <span><Mail size={13} /> {lead.customerEmail}</span> : null}
              <span><Users size={13} /> {lead.travelers} kishi</span>
              {lead.travelDate ? <span><CalendarClock size={13} /> {formatDateTime(lead.travelDate)}</span> : null}
              {lead.totalEstimate ? <span><BadgeDollarSign size={13} /> {formatMoney(lead.totalEstimate)}</span> : null}
            </div>

            {lead.message ? <p className="crm-drawer__msg">“{lead.message}”</p> : null}
          </>
        )}

        <div className="crm-block">
          <div className="crm-block__label">Bosqich</div>
          <div className="crm-stage-pills">
            {CRM_STAGES.map((s) => (
              <button key={s.key} className={`crm-stage-pill crm-stage-pill--${s.key}${lead.stage === s.key ? " is-active" : ""}`} onClick={() => void move(lead, s.key as CrmStage)} disabled={busyId === lead.id} title={s.hint} type="button">{s.label}</button>
            ))}
          </div>
        </div>

        <div className="crm-block">
          <div className="crm-block__label"><Tag size={13} /> Teglar</div>
          <div className="crm-tags">
            {SUGGESTED_TAGS.map((t) => (
              <button key={t} className={`crm-tag${lead.tags.includes(t) ? " is-active" : ""}`} onClick={() => toggleTag(agencyId, lead.id, t)} type="button">{t}</button>
            ))}
          </div>
        </div>

        <div className="crm-block">
          <div className="crm-block__label"><CalendarPlus size={13} /> Eslatma / vazifa</div>
          <div className="crm-task-add">
            <input placeholder="Masalan: ertaga qo'ng'iroq qilish" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            <input type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            <button onClick={submitTask} type="button" disabled={!taskTitle.trim()}>Qo&apos;shish</button>
          </div>
        </div>

        <div className="crm-block">
          <div className="crm-block__label">Izoh qo&apos;shish</div>
          <div className="crm-note-add">
            <textarea placeholder="Suhbat natijasi, kelishuv..." value={note} onChange={(e) => setNote(e.target.value)} />
            <button onClick={submitNote} type="button" disabled={!note.trim()}>Saqlash</button>
          </div>
        </div>

        <div className="crm-block">
          <div className="crm-block__label">Faoliyat tarixi</div>
          {lead.activities.length ? (
            <ul className="crm-timeline">
              {lead.activities.map((a) => (
                <li key={a.id}><span className="crm-timeline__ico">{ACT_ICON[a.type] || "•"}</span><div><p>{a.text}</p><small>{timeAgo(a.at)}</small></div></li>
              ))}
            </ul>
          ) : (
            <p className="crm-muted">Hali faoliyat yo&apos;q. Qo&apos;ng&apos;iroq qiling yoki izoh qoldiring.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
