"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { addManualLead } from "@/lib/agency/crm";

export default function ManualLeadModal({
  agencyId,
  onClose,
  onCreated,
}: {
  agencyId: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [travelers, setTravelers] = useState(1);
  const [travelDate, setTravelDate] = useState("");
  const [tourTitle, setTourTitle] = useState("");
  const [estimate, setEstimate] = useState("");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setErr("Mijoz ismini kiriting.");
      return;
    }
    const id = addManualLead(agencyId, {
      customerName: name.trim(),
      customerPhone: phone.trim() || undefined,
      customerEmail: email.trim() || undefined,
      travelers: Math.max(1, travelers),
      travelDate: travelDate || null,
      tourTitle: tourTitle.trim() || undefined,
      totalEstimate: estimate ? Number(estimate.replace(/[^\d]/g, "")) : null,
      message: message.trim() || undefined,
      currency: "USD",
    });
    onCreated?.(id);
    onClose();
  }

  return (
    <div className="crm-drawer-backdrop" onClick={onClose}>
      <div className="crm-modal" onClick={(e) => e.stopPropagation()}>
        <header className="crm-modal__head">
          <h3><UserPlus size={18} /> Qo&apos;lda lead qo&apos;shish</h3>
          <button className="crm-icon-btn" onClick={onClose} type="button" aria-label="Yopish"><X size={18} /></button>
        </header>
        <p className="crm-modal__hint">Instagram, telefon yoki tavsiya orqali kelgan mijozni ham shu yerda yuriting.</p>
        {err ? <div className="agency-alert agency-alert--error">{err}</div> : null}
        <form className="crm-form" onSubmit={submit}>
          <label>Mijoz ismi *<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Aziz Karimov" /></label>
          <div className="crm-form__row">
            <label>Telefon<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" /></label>
            <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ixtiyoriy" /></label>
          </div>
          <div className="crm-form__row">
            <label>Sayohatchilar<input type="number" min={1} value={travelers} onChange={(e) => setTravelers(Number(e.target.value))} /></label>
            <label>Sana<input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} /></label>
          </div>
          <div className="crm-form__row">
            <label>Tur / yo&apos;nalish<input value={tourTitle} onChange={(e) => setTourTitle(e.target.value)} placeholder="Masalan: Dubay 5 kun" /></label>
            <label>Taxminiy summa ($)<input value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="masalan: 800" /></label>
          </div>
          <label>Izoh<textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mijoz nima so'radi..." /></label>
          <button className="crm-btn crm-btn--primary" type="submit">Lead qo&apos;shish</button>
        </form>
      </div>
    </div>
  );
}
