"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Power, RefreshCw } from "lucide-react";
import { adminApi, adminStatusLabel, type AdminAgency } from "@/lib/admin/api";

export default function AgenciesBoard() {
  const [items, setItems] = useState<AdminAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await adminApi<{ items: AdminAgency[] }>("/agencies");
    if (result.success) setItems(result.data.items || []);
    else setError(result.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(agency: AdminAgency) {
    setBusyId(agency.id);
    setError("");
    const result = await adminApi(`/agencies/${agency.id}`, {
      method: "PUT",
      body: JSON.stringify({ active: !agency.active }),
    });
    if (result.success) await load();
    else setError(result.message);
    setBusyId("");
  }

  return (
    <>
      <header className="admin-head-v2">
        <div>
          <p className="admin-eyebrow">Hamkorlar</p>
          <h1>Agentliklar</h1>
          <p className="admin-muted">
            Faol agentliklar mobil ilova va webda ko&apos;rinadi. O&apos;chirilganlari publicdan yashirinadi.
          </p>
        </div>
        <button className="admin-ghost-v2" disabled={loading} onClick={() => void load()} type="button">
          {loading ? <Loader2 className="admin-spin" size={16} /> : <RefreshCw size={16} />} Yangilash
        </button>
      </header>

      {error ? <div className="admin-alert admin-alert--error">{error}</div> : null}

      {loading ? (
        <div className="admin-loading">
          <Loader2 className="admin-spin" size={22} /> Yuklanmoqda…
        </div>
      ) : items.length ? (
        <div className="admin-lead-table">
          {items.map((agency) => (
            <article className="admin-lead-row" key={agency.id}>
              <div className="admin-lead-row__main">
                <b>{agency.name}</b>
                <small>
                  {agency.city || "—"} · {agency.specialty || "Tours"} · Tourlar: {agency.tourCount ?? "—"}
                </small>
                <div className="admin-lead-row__contacts">
                  {agency.phone ? <span>📞 {agency.phone}</span> : null}
                  {agency.telegram ? <span>TG: {agency.telegram}</span> : null}
                  {agency.website ? <span>🌐 {agency.website}</span> : null}
                </div>
              </div>
              <div className="admin-lead-row__side">
                <span className={`admin-chip admin-chip--${agency.approvalStatus}`}>
                  {adminStatusLabel(agency.approvalStatus)}
                </span>
                <span className={`admin-chip ${agency.active ? "admin-chip--approved" : "admin-chip--rejected"}`}>
                  {agency.active ? "Faol" : "O'chirilgan"}
                </span>
                <div className="admin-lead-row__actions">
                  <button disabled={busyId === agency.id} onClick={() => void toggleActive(agency)} type="button">
                    {busyId === agency.id ? <Loader2 className="admin-spin" size={13} /> : <Power size={13} />}{" "}
                    {agency.active ? "O'chirish" : "Yoqish"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty">
          <Building2 size={22} /> Hozircha agentlik yo&apos;q.
        </div>
      )}
    </>
  );
}
