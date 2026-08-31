"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TIME_CONTROLS } from "@/chess/game/timeControls";
import { CHALLENGE_CODE_LENGTH, cleanChallengeCode, isSupportedChallengeCode } from "@/chess/live/challengeCode";
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
  const [matchTimeControlId, setMatchTimeControlId] = useState("10m");
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
    if (code) setJoinCode(cleanChallengeCode(code).slice(0, 12));
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
        body: JSON.stringify({ timeControlId, color })
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
      const response = await fetch("/api/student/live-games/matchmaking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ timeControlId: matchTimeControlId }) });
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
    <div className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="flex min-w-0 flex-col p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg border border-emerald-200/20 bg-emerald-200/10 text-lg text-emerald-100">⚡</span>
            <div><p className="text-xs font-black uppercase tracking-wider text-emerald-200">Quick play</p><h2 className="text-xl font-black text-white">Find a match</h2></div>
          </div>
          <div className="mt-4 flex gap-2">
            <label htmlFor="match-clock" className="sr-only">Clock</label>
            <select id="match-clock" value={matchTimeControlId} disabled={matchmaking?.status === "waiting"} onChange={(event) => setMatchTimeControlId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/50">
              {TIME_CONTROLS.filter((control) => control.initialMs !== null).map((control) => <option key={control.id} value={control.id}>{control.name}</option>)}
            </select>
            {matchmaking?.status === "waiting" ? <Button type="button" variant="ghost" disabled={pending === "match"} onClick={() => void cancelMatchmaking()}>Cancel</Button> : <Button type="button" disabled={pending === "match"} onClick={() => void findMatch()}>{pending === "match" ? "Searching…" : "Play"}</Button>}
          </div>
          {matchmaking?.status === "waiting" ? <p className="mt-3 text-sm font-bold text-emerald-100" aria-live="polite">Searching for an opponent…</p> : null}
        </Card>

        <Card className="flex min-w-0 flex-col p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg border border-cyan-200/20 bg-cyan-200/10 text-lg text-cyan-100">＋</span>
            <div><p className="text-xs font-black uppercase tracking-wider text-cyan-200">Private</p><h2 className="text-xl font-black text-white">Create a game</h2></div>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <label className="sr-only" htmlFor="live-time-control">Time control</label>
            <select id="live-time-control" value={timeControlId} onChange={(event) => setTimeControlId(event.target.value)} className="col-span-2 min-w-0 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/50">
              {TIME_CONTROLS.map((control) => <option key={control.id} value={control.id}>{control.name}</option>)}
            </select>
            <fieldset className="contents">
              <legend className="sr-only">Your color</legend>
              <div className="col-span-2 grid grid-cols-3 gap-2">
                {(["white", "random", "black"] as PlayerColorChoice[]).map((choice) => (
                  <button key={choice} type="button" aria-pressed={color === choice} onClick={() => setColor(choice)} className={`rounded-lg border px-2 py-2 text-xs font-bold capitalize transition ${color === choice ? "border-cyan-200/60 bg-cyan-200/10 text-white" : "border-white/10 bg-white/[.035] text-slate-300 hover:bg-white/[.07]"}`}>{choice}</button>
                ))}
              </div>
            </fieldset>
            <Button type="button" className="col-span-2 mt-1 w-full" disabled={pending !== null} onClick={createChallenge}>{pending === "create" ? "Creating…" : "Create & Share Code"}</Button>
          </div>
        </Card>

        <Card className="flex min-w-0 flex-col p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg border border-amber-200/20 bg-amber-200/10 text-lg text-amber-100">#</span>
            <div><p className="text-xs font-black uppercase tracking-wider text-amber-200">Have a code?</p><h2 className="text-xl font-black text-white">Join a game</h2></div>
          </div>
          <form className="mt-4 flex flex-1 flex-col" onSubmit={joinChallenge}>
            <label className="sr-only" htmlFor="live-challenge-code">Challenge code</label>
            <input id="live-challenge-code" value={joinCode} onChange={(event) => setJoinCode(cleanChallengeCode(event.target.value).slice(0, CHALLENGE_CODE_LENGTH))} autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text" placeholder="A7K2" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-center font-mono text-lg font-black tracking-[0.18em] text-white outline-none focus:border-amber-200/60" />
            <Button type="submit" variant="secondary" className="mt-3 w-full" disabled={pending !== null || !isSupportedChallengeCode(joinCode)}>{pending === "join" ? "Joining…" : "Join"}</Button>
          </form>
        </Card>
      </div>

      {message ? <p className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-bold text-rose-100" role="alert">{message}</p> : null}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-white">Your games</h2>
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
                    <p className="mt-1 text-xs text-slate-400">{game.timeControl.name} · playing {game.viewerColor}{game.matchmaking ? " · Academy match" : " · private challenge"}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-[11px] font-bold uppercase text-cyan-100">{game.status}</span>
                </div>
                <p className="mt-3 text-sm font-bold text-slate-200">{gameResult(game)}</p>
                {game.status === "waiting" ? <p className="mt-2 font-mono text-xs tracking-widest text-amber-200">{game.challengeCode}</p> : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-white/10 p-4 text-sm text-slate-400">No live games yet.</p>
        )}
      </Card>
    </div>
  );
}
