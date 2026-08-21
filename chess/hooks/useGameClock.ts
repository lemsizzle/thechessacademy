"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clockAt, completeClockMove, createClockSnapshot, expiredClockColor, type RunningClock } from "@/chess/game/clock";
import type { ChessColor, ClockSnapshot, TimeControl } from "@/chess/types";

export function useGameClock() {
  const [display, setDisplay] = useState<ClockSnapshot | null>(null);
  const [expiredColor, setExpiredColor] = useState<ChessColor | null>(null);
  const runningRef = useRef<RunningClock | null>(null);
  const controlRef = useRef<TimeControl | null>(null);
  const displayRef = useRef<ClockSnapshot | null>(null);

  const refresh = useCallback((now = Date.now()) => {
    const running = runningRef.current;
    if (!running) return displayRef.current;
    const next = clockAt(running, now);
    const expired = expiredClockColor(next);
    if (expired) {
      runningRef.current = null;
      setExpiredColor(expired);
    }
    displayRef.current = next;
    setDisplay(next);
    return next;
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => refresh(), 100);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const reset = useCallback((control: TimeControl) => {
    controlRef.current = control;
    setExpiredColor(null);
    const snapshot = createClockSnapshot(control);
    displayRef.current = snapshot;
    setDisplay(snapshot);
    runningRef.current = snapshot ? { ...snapshot, startedAt: Date.now() } : null;
    return snapshot;
  }, []);

  const completeMove = useCallback((mover: ChessColor) => {
    const running = runningRef.current;
    const control = controlRef.current;
    if (!running || !control) return null;
    const next = completeClockMove(running, mover, control.incrementMs, Date.now());
    runningRef.current = next;
    const snapshot = { whiteMs: next.whiteMs, blackMs: next.blackMs, activeColor: next.activeColor };
    displayRef.current = snapshot;
    setDisplay(snapshot);
    return snapshot;
  }, []);

  const restore = useCallback((snapshot: ClockSnapshot | null) => {
    setExpiredColor(null);
    displayRef.current = snapshot;
    setDisplay(snapshot);
    runningRef.current = snapshot ? { ...snapshot, startedAt: Date.now() } : null;
  }, []);

  const pause = useCallback(() => {
    const running = runningRef.current;
    if (!running) return;
    const snapshot = clockAt(running, Date.now());
    runningRef.current = null;
    displayRef.current = snapshot;
    setDisplay(snapshot);
  }, []);

  return { display, expiredColor, reset, completeMove, restore, pause };
}
