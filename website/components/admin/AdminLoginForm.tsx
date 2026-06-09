"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";

export default function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin-auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Kirishda xatolik");
      }
      router.replace("/admin/hero");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirishda xatolik");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="admin-login-card" onSubmit={handleSubmit}>
      <div className="admin-login-card__mark">
        <Compass size={24} />
      </div>
      <p className="admin-eyebrow">TravelorAI Admin</p>
      <h1>Hero rasmlarni boshqarish</h1>
      <p className="admin-login-card__lead">
        Website va mobile app hero slaydlarini tartib bilan boshqarish uchun kiring.
      </p>

      {error ? <div className="admin-alert admin-alert--error">{error}</div> : null}

      <label>
        Login
        <input
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="admin"
        />
      </label>

      <label>
        Parol
        <input
          autoComplete="current-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Parol"
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? "Tekshirilmoqda..." : "Admin panelga kirish"}
      </button>
    </form>
  );
}
