"use client";

import { useEffect, useRef } from "react";
import { COMPUTER_PRESENCE_HEARTBEAT_MS } from "@/chess/live/computerPresence";
import { createComputerPresencePublisher } from "@/chess/live/computerPresencePublisher";
import type { ClockSnapshot, ComputerGameConfig, GameMove, GameOutcome } from "@/chess/types";

type Session = { gameId: string; startedAt: string };
type State = { config: ComputerGameConfig | null; session: Session | null; moves: GameMove[]; outcome: GameOutcome | null; sampleClock: () => ClockSnapshot | null };

export function useComputerGamePresence(state: State) {
  const recordRef = useRef<{ state: State; clock: ClockSnapshot | null; publisher?: ReturnType<typeof createComputerPresencePublisher>; closeTimer?: ReturnType<typeof setTimeout> } | null>(null);
  if (state.session && state.config) {
    if (recordRef.current?.state.session?.gameId !== state.session.gameId) recordRef.current = { state, clock: state.sampleClock() };
    else { recordRef.current.state = state; recordRef.current.clock = state.sampleClock(); }
  }
  const publisherRef = useRef<ReturnType<typeof createComputerPresencePublisher> | null>(null);
  const gameId = state.session?.gameId;

  useEffect(() => {
    const record = recordRef.current;
    const initial = record?.state;
    if (!record || !initial?.session || !initial.config || initial.session.gameId !== gameId) return;
    const { session, config } = initial;
    if (record.closeTimer) clearTimeout(record.closeTimer);
    // Reuse the publisher during Strict Mode's setup/cleanup replay.
    const publisher = record.publisher ?? createComputerPresencePublisher(() => {
      const retained = record.state;
      // When leaving or starting another game, the old game's clock stays isolated.
      const clock = recordRef.current === record && state.session ? retained.sampleClock() : record.clock;
      return {
        gameId: session.gameId, startedAt: session.startedAt,
        status: retained.outcome ? "completed" : "active",
        botId: config.bot.id, humanColor: config.humanColor, timeControlId: config.timeControl.id,
        moves: retained.moves.map((move) => `${move.from}${move.to}${move.promotion ?? ""}`),
        clock: clock ? { whiteMs: clock.whiteMs, blackMs: clock.blackMs } : null,
        capturedAt: new Date().toISOString(),
        winnerColor: retained.outcome?.winnerColor ?? null, resultReason: retained.outcome?.reason ?? null
      };
    }, async (input, keepalive) => {
      const response = await fetch("/api/student/computer-game-presence", {
        method: "POST", credentials: "same-origin", keepalive,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
        signal: keepalive ? undefined : AbortSignal.timeout(10_000)
      });
      if (!response.ok) throw new Error("Computer game presence could not be updated.");
    });
    record.publisher = publisher;
    publisherRef.current = publisher;
    publisher.schedule();
    const heartbeat = window.setInterval(() => {
      if (!record.state.outcome) publisher.schedule();
    }, COMPUTER_PRESENCE_HEARTBEAT_MS);
    const onPageHide = (event: PageTransitionEvent) => { if (!event.persisted) publisher.close(); };
    const onPageShow = () => { if (!record.state.outcome) publisher.schedule(); };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      record.closeTimer = setTimeout(() => publisher.close(), 0);
      if (publisherRef.current === publisher) publisherRef.current = null;
    };
  }, [gameId]);

  useEffect(() => { publisherRef.current?.schedule(); }, [state.moves, state.outcome]);
}
