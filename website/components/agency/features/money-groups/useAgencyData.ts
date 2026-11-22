"use client";

import { useCallback, useEffect, useState } from "react";
import { agencyApi } from "@/lib/agency/api";

/**
 * GET so'rovi natijasi. `path` null bo'lsa so'rov yuborilmaydi; `reload()`
 * qayta yuklaydi. Holat faqat javob kelgandan keyin (callback'da) yangilanadi.
 */
export function useAgencyData<T>(path: string | null, fallbackError = "Ma’lumotni yuklab bo‘lmadi.") {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    void agencyApi<T>(path).then((res) => {
      if (!alive) return;
      if (res.success) { setData(res.data); setError(""); } else setError(res.message || fallbackError);
    });
    return () => { alive = false; };
  }, [path, tick, fallbackError]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, reload };
}
