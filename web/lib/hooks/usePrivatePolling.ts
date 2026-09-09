"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** One abortable GET at a time; hidden tabs sleep, errors back off, writes keep their own queue. */
export function usePrivatePolling<T>(url: string, initialData: T, interval: number | ((data: T) => number)) {
  const [data, setData] = useState(initialData);
  const [warning, setWarning] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const failures = useRef(0);
  const authFailed = useRef(false);
  const refresh = useCallback(async () => {
    if (active.current || document.hidden || authFailed.current) return;
    const controller = new AbortController(); active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setRefreshing(true);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (response.status === 401 || response.status === 404) authFailed.current = true;
      if (!response.ok) throw new Error(response.status === 401 ? "Reconnectez-vous pour actualiser vos commandes." : response.status === 404 ? "Cette commande n’est plus accessible." : "Actualisation indisponible. Dernières informations conservées.");
      const next = await response.json() as T;
      if (active.current !== controller || controller.signal.aborted) return;
      failures.current = 0; setData(next); setWarning(""); setUpdatedAt(new Date().toISOString());
    } catch (error) {
      if (active.current !== controller) return;
      failures.current++;
      setWarning(controller.signal.aborted ? "La connexion est lente. Dernières informations conservées." : error instanceof Error ? error.message : "Impossible d’actualiser pour le moment.");
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) { active.current = null; setRefreshing(false); }
    }
  }, [url]);
  const pollInterval = typeof interval === "function" ? interval(data) : interval;
  useEffect(() => {
    if (!pollInterval) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      await refresh();
      if (!disposed && !authFailed.current) timer = setTimeout(tick, Math.min(60000, pollInterval * Math.max(1, 2 ** failures.current)));
    }
    timer = setTimeout(tick, pollInterval);
    const resume = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true; clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume);
      const controller = active.current; active.current = null; controller?.abort();
    };
  }, [pollInterval, refresh]);
  return { data, warning, refreshing, updatedAt, refresh };
}
