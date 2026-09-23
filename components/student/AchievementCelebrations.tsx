"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CELEBRATION_EVENT, REWARDS_CHANGED_EVENT, celebrationPosition, type Celebration } from "@/lib/celebrations";
import { STUDENT_LICHESS_FULL_SYNC_EVENT } from "@/lib/studentLichessFullSync";
import styles from "./AchievementCelebrations.module.css";

export function AchievementCelebrations({ studentId }: { studentId: string }) {
  const [queue, setQueue] = useState<Celebration[]>([]);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const current = queue[0];
  useEffect(() => {
    const key = `academy-celebrations:${studentId}`;
    let cursor: string | null = null;
    let seen = new Set<string>();
    try { const saved = JSON.parse(sessionStorage.getItem(key) ?? "null"); cursor = saved?.cursor ?? null; seen = new Set(saved?.seen ?? []); } catch { /* Storage is optional. */ }
    let active = true, pending = false, lastCheck = 0, followup: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const remember = () => { try { sessionStorage.setItem(key, JSON.stringify({ cursor, seen: [...seen].slice(-200) })); } catch { /* Never interrupt play. */ } };
    const enqueue = (item: Celebration) => {
      if (!item?.id || seen.has(item.id)) return;
      seen.add(item.id); remember();
      setQueue(items => [...items, item]);
    };
    const receive = (event: Event) => enqueue((event as CustomEvent<Celebration>).detail);
    async function check() {
      if (pending || document.visibilityState !== "visible" || Date.now() - lastCheck < 4000) return;
      pending = true;
      lastCheck = Date.now();
      try {
        const response = await fetch(`/api/student/celebrations${cursor ? `?since=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as { cursor: string; events: Celebration[] };
        if (!active) return;
        data.events.forEach(enqueue); cursor = data.cursor; remember();
      } catch { /* Rewards are already saved; notification failures must stay silent. */ }
      finally { pending = false; }
    }
    // Reward checks happen after meaningful actions, never on every move or clock tick.
    const changed = () => { void check(); clearTimeout(followup); followup = setTimeout(() => void check(), 5000); };
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener(CELEBRATION_EVENT, receive);
    window.addEventListener(REWARDS_CHANGED_EVENT, changed);
    window.addEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, changed);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    const interval = setInterval(() => void check(), 120_000);
    void check();
    return () => { active = false; controller.abort(); clearInterval(interval); clearTimeout(followup); window.removeEventListener(CELEBRATION_EVENT, receive); window.removeEventListener(REWARDS_CHANGED_EVENT, changed); window.removeEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, changed); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, [studentId]);

  useEffect(() => {
    if (!current) return;
    const place = () => {
      const boards = [...document.querySelectorAll<HTMLElement>("[data-chess-board]")].map(board => board.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
      setPosition(celebrationPosition(window.innerWidth, window.visualViewport?.height ?? window.innerHeight, boards, window.innerWidth < 768));
    };
    place();
    const observer = new ResizeObserver(place);
    document.querySelectorAll<HTMLElement>("[data-chess-board]").forEach(board => observer.observe(board));
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [current]);
  const visible = Boolean(position);
  useEffect(() => {
    if (!current || !visible) return;
    const timer = setTimeout(() => setQueue(items => items.slice(1)), 3000);
    return () => clearTimeout(timer);
  }, [current, visible]);
  if (!current || !position) return null;
  return createPortal(<div key={current.id} role="status" aria-live="polite" className={styles.toast} style={position}>
    <span aria-hidden="true" className="text-2xl">{current.kind === "badge" ? "🏅" : "✨"}</span>
    <div className="min-w-0"><p className="text-xs font-black text-amber-200">{current.kind === "badge" ? "New badge! Well done!" : "Quest complete! Great work!"}</p><p className="truncate text-sm font-bold text-white">{current.name}</p></div>
  </div>, document.body);
}
