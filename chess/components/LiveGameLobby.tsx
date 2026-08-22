"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TIME_CONTROLS } from "@/chess/game/config";
import type { LiveGameSnapshot, LiveGameSummary } from "@/chess/live/types";
import type { PlayerColorChoice } from "@/chess/types";
import type { MatchmakingStatus } from "@/chess/rating/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

type GamesResponse = { ok: boolean; games?: LiveGameSummary[]; error?: string };
type GameResponse = { ok: boolean; game?: LiveGameSnapshot; error?: string };
type MatchmakingResponse = { ok: boolean; matchmaking?: MatchmakingStatus; error?: string };

function gameResult(game: LiveGameSummary) {
  if (game.status === "waiting") return "Waiting for another student";
  if (game.status === "active") return game.activeColor === game.viewerColor ? "Your move" : "Opponent's move";
  if (game.status === "cancelled") return "Challenge cancelled";
  if (!game.winnerColor) return "Draw";
  return game.winnerColor === game.viewerColor ? "You won" : "You lost";
}

export function LiveGameLobby() {
  const router = useRouter();
  const [games, setGames] = useState<LiveGameSummary[]>([]);
  const [timeControlId, setTimeControlId] = useState("10m");
  const [color, setColor] = useState<PlayerColorChoice>("random");
  const [rated, setRated] = useState(true);
  const [matchTimeControlId, setMatchTimeControlId] = useState("10m");
  const [matchRated, setMatchRated] = useState(true);
  const [matchmaking, setMatchmaking] = useState<MatchmakingStatus | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"create" | "join" | "match" | null>(null);
  const [message, setMessage] = useState("");

  const loadGames = useCallback(async () => {
    try {
      const response = await fetch("/api/student/live-games", { cache: "no-store" });
      const body = await response.json() as GamesResponse;
      if (!response.ok || !body.ok) throw new Error(body.error || "Live games could not be loaded.");
      setGames(body.games ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Live games could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) setJoinCode(code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12));
    void loadGames();
  }, [loadGames]);

  const loadMatchmaking = useCallback(async () => {
    const response = await fetch("/api/student/live-games/matchmaking", { cache: "no-store" });
    const body = await response.json() as MatchmakingResponse;
    if (!response.ok || !body.matchmaking) throw new Error(body.error || "Matchmaking could not be loaded.");
    setMatchmaking(body.matchmaking);
    if (body.matchmaking.gameId) router.push(`/student/play/live/${body.matchmaking.gameId}`);
  }, [router]);

  useEffect(() => { void loadMatchmaking().catch(() => undefined); }, [loadMatchmaking]);
  useEffect(() => {
    if (matchmaking?.status !== "waiting") return;
    const interval = window.setInterval(() => void loadMatchmaking().catch((error) => setMessage(error instanceof Error ? error.message : "Matchmaking could not be loaded.")), 2_000);
    return () => window.clearInterval(interval);
  }, [loadMatchmaking, matchmaking?.status]);

  async function createChallenge() {
    setPending("create");
    setMessage("");
    try {
      const response = await fetch("/api/student/live-games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timeControlId, color, rated })
      });
      const body = await response.json() as GameResponse;
      if (!response.ok || !body.game) throw new Error(body.error || "Challenge could not be created.");
      router.push(`/student/play/live/${body.game.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Challenge could not be created.");
      setPending(null);
    }
  }

  async function findMatch() {
    setPending("match"); setMessage("");
    try {
      const response = await fetch("/api/student/live-games/matchmaking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ timeControlId: matchTimeControlId, rated: matchRated }) });
      const body = await response.json() as MatchmakingResponse;
      if (!response.ok || !body.matchmaking) throw new Error(body.error || "Could not join matchmaking.");
      setMatchmaking(body.matchmaking);
      if (body.matchmaking.gameId) router.push(`/student/play/live/${body.matchmaking.gameId}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not join matchmaking."); }
    finally { setPending(null); }
  }

  async function cancelMatchmaking() {
    setPending("match");
    try {
      const response = await fetch("/api/student/live-games/matchmaking", { method: "DELETE" });
      const body = await response.json() as MatchmakingResponse;
      if (!response.ok || !body.matchmaking) throw new Error(body.error || "Could not leave matchmaking.");
      setMatchmaking(body.matchmaking);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not leave matchmaking."); }
    finally { setPending(null); }
  }

  async function joinChallenge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("join");
    setMessage("");
    try {
      const response = await fetch("/api/student/live-games/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: joinCode })
      });
      const body = await response.json() as GameResponse;
      if (!response.ok || !body.game) throw new Error(body.error || "Challenge could not be joined.");
      router.push(`/student/play/live/${body.game.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Challenge could not be joined.");
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Create a private game</p>
          <h2 className="mt-1 text-2xl font-black text-white">Challenge a classmate</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Choose your clock and color, then share the private 12-character code.</p>

          <label className="mt-5 block text-sm font-bold text-slate-200" htmlFor="live-time-control">Time control</label>
          <select id="live-time-control" value={timeControlId} onChange={(event) => { const next = event.target.value; setTimeControlId(next); if (TIME_CONTROLS.find((item) => item.id === next)?.initialMs === null) setRated(false); }} className="mt-2 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-300/60">
            {TIME_CONTROLS.map((control) => <option key={control.id} value={control.id}>{control.name}</option>)}
          </select>

          <fieldset className="mt-4">
            <legend className="text-sm font-bold text-slate-200">Your color</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["white", "random", "black"] as PlayerColorChoice[]).map((choice) => (
                <button key={choice} type="button" aria-pressed={color === choice} onClick={() => setColor(choice)} className={`rounded-md border px-3 py-2 text-sm font-bold capitalize transition ${color === choice ? "border-cyan-300/60 bg-cyan-300/15 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                  {choice}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 flex items-start gap-3 rounded-md border border-white/10 bg-white/5 p-3 text-sm text-slate-200"><input type="checkbox" checked={rated} disabled={TIME_CONTROLS.find((item) => item.id === timeControlId)?.initialMs === null} onChange={(event) => setRated(event.target.checked)} className="mt-0.5 size-4 accent-cyan-300" /><span><strong className="block text-white">Rated game</strong><span className="text-xs text-slate-400">Changes both players’ Academy PvP ratings.</span></span></label>

          <Button type="button" className="mt-5 w-full" disabled={pending !== null} onClick={createChallenge}>
            {pending === "create" ? "Creating..." : "Create Challenge"}
          </Button>
        </Card>

        <Card className="p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-wider text-amber-200">Join a private game</p>
          <h2 className="mt-1 text-2xl font-black text-white">Enter a challenge code</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Ask the other student for the code shown on their waiting screen.</p>
          <form className="mt-5" onSubmit={joinChallenge}>
            <label className="block text-sm font-bold text-slate-200" htmlFor="live-challenge-code">Challenge code</label>
            <input id="live-challenge-code" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} autoComplete="off" inputMode="text" maxLength={12} placeholder="ABCD2345WXYZ" className="mt-2 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-3 text-center font-mono text-xl font-black tracking-[0.18em] text-white outline-none focus:border-amber-300/60" />
            <Button type="submit" variant="secondary" className="mt-4 w-full" disabled={pending !== null || joinCode.length !== 12}>
              {pending === "join" ? "Joining..." : "Join Game"}
            </Button>
          </form>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_240px_auto] lg:items-end">
          <div><p className="text-xs font-black uppercase tracking-wider text-emerald-200">Quick matchmaking</p><h2 className="mt-1 text-2xl font-black text-white">Find an Academy opponent</h2><p className="mt-2 text-sm text-slate-400">We match the same clock and rated mode, prioritizing the closest available rating.</p></div>
          <div><label htmlFor="match-clock" className="text-sm font-bold text-slate-200">Clock</label><select id="match-clock" value={matchTimeControlId} disabled={matchmaking?.status === "waiting"} onChange={(event) => setMatchTimeControlId(event.target.value)} className="mt-2 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-white">{TIME_CONTROLS.filter((control) => control.initialMs !== null).map((control) => <option key={control.id} value={control.id}>{control.name}</option>)}</select><label className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-300"><input type="checkbox" checked={matchRated} disabled={matchmaking?.status === "waiting"} onChange={(event) => setMatchRated(event.target.checked)} className="accent-cyan-300" /> Rated matchmaking</label></div>
          {matchmaking?.status === "waiting" ? <Button type="button" variant="ghost" disabled={pending === "match"} onClick={() => void cancelMatchmaking()}>Cancel Search</Button> : <Button type="button" disabled={pending === "match"} onClick={() => void findMatch()}>{pending === "match" ? "Searching..." : "Find Match"}</Button>}
        </div>
        {matchmaking?.status === "waiting" ? <p className="mt-4 rounded-md border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100" aria-live="polite">Searching for a {matchmaking.rated ? "rated" : "casual"} {TIME_CONTROLS.find((item) => item.id === matchmaking.timeControlId)?.name ?? ""} opponent…</p> : null}
      </Card>

      {message ? <p className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-bold text-rose-100" role="alert">{message}</p> : null}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Resume after reconnecting</p>
            <h2 className="mt-1 text-xl font-black text-white">Your live games</h2>
          </div>
          <Button type="button" variant="ghost" onClick={() => void loadGames()} disabled={loading}>Refresh</Button>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Loading live games...</p>
        ) : games.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {games.map((game) => (
              <Link key={game.id} href={`/student/play/live/${game.id}`} className="rounded-lg border border-white/10 bg-white/5 p-4 transition hover:border-cyan-300/35 hover:bg-cyan-300/8">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-white">{game.opponent?.name ?? "Waiting challenge"}</p>
                    <p className="mt-1 text-xs text-slate-400">{game.timeControl.name} · playing {game.viewerColor} · {game.rated ? "rated" : "casual"}{game.matchmaking ? " · matchmade" : ""}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-[11px] font-bold uppercase text-cyan-100">{game.status}</span>
                </div>
                <p className="mt-3 text-sm font-bold text-slate-200">{gameResult(game)}</p>
                {game.status === "waiting" ? <p className="mt-2 font-mono text-xs tracking-widest text-amber-200">{game.challengeCode}</p> : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-white/10 p-5 text-sm text-slate-400">No live games yet. Create a challenge to begin.</p>
        )}
      </Card>
    </div>
  );
}
