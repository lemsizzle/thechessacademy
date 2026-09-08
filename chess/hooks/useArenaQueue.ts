"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ArenaQueueState } from "@/chess/arena/types";

export function useArenaQueue(tournamentId?: string | null, gameId?: string, navigate = true) {
  const router = useRouter();
  const [queue, setQueue] = useState<ArenaQueueState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const loading = useRef(false);
  const mounted = useRef(true);
  const navigated = useRef("");

  const update = useCallback(async (action: "heartbeat" | "pause" | "join" = "heartbeat") => {
    if (!tournamentId || (action === "heartbeat" && loading.current)) return;
    const id = ++requestId.current;
    loading.current = true;
    if (action !== "heartbeat") setPending(true);
    try {
      const response = await fetch(`/api/student/internal-arenas/${tournamentId}/presence`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, gameId }), cache: "no-store", signal: AbortSignal.timeout(8000)
      });
      const body = await response.json() as { queue?: ArenaQueueState; error?: string };
      if (!response.ok || !body.queue) throw new Error(body.error || "Reconnecting to the Arena…");
      if (!mounted.current || id !== requestId.current) return;
      setQueue(body.queue); setError("");
      return body.queue;
    } catch (caught) {
      if (mounted.current && id === requestId.current) setError(caught instanceof Error ? caught.message : "Reconnecting to the Arena…");
    } finally {
      if (id === requestId.current) { loading.current = false; if (mounted.current) setPending(false); }
    }
  }, [tournamentId, gameId]);

  useEffect(() => {
    mounted.current = true;
    setQueue(null); navigated.current = "";
    const heartbeat = () => { if (document.visibilityState === "visible") void update(); };
    heartbeat();
    const timer = window.setInterval(heartbeat, navigate ? 2000 : 5000);
    document.addEventListener("visibilitychange", heartbeat);
    window.addEventListener("online", heartbeat);
    return () => { mounted.current = false; ++requestId.current; loading.current = false; clearInterval(timer); document.removeEventListener("visibilitychange", heartbeat); window.removeEventListener("online", heartbeat); };
  }, [update, navigate]);

  useEffect(() => {
    if (!navigate || pending || !queue?.gameId || queue.gameId === gameId || navigated.current === queue.gameId) return;
    navigated.current = queue.gameId;
    router.replace(`/student/play/live/${queue.gameId}`);
  }, [queue?.gameId, gameId, navigate, pending, router]);

  return { queue, pending, error, update };
}
