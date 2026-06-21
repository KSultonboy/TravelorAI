"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, ImagePlus, Loader2, LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { publicImageSrc } from "@/lib/imageUrls";

type HeroSlide = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  actionUrl: string | null;
  placeSlug: string | null;
  sortOrder: number;
  active: boolean;
  source: string;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  confidenceScore: number;
  createdAt: string;
  updatedAt: string;
};

type HeroSlideForm = {
  title: string;
  subtitle: string;
  imageUrl: string;
  actionUrl: string;
  placeSlug: string;
  sortOrder: string;
  active: boolean;
  confidenceScore: string;
};

const emptyForm: HeroSlideForm = {
  title: "",
  subtitle: "",
  imageUrl: "",
  actionUrl: "",
  placeSlug: "",
  sortOrder: "0",
  active: true,
  confidenceScore: "0.9",
};

const MAX_HERO_IMAGE_BYTES = 8 * 1024 * 1024;

function isImageDataUrl(value: string) {
  return /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value);
}

function AdminPreviewImage({ src, alt }: { src: string; alt: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src && failedSrc === src);

  if (!src || failed) {
    return (
      <div className="admin-preview__empty">
        <ImagePlus size={28} />
        {src ? "Rasm ochilmadi, URL yoki faylni tekshiring" : "Rasm URL kiriting yoki fayl tanlang"}
      </div>
    );
  }

  return <img src={publicImageSrc(src)} alt={alt} onError={() => setFailedSrc(src)} />;
}

function AdminThumbImage({ src, alt }: { src: string; alt: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src && failedSrc === src);

  if (!src || failed) {
    return (
      <div className="admin-list-placeholder">
        <ImagePlus size={22} />
      </div>
    );
  }

  return <img src={publicImageSrc(src)} alt={alt} onError={() => setFailedSrc(src)} />;
}

function toForm(item: HeroSlide): HeroSlideForm {
  return {
    title: item.title,
    subtitle: item.subtitle || "",
    imageUrl: item.imageUrl,
    actionUrl: item.actionUrl || "",
    placeSlug: item.placeSlug || "",
    sortOrder: String(item.sortOrder ?? 0),
    active: item.active,
    confidenceScore: String(item.confidenceScore ?? 0.9),
  };
}

export default function HeroSlidesAdmin({ username }: { username: string }) {
  const [items, setItems] = useState<HeroSlide[]>([]);
  const [form, setForm] = useState<HeroSlideForm>(emptyForm);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  async function loadItems() {
    setLoading(true);
    setError("");
    try {
      const healthResponse = await fetch("/api/agency-proxy/health", { cache: "no-store" });
      const health = await healthResponse.json().catch(() => ({}));
      if (!healthResponse.ok || health?.db !== "connected") {
        throw new Error(
          `Backend DB ulanmagan (db: ${health?.db || "unknown"}, cache: ${health?.cache || "unknown"}).`
        );
      }

      const response = await fetch("/api/admin-proxy/admin/hero-slides", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Slaydlar yuklanmadi");
      setItems(payload.data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Slaydlar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  function updateField<K extends keyof HeroSlideForm>(key: K, value: HeroSlideForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleImageFile(file: File | null) {
    setMessage("");
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Faqat rasm fayl tanlang");
      return;
    }
    if (file.size > MAX_HERO_IMAGE_BYTES) {
      setError("Rasm hajmi 8 MB dan oshmasin. Kichikroq rasm tanlang yoki URL kiriting.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      if (!isImageDataUrl(value)) {
        setError("Rasm faylini o'qib bo'lmadi");
        return;
      }
      updateField("imageUrl", value);
      setMessage("Rasm yuklandi. Saqlashni bosing.");
    };
    reader.onerror = () => setError("Rasm faylini o'qishda xatolik");
    reader.readAsDataURL(file);
  }

  function clearForm() {
    setSelectedId(null);
    setForm(emptyForm);
    setFileInputKey((current) => current + 1);
  }

  function resetForm() {
    clearForm();
    setMessage("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        selectedId
          ? `/api/admin-proxy/admin/hero-slides/${encodeURIComponent(selectedId)}`
          : "/api/admin-proxy/admin/hero-slides",
        {
          method: selectedId ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...form,
            sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
            confidenceScore: Number(form.confidenceScore) || 0.8,
          }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.message || "Saqlashda xatolik");
      const successMessage = selectedId ? "Slayd yangilandi" : "Yangi slayd qo'shildi";
      await loadItems();
      clearForm();
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Bu hero slaydni o'chirasizmi?");
    if (!confirmed) return;

    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin-proxy/admin/hero-slides/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.message || "O'chirishda xatolik");
      if (selectedId === id) resetForm();
      setMessage("Slayd o'chirildi");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'chirishda xatolik");
    }
  }

  async function handleLogout() {
    await fetch("/api/admin-auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="admin-shell">
      <aside className="admin-aside">
        <div>
          <div className="admin-brand">
            <span>TravelorAI</span>
            <small>Admin</small>
          </div>
          <nav>
            <a className="active" href="/admin/hero">
              <ImagePlus size={18} />
              Hero rasmlar
            </a>
          </nav>
        </div>
        <button className="admin-logout" onClick={handleLogout} type="button">
          <LogOut size={17} />
          Chiqish
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">Kirish: {username}</p>
            <h1>Hero slaydlar ketma-ketligi</h1>
            <p>Mobile app va website hero background rasmlari shu yerdan boshqariladi.</p>
          </div>
          <button className="admin-secondary" onClick={resetForm} type="button">
            <Plus size={17} />
            Yangi slayd
          </button>
        </header>

        {(message || error) && (
          <div className={error ? "admin-alert admin-alert--error" : "admin-alert admin-alert--success"}>
            {error || message}
          </div>
        )}

        <section className="admin-grid">
          <div className="admin-panel">
            <div className="admin-panel__head">
              <div>
                <p className="admin-eyebrow">Preview</p>
                <h2>{selectedItem ? "Slaydni tahrirlash" : "Yangi hero rasm"}</h2>
              </div>
            </div>

            <div className="admin-preview">
              <AdminPreviewImage src={form.imageUrl} alt={form.title || "Hero preview"} />
              <div>
                <span>#{form.sortOrder || 0}</span>
                <strong>{form.title || "Hero sarlavha"}</strong>
                <p>{form.subtitle || "Subtitle shu yerda ko'rinadi."}</p>
              </div>
            </div>

            <form className="admin-form" onSubmit={handleSubmit}>
              <label>
                Sarlavha
                <input
                  required
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder="Design Your Perfect Journey with AI"
                />
              </label>

              <label>
                Subtitle
                <textarea
                  rows={3}
                  value={form.subtitle}
                  onChange={(event) => updateField("subtitle", event.target.value)}
                  placeholder="Hero ostida chiqadigan qisqa matn"
                />
              </label>

              <label>
                Rasm URL
                <input
                  required
                  value={form.imageUrl}
                  onChange={(event) => updateField("imageUrl", event.target.value)}
                  placeholder="https://... yoki data:image..."
                />
              </label>

              <label>
                Rasm fayl yuklash
                <input
                  key={fileInputKey}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  type="file"
                  onChange={(event) => handleImageFile(event.target.files?.[0] || null)}
                />
              </label>

              <div className="admin-form__row">
                <label>
                  Tartib raqami
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(event) => updateField("sortOrder", event.target.value)}
                  />
                </label>
                <label>
                  Ishonchlilik
                  <input
                    max="1"
                    min="0"
                    step="0.05"
                    type="number"
                    value={form.confidenceScore}
                    onChange={(event) => updateField("confidenceScore", event.target.value)}
                  />
                </label>
              </div>

              <label>
                Action URL
                <input
                  value={form.actionUrl}
                  onChange={(event) => updateField("actionUrl", event.target.value)}
                  placeholder="https://travelorai.com/#features"
                />
              </label>

              <label>
                Place slug
                <input
                  value={form.placeSlug}
                  onChange={(event) => updateField("placeSlug", event.target.value)}
                  placeholder="samarqand-registon"
                />
              </label>

              <label className="admin-check">
                <input
                  checked={form.active}
                  type="checkbox"
                  onChange={(event) => updateField("active", event.target.checked)}
                />
                Aktiv slayd
              </label>

              <button type="submit" disabled={saving}>
                {saving ? <Loader2 className="admin-spin" size={17} /> : null}
                {selectedId ? "Yangilash" : "Qo'shish"}
              </button>
            </form>
          </div>

          <div className="admin-panel">
            <div className="admin-panel__head">
              <div>
                <p className="admin-eyebrow">Slaydlar</p>
                <h2>Ketma-ketlik</h2>
              </div>
              <button className="admin-icon-button" onClick={loadItems} type="button">
                Yangilash
              </button>
            </div>

            {loading ? (
              <div className="admin-loading">
                <Loader2 className="admin-spin" size={20} />
                Yuklanmoqda...
              </div>
            ) : (
              <div className="admin-slide-list">
                {items.map((item) => (
                  <article className={item.id === selectedId ? "is-selected" : ""} key={item.id}>
                    <AdminThumbImage src={item.imageUrl} alt={item.title} />
                    <div>
                      <div className="admin-slide-list__meta">
                        <span>#{item.sortOrder}</span>
                        <span>{item.active ? "Aktiv" : "O'chiq"}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.subtitle || "Subtitle yo'q"}</p>
                      <div className="admin-slide-list__actions">
                        <button onClick={() => { setSelectedId(item.id); setForm(toForm(item)); }} type="button">
                          <Pencil size={15} />
                          Edit
                        </button>
                        <a href={publicImageSrc(item.imageUrl)} target="_blank" rel="noreferrer">
                          <ExternalLink size={15} />
                          Rasm
                        </a>
                        <button onClick={() => handleDelete(item.id)} type="button">
                          <Trash2 size={15} />
                          O&apos;chirish
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {!items.length ? <div className="admin-empty">Hali hero slayd yo&apos;q.</div> : null}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
