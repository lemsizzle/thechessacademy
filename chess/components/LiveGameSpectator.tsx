"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { MoveHistory } from "@/chess/components/MoveHistory";
import { PlayerPanel } from "@/chess/components/PlayerPanel";
import { oppositeColor } from "@/chess/game/config";
import type { TeacherLiveGameSnapshot } from "@/chess/live/types";
import type { ChessColor } from "@/chess/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { getSupabaseClient } from "@/lib/supabase/client";

type GameResponse = { ok?: boolean; game?: TeacherLiveGameSnapshot; error?: string };

const boardColumnStyle = {
  width: "min(100%, 700px, max(80px, calc(100dvh - 14.25rem)))"
};

function clockValue(game: TeacherLiveGameSnapshot, color: ChessColor, nowMs: number, serverOffsetMs: number) {
  const base = color === "white" ? game.clocks.whiteMs : game.clocks.blackMs;
  if (base === null || game.status !== "active" || game.activeColor !== color || !game.clocks.startedAt) return base;
  const serverNow = nowMs - serverOffsetMs;
  return Math.max(0, base - Math.max(0, serverNow - new Date(game.clocks.startedAt).getTime()));
}

function completedStatus(game: TeacherLiveGameSnapshot) {
  if (game.status !== "completed") return `${game.players[game.activeColor].name} to move.`;
  const reason = game.resultReason?.replaceAll("_", " ") ?? "game over";
  return game.winnerColor ? `${game.players[game.winnerColor].name} won by ${reason}.` : `Draw by ${reason}.`;
}

export function LiveGameSpectator({ gameId, adminActionToken }: { gameId: string; adminActionToken: string }) {
  const [game, setGame] = useState<TeacherLiveGameSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<"connecting" | "live" | "polling">("connecting");
  const [orientation, setOrientation] = useState<ChessColor>("white");
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const receiveGame = useCallback((next: TeacherLiveGameSnapshot) => {
    setGame(next);
    setServerOffsetMs(Date.now() - new Date(next.serverNow).getTime());
    setError("");
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/live-games/${gameId}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "x-admin-action-token": adminActionToken }
      });
      const body = await response.json() as GameResponse;
      if (!response.ok || !body.game) throw new Error(body.error || "Live game could not be loaded.");
      receiveGame(body.game);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Live game could not be loaded.");
      setLoading(false);
    }
  }, [adminActionToken, gameId, receiveGame]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!game?.realtimeTopic || game.status !== "active") return;
    const client = getSupabaseClient();
    if (!client) {
      setConnection("polling");
      return;
    }
    setConnection("connecting");
    const channel = client
      .channel(game.realtimeTopic)
      .on("broadcast", { event: "game_changed" }, () => void refresh())
      .subscribe((status) => setConnection(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "polling" : "connecting"));
    return () => {
      void client.removeChannel(channel);
    };
  }, [game?.realtimeTopic, game?.status, refresh]);

  useEffect(() => {
    if (!game || game.status !== "active") return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, connection === "live" ? 15_000 : 3_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [connection, game?.status, refresh]);

  useEffect(() => {
    if (!game || game.status !== "active" || game.clocks.whiteMs === null) return;
    let timeout: number;
    const tick = () => {
      const nextNow = Date.now();
      setNowMs(nextNow);
      const remaining = clockValue(game, game.activeColor, nextNow, serverOffsetMs);
      timeout = window.setTimeout(tick, remaining !== null && remaining < 10_000 ? 100 : 1_000);
    };
    timeout = window.setTimeout(tick, 100);
    return () => window.clearTimeout(timeout);
  }, [game, serverOffsetMs]);

  const displayedClocks = useMemo(() => game ? {
    white: clockValue(game, "white", nowMs, serverOffsetMs),
    black: clockValue(game, "black", nowMs, serverOffsetMs)
  } : { white: null, black: null }, [game, nowMs, serverOffsetMs]);

  if (loading) return <Card className="p-6 text-sm text-slate-300">Connecting to the live game...</Card>;
  if (!game) return <Card className="p-6"><p className="text-rose-100" role="alert">{error || "Live game could not be loaded."}</p><Button href="/admin/live-games" variant="secondary" className="mt-4">Back to Live Games</Button></Card>;

  const topColor = oppositeColor(orientation);
  const bottomColor = orientation;
  const lastMove = game.moves.length ? [game.moves[game.moves.length - 1].from, game.moves[game.moves.length - 1].to] as [string, string] : null;

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-bold text-rose-100" role="alert">{error}</p> : null}
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,700px)_minmax(300px,1fr)]">
        <div className="mx-auto min-w-0 space-y-3" style={boardColumnStyle}>
          <PlayerPanel name={game.players[topColor].name} subtitle={`Playing ${topColor}`} clockMs={displayedClocks[topColor]} active={game.status === "active" && game.activeColor === topColor} />
          <div className="aspect-square w-full overflow-hidden rounded-xl border border-cyan-200/20 bg-slate-950/70 p-1 sm:p-2">
            <AcademyChessboard fen={game.fen} orientation={orientation} humanColor={orientation} interactive={false} lastMove={lastMove} onMove={() => undefined} boardId={`teacher-watch-${game.id}`} />
          </div>
          <PlayerPanel name={game.players[bottomColor].name} subtitle={`Playing ${bottomColor}`} clockMs={displayedClocks[bottomColor]} active={game.status === "active" && game.activeColor === bottomColor} />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Teacher spectator mode</p>
                <h2 className="mt-1 text-xl font-black text-white">{game.players.white.name} vs {game.players.black.name}</h2>
                <p className="mt-1 text-xs font-bold text-slate-400">{game.matchmaking ? "Academy match" : "Private challenge"} · {game.rated ? "Rated" : "Casual"} · {game.timeControl.name}</p>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[11px] font-bold uppercase ${game.status === "completed" ? "border-slate-300/25 bg-slate-300/10 text-slate-200" : connection === "live" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>{game.status === "completed" ? "Finished" : connection === "live" ? "Live" : connection}</span>
            </div>
            <p className="mt-4 rounded-md border border-white/10 bg-white/5 p-3 text-sm font-bold leading-5 text-slate-200" aria-live="polite">{completedStatus(game)}</p>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-black text-white">Moves</h2><span className="text-xs text-slate-500">SAN notation</span></div>
            <MoveHistory moves={game.moves} />
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="font-black text-white">Spectator controls</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" variant="ghost" onClick={() => setOrientation((value) => oppositeColor(value))}>⇅ Flip Board</Button>
              <Button href="/admin/live-games" variant="ghost">All Live Games</Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
