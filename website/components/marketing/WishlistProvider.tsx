"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./useAuth";

type WishlistCtx = {
  enabled: boolean;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  count: number;
};

const Ctx = createContext<WishlistCtx>({ enabled: false, has: () => false, toggle: () => {}, count: 0 });

export const useWishlist = () => useContext(Ctx);

/** Wishlist faqat login qilingan foydalanuvchi uchun ishlaydi (localStorage'da, user bo'yicha). */
export default function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = user ? `tv_wishlist_${user.id}` : null;
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (!key) { setIds([]); return; }
    try { setIds(JSON.parse(localStorage.getItem(key) || "[]")); } catch { setIds([]); }
  }, [key]);

  const toggle = useCallback((id: string) => {
    if (!key) return;
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* jim */ }
      return next;
    });
  }, [key]);

  return (
    <Ctx.Provider value={{ enabled: !!user, has: (id) => ids.includes(id), toggle, count: ids.length }}>
      {children}
    </Ctx.Provider>
  );
}
