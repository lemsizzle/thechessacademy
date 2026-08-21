import { oppositeColor } from "@/chess/game/config";
import type { ChessColor, ClockSnapshot, TimeControl } from "@/chess/types";

export type RunningClock = ClockSnapshot & { startedAt: number };

export function createClockSnapshot(control: TimeControl): ClockSnapshot | null {
  if (control.initialMs === null) return null;
  return { whiteMs: control.initialMs, blackMs: control.initialMs, activeColor: "white" };
}
export function clockAt(clock: RunningClock, now: number): ClockSnapshot {
  const elapsed = Math.max(0, now - clock.startedAt);
  return {
    whiteMs: clock.activeColor === "white" ? Math.max(0, clock.whiteMs - elapsed) : clock.whiteMs,
    blackMs: clock.activeColor === "black" ? Math.max(0, clock.blackMs - elapsed) : clock.blackMs,
    activeColor: clock.activeColor
  };
}

export function completeClockMove(clock: RunningClock, mover: ChessColor, incrementMs: number, now: number): RunningClock {
  const current = clockAt(clock, now);
  const next = {
    ...current,
    activeColor: oppositeColor(mover),
    startedAt: now
  };
  if (mover === "white") next.whiteMs += incrementMs;
  else next.blackMs += incrementMs;
  return next;
}

export function expiredClockColor(clock: ClockSnapshot): ChessColor | null {
  if (clock.whiteMs <= 0) return "white";
  if (clock.blackMs <= 0) return "black";
  return null;
}

export function formatClock(milliseconds: number | null) {
  if (milliseconds === null) return "--:--";
  const safe = Math.max(0, milliseconds);
  const totalSeconds = Math.ceil(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safe % 1000) / 100);
  return safe < 10_000
    ? `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
