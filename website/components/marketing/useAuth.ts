"use client";

import { useCallback, useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  emailVerified?: boolean;
  authProvider?: string;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
};

/**
 * Foydalanuvchi sessiyasini (httpOnly cookie) /api/backend/auth/me orqali aniqlaydi.
 * Marketing header auth holatini shu hook'dan oladi.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  const refresh = useCallback(async () => {
    try {
      // /auth/session: public probe — guests get 200 {user:null} (no console 401).
      const res = await fetch("/api/backend/auth/session", { cache: "no-store" });
      if (!res.ok) {
        setState({ user: null, loading: false });
        return;
      }
      const json = await res.json();
      const user = json?.data?.user ?? json?.user ?? null;
      setState({ user: user || null, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/backend/auth/logout", { method: "POST", headers: { Origin: window.location.origin } });
    } catch {
      /* jim */
    }
    setState({ user: null, loading: false });
    window.location.href = "/";
  }, []);

  return { user: state.user, loading: state.loading, refresh, signOut };
}
