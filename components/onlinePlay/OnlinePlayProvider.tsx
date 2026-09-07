"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Button } from "@/components/Button";
import { challengeIsPending, EMPTY_ONLINE_PLAY, ONLINE_CLOCKS, type DirectChallenge, type OnlinePlayState } from "@/lib/onlinePlay/types";

type Action = { action: "challenge"; recipientId: string; timeControlId: string } | { action: "accept" | "decline" | "cancel"; challengeId: string };
type OnlineContext = { state: OnlinePlayState; loading: boolean; error: string; pending: boolean; refresh: () => Promise<void>; act: (action: Action) => Promise<void> };
const Context = createContext<OnlineContext | null>(null);
export function useOnlinePlay() { return useContext(Context); }

export function OnlinePlayProvider({ studentId, children }: { studentId: string; children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState(EMPTY_ONLINE_PLAY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<DirectChallenge | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const notified = useRef(new Set<string>());
  const waitingFor = useRef(new Set<string>());
  const heartbeatAt = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++generation.current;
    try {
      const response = await fetch("/api/student/online-play", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Online play could not be loaded.");
      if (!mounted.current || sequence !== generation.current) return;
      const next = body.state as OnlinePlayState;
      setState(next); setError("");
      setNotice((current) => current && next.incoming.find((c) => c.id === current.id && challengeIsPending(c)) || null);
      const incoming = next.incoming.find((c) => challengeIsPending(c) && !notified.current.has(c.id));
      if (incoming) { notified.current.add(incoming.id); setNotice(incoming); }
      const accepted = next.outgoing.find((c) => c.status === "accepted" && c.gameId && waitingFor.current.has(c.id));
      if (accepted) {
        waitingFor.current.delete(accepted.id);
        router.push(`/student/play/live/${accepted.gameId}`);
      }
    } catch (caught) {
      if (mounted.current && sequence === generation.current) {
        setError(caught instanceof Error ? caught.message : "Online play is unavailable.");
        setState((current) => ({ ...current, students: [] }));
      }
    } finally { if (mounted.current && sequence === generation.current) setLoading(false); }
  }, [router]);

  useEffect(() => {
    mounted.current = true;
    notified.current.clear(); waitingFor.current.clear(); heartbeatAt.current = 0;
    let polling = false;
    const tick = async () => {
      if (polling || document.visibilityState !== "visible") return;
      polling = true;
      try {
        if (Date.now() - heartbeatAt.current >= 30_000) {
          const response = await fetch("/api/student/online-play", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "heartbeat" }) });
          if (response.ok) heartbeatAt.current = Date.now();
        }
      } catch { /* Still refresh below so failures do not leave a stale online list. */ }
      try { await refresh(); } finally { polling = false; }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 5_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      mounted.current = false; generation.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [studentId, refresh]);

  const act = useCallback(async (action: Action) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const response = await fetch("/api/student/online-play", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Challenge could not be updated.");
      if (action.action === "challenge" && typeof body.result === "string") waitingFor.current.add(body.result);
      if (action.action !== "challenge") setNotice((current) => current?.id === action.challengeId ? null : current);
      await refresh();
      if (body.result?.status === "expired") setError("That invitation expired. Send a new challenge.");
      if (action.action === "accept" && body.result?.gameId) router.push(`/student/play/live/${body.result.gameId}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Challenge could not be updated."); }
    finally { busy.current = false; setPending(false); }
  }, [refresh, router]);

  return <Context.Provider value={{ state, loading, error, pending, refresh, act }}>
    {children}
    {notice && challengeIsPending(notice) && typeof document !== "undefined" ? createPortal(
      <aside aria-label="Incoming live challenge" className="fixed left-4 right-4 top-20 z-[95] rounded-xl border border-cyan-200/40 bg-slate-950 p-4 shadow-xl sm:left-auto sm:w-80">
        <div className="flex items-start justify-between gap-3">
          <p role="status" className="font-bold text-white">{notice.opponentName} challenged you · {ONLINE_CLOCKS.find((c) => c.id === notice.timeControlId)?.name}</p>
          <button type="button" aria-label="Dismiss live challenge alert" onClick={() => setNotice(null)} className="p-1 text-slate-300">✕</button>
        </div>
        {error ? <p role="alert" className="mt-2 text-sm text-rose-200">{error}</p> : null}
        <div className="mt-3 flex gap-2">
          <Button disabled={pending} onClick={() => void act({ action: "accept", challengeId: notice.id })}>Accept</Button>
          <Button variant="ghost" disabled={pending} onClick={() => void act({ action: "decline", challengeId: notice.id })}>Decline</Button>
        </div>
      </aside>, document.body) : null}
  </Context.Provider>;
}
