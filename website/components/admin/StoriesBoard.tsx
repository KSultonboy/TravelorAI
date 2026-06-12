"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquareQuote, Pencil, Plus, RefreshCw, Star, Trash2, X } from "lucide-react";
import { adminApi } from "@/lib/admin/api";

type StoryItem = {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string;
  avatar?: string | null;
  rating?: number;
  active?: boolean;
  featured?: boolean;
  sortOrder?: number;
};

type StoryForm = {
  quote: string;
  authorName: string;
  authorRole: string;
  avatar: string;
  rating: string;
};

const emptyForm: StoryForm = { quote: "", authorName: "", authorRole: "", avatar: "", rating: "5" };

export default function StoriesBoard() {
  const [items, setItems] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<StoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await adminApi<{ items: StoryItem[] }>("/stories");
    if (result.success) setItems(result.data.items || []);
    else setError(result.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function update(key: keyof StoryForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage("");
  }

  function startEdit(item: StoryItem) {
    setEditId(item.id);
    setForm({
      quote: item.quote || "",
      authorName: item.authorName || "",
      authorRole: item.authorRole || "",
      avatar: item.avatar || "",
      rating: String(item.rating ?? 5),
    });
    setShowForm(true);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!form.quote.trim() || !form.authorName.trim() || !form.authorRole.trim()) {
      setError("Fikr matni, ism va rol majburiy.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = { ...form, rating: Number(form.rating) || 5 };
    const result = editId
      ? await adminApi(`/stories/${editId}`, { method: "PUT", body: JSON.stringify(payload) })
      : await adminApi("/stories", { method: "POST", body: JSON.stringify(payload) });
    if (result.success) {
      setMessage(editId ? "Story yangilandi." : "Story qo'shildi.");
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      await load();
    } else {
      setError(result.message);
    }
    setSaving(false);
  }

  async function toggle(item: StoryItem, key: "active" | "featured") {
    setBusyId(item.id);
    const result = await adminApi(`/stories/${item.id}`, {
      method: "PUT",
      body: JSON.stringify({ [key]: !item[key] }),
    });
    if (result.success) await load();
    else setError(result.message);
    setBusyId("");
  }

  async function remove(item: StoryItem) {
    if (!window.confirm(`"${item.authorName}" fikri o'chirilsinmi?`)) return;
    setBusyId(item.id);
    const result = await adminApi(`/stories/${item.id}`, { method: "DELETE" });
    if (result.success) await load();
    else setError(result.message);
    setBusyId("");
  }

  return (
    <>
      <header className="admin-head-v2">
        <div>
          <p className="admin-eyebrow">Landing kontent</p>
          <h1>Sayohatchi fikrlari</h1>
          <p className="admin-muted">Landing sahifadagi &quot;stories&quot; bo&apos;limi shu yerdan boshqariladi.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="admin-ghost-v2" disabled={loading} onClick={() => void load()} type="button">
            {loading ? <Loader2 className="admin-spin" size={16} /> : <RefreshCw size={16} />} Yangilash
          </button>
          <button className="admin-cta-v2" onClick={startCreate} type="button">
            <Plus size={16} /> Yangi fikr
          </button>
        </div>
      </header>

      {message ? <div className="admin-alert admin-alert--success">{message}</div> : null}
      {error ? <div className="admin-alert admin-alert--error">{error}</div> : null}

      {showForm ? (
        <section className="admin-panel admin-form-v2">
          <div className="admin-panel__head">
            <h3>{editId ? "Fikrni tahrirlash" : "Yangi fikr"}</h3>
            <button className="admin-ghost-v2" onClick={() => setShowForm(false)} type="button">
              <X size={15} /> Yopish
            </button>
          </div>
          <div className="admin-form-grid-v2">
            <label className="admin-wide-v2">
              <span>Fikr matni *</span>
              <textarea value={form.quote} onChange={(event) => update("quote", event.target.value)} />
            </label>
            <label>
              <span>Ism *</span>
              <input value={form.authorName} onChange={(event) => update("authorName", event.target.value)} />
            </label>
            <label>
              <span>Rol (masalan: Sayohatchi, Toshkent) *</span>
              <input value={form.authorRole} onChange={(event) => update("authorRole", event.target.value)} />
            </label>
            <label>
              <span>Avatar URL</span>
              <input value={form.avatar} onChange={(event) => update("avatar", event.target.value)} />
            </label>
            <label>
              <span>Baho (1–5)</span>
              <input inputMode="numeric" maxLength={1} value={form.rating} onChange={(event) => update("rating", event.target.value.replace(/\D/g, ""))} />
            </label>
          </div>
          <button className="admin-cta-v2" disabled={saving} onClick={() => void save()} type="button">
            {saving ? <Loader2 className="admin-spin" size={16} /> : <Plus size={16} />} {editId ? "Saqlash" : "Qo'shish"}
          </button>
        </section>
      ) : null}

      {loading ? (
        <div className="admin-loading">
          <Loader2 className="admin-spin" size={22} /> Yuklanmoqda…
        </div>
      ) : items.length ? (
        <div className="admin-lead-table">
          {items.map((item) => (
            <article className="admin-lead-row" key={item.id}>
              <div className="admin-lead-row__main">
                <b>
                  {item.authorName} <small style={{ fontWeight: 600 }}>· {item.authorRole}</small>
                </b>
                <p>{item.quote}</p>
                <small>
                  <Star size={12} /> {item.rating ?? 5}/5
                </small>
              </div>
              <div className="admin-lead-row__side">
                <span className={`admin-chip ${item.active ? "admin-chip--approved" : "admin-chip--rejected"}`}>
                  {item.active ? "Faol" : "Yashirin"}
                </span>
                {item.featured ? <span className="admin-chip admin-chip--pending">Featured</span> : null}
                <div className="admin-lead-row__actions">
                  <button disabled={busyId === item.id} onClick={() => void toggle(item, "active")} type="button">
                    {item.active ? "Yashirish" : "Faollashtirish"}
                  </button>
                  <button disabled={busyId === item.id} onClick={() => startEdit(item)} type="button">
                    <Pencil size={13} /> Tahrirlash
                  </button>
                  <button className="admin-danger-v2" disabled={busyId === item.id} onClick={() => void remove(item)} type="button">
                    <Trash2 size={13} /> O&apos;chirish
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty">
          <MessageSquareQuote size={22} /> Hozircha fikr qo&apos;shilmagan.
        </div>
      )}
    </>
  );
}
