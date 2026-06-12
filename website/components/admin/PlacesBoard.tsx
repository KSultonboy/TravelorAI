"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, MapPinned, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { publicImageSrc } from "@/lib/imageUrls";
import { adminApi } from "@/lib/admin/api";

type PlaceItem = {
  id: string;
  name: string;
  city: string;
  type: string;
  description?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  featured?: boolean;
  landingActive?: boolean;
};

type PlaceForm = {
  name: string;
  city: string;
  lat: string;
  lng: string;
  type: string;
  description: string;
  imageUrl: string;
};

const TYPE_OPTIONS = [
  { value: "landmark", label: "Tarixiy / diqqatga sazovor" },
  { value: "hotel", label: "Mehmonxona" },
  { value: "restaurant", label: "Restoran" },
  { value: "transport", label: "Transport" },
];

const emptyForm: PlaceForm = { name: "", city: "", lat: "", lng: "", type: "landmark", description: "", imageUrl: "" };

export default function PlacesBoard() {
  const [items, setItems] = useState<PlaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PlaceForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await adminApi<{ items: PlaceItem[] }>("/places?limit=300");
    if (result.success) setItems(result.data.items || []);
    else setError(result.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function update(key: keyof PlaceForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function startEdit(item: PlaceItem & { lat?: number; lng?: number }) {
    setEditId(item.id);
    setForm({
      name: item.name || "",
      city: item.city || "",
      lat: item.lat != null ? String(item.lat) : "",
      lng: item.lng != null ? String(item.lng) : "",
      type: item.type || "landmark",
      description: item.description || "",
      imageUrl: item.imageUrl || "",
    });
    setShowForm(true);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!form.name.trim() || !form.city.trim() || !form.lat.trim() || !form.lng.trim()) {
      setError("Nomi, shahar, lat va lng majburiy.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      lat: Number(form.lat),
      lng: Number(form.lng),
      landingActive: true,
    };
    const result = editId
      ? await adminApi(`/places/${editId}`, { method: "PUT", body: JSON.stringify(payload) })
      : await adminApi("/places", { method: "POST", body: JSON.stringify(payload) });
    if (result.success) {
      setMessage(editId ? "Joy yangilandi." : "Joy qo'shildi.");
      setShowForm(false);
      setForm(emptyForm);
      setEditId(null);
      await load();
    } else {
      setError(result.message);
    }
    setSaving(false);
  }

  async function toggle(item: PlaceItem, key: "landingActive" | "featured") {
    setBusyId(item.id);
    const result = await adminApi(`/places/${item.id}`, {
      method: "PUT",
      body: JSON.stringify({ [key]: !item[key] }),
    });
    if (result.success) await load();
    else setError(result.message);
    setBusyId("");
  }

  async function remove(item: PlaceItem) {
    if (!window.confirm(`"${item.name}" o'chirilsinmi? Bu qaytarilmaydi.`)) return;
    setBusyId(item.id);
    const result = await adminApi(`/places/${item.id}`, { method: "DELETE" });
    if (result.success) await load();
    else setError(result.message);
    setBusyId("");
  }

  return (
    <>
      <header className="admin-head-v2">
        <div>
          <p className="admin-eyebrow">Landing kontent</p>
          <h1>Joylar (POI)</h1>
          <p className="admin-muted">Landing va mobil ilovada ko&apos;rinadigan diqqatga sazovor joylar.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="admin-ghost-v2" disabled={loading} onClick={() => void load()} type="button">
            {loading ? <Loader2 className="admin-spin" size={16} /> : <RefreshCw size={16} />} Yangilash
          </button>
          <button className="admin-cta-v2" onClick={startCreate} type="button">
            <Plus size={16} /> Yangi joy
          </button>
        </div>
      </header>

      {message ? <div className="admin-alert admin-alert--success">{message}</div> : null}
      {error ? <div className="admin-alert admin-alert--error">{error}</div> : null}

      {showForm ? (
        <section className="admin-panel admin-form-v2">
          <div className="admin-panel__head">
            <h3>{editId ? "Joyni tahrirlash" : "Yangi joy qo'shish"}</h3>
            <button className="admin-ghost-v2" onClick={() => setShowForm(false)} type="button">
              <X size={15} /> Yopish
            </button>
          </div>
          <div className="admin-form-grid-v2">
            <label>
              <span>Nomi *</span>
              <input value={form.name} onChange={(event) => update("name", event.target.value)} />
            </label>
            <label>
              <span>Shahar *</span>
              <input value={form.city} onChange={(event) => update("city", event.target.value)} />
            </label>
            <label>
              <span>Lat *</span>
              <input inputMode="decimal" value={form.lat} onChange={(event) => update("lat", event.target.value)} />
            </label>
            <label>
              <span>Lng *</span>
              <input inputMode="decimal" value={form.lng} onChange={(event) => update("lng", event.target.value)} />
            </label>
            <label>
              <span>Turi</span>
              <select value={form.type} onChange={(event) => update("type", event.target.value)}>
                {TYPE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Rasm URL</span>
              <input value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} />
            </label>
            <label className="admin-wide-v2">
              <span>Tavsif</span>
              <textarea value={form.description} onChange={(event) => update("description", event.target.value)} />
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
              <div className="admin-lead-row__main admin-lead-row__main--withimg">
                {item.imageUrl ? (
                  <Image unoptimized width={92} height={68} src={publicImageSrc(item.imageUrl)} alt={item.name} className="admin-row-thumb" />
                ) : (
                  <span className="admin-row-thumb admin-row-thumb--empty"><MapPinned size={18} /></span>
                )}
                <div>
                  <b>{item.name}</b>
                  <small>
                    {item.city} · {TYPE_OPTIONS.find((option) => option.value === item.type)?.label || item.type}
                    {item.rating ? ` · ★ ${item.rating}` : ""}
                  </small>
                </div>
              </div>
              <div className="admin-lead-row__side">
                <span className={`admin-chip ${item.landingActive ? "admin-chip--approved" : "admin-chip--rejected"}`}>
                  {item.landingActive ? "Landing'da" : "Yashirin"}
                </span>
                {item.featured ? <span className="admin-chip admin-chip--pending">Featured</span> : null}
                <div className="admin-lead-row__actions">
                  <button disabled={busyId === item.id} onClick={() => void toggle(item, "landingActive")} type="button">
                    {item.landingActive ? "Yashirish" : "Ko'rsatish"}
                  </button>
                  <button disabled={busyId === item.id} onClick={() => void toggle(item, "featured")} type="button">
                    {item.featured ? "Featured olib tashlash" : "Featured qilish"}
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
          <MapPinned size={22} /> Hozircha joy qo&apos;shilmagan.
        </div>
      )}
    </>
  );
}
