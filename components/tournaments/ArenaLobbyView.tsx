"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { defaultPieces } from "react-chessboard";
import type { InternalArenaLobby, InternalArenaPairing, InternalArenaStanding } from "@/chess/arena/types";
import { arenaClock, arenaFinalLabel } from "@/chess/arena/presentation";
import { arenaBotAvatar } from "@/chess/arena/lobbyAvatars";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { Button } from "@/components/Button";
import styles from "./ArenaLobbyView.module.css";

type Props = {
  lobby: InternalArenaLobby; now: number; role: "teacher" | "student";
  status: string; pending?: boolean; onJoin: () => void; onPause: () => void;
  onTogglePairings: () => void; chat: ReactNode; teacherControls?: ReactNode;
};

function Avatar({ entry, lobby, large = false }: { entry: InternalArenaStanding; lobby: InternalArenaLobby; large?: boolean }) {
  const avatar = entry.avatar ?? (entry.bot ? arenaBotAvatar(lobby.arena.id, entry.bot.id, lobby.avatarItems) : { studentId: entry.studentId, equippedItems: {} });
  return <AvatarRenderer items={lobby.avatarItems} avatar={avatar} size={large ? "lg" : "sm"} label={`${entry.name}'s avatar`} />;
}

function LiveBoard({ pairing, lobby, role, now }: { pairing: InternalArenaPairing; lobby: InternalArenaLobby; role: Props["role"]; now: number }) {
  const mine = [pairing.whiteStudentId, pairing.blackStudentId].includes(lobby.arena.entry?.studentId ?? "");
  const href = role === "teacher" ? `/admin/live-games/${pairing.gameId}` : mine ? `/student/play/live/${pairing.gameId}` : `/student/tournaments/${lobby.arena.id}/watch/${pairing.gameId}`;
  const cells = (pairing.board?.fen.split(" ")[0] ?? "").split("/").flatMap(row => [...row].flatMap(piece => /[1-8]/.test(piece) ? Array(Number(piece)).fill("") : [piece]));
  const clock = (color: "white" | "black") => {
    const board = pairing.board;
    const base = color === "white" ? board?.whiteMs : board?.blackMs;
    if (base == null) return "—";
    const elapsed = board?.activeColor === color && board.clockStartedAt ? Math.max(0, now - Date.parse(board.clockStartedAt)) : 0;
    return arenaClock(Math.max(0, base - elapsed));
  };
  return <Link href={href} aria-label={`${mine ? "Open" : "Watch"} ${pairing.whiteName} versus ${pairing.blackName}`} className="group block min-w-0 rounded-xl border border-white/10 bg-slate-900/60 p-3 transition-colors hover:border-cyan-200/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
    <div className="mb-2 flex min-w-0 items-center gap-2 text-xs"><span className="truncate font-bold text-slate-200">{pairing.blackName}</span><span className="ml-auto shrink-0 rounded bg-slate-950 px-2 py-1 font-mono tabular-nums text-white">{clock("black")}</span></div>
    <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-md bg-slate-800" aria-hidden="true">
      {cells.map((piece, index) => {
        const Piece = piece ? defaultPieces[`${piece === piece.toUpperCase() ? "w" : "b"}${piece.toUpperCase()}`] : null;
        return <span key={index} className={`flex aspect-square items-center justify-center ${(Math.floor(index / 8) + index % 8) % 2 ? "bg-[#52777d]" : "bg-[#cee0d6]"}`}>{Piece ? <Piece /> : null}</span>;
      })}
      {!cells.length && <span className="col-span-8 grid place-items-center text-sm text-slate-400">Board loading…</span>}
    </div>
    <div className="mt-2 flex min-w-0 items-center gap-2 text-xs"><span className="truncate font-bold text-white">{pairing.whiteName}</span><span className="ml-auto shrink-0 rounded bg-white/10 px-2 py-1 font-mono tabular-nums text-white">{clock("white")}</span></div>
    <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-widest text-cyan-200">{mine ? "Return to game" : "Watch live"} ↗</p>
  </Link>;
}

function Podium({ lobby }: { lobby: InternalArenaLobby }) {
  const [celebrate, setCelebrate] = useState(false);
  const handled = useRef("");
  const results = lobby.arena.finalResults;
  useEffect(() => {
    if (!results || handled.current === lobby.arena.id) return;
    handled.current = lobby.arena.id;
    try {
      const key = `academy-arena-podium-v1:${lobby.arena.id}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "seen");
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setCelebrate(true);
      }
    } catch { /* Storage blocked: use a still podium instead of repeating celebrations. */ }
  }, [results, lobby.arena.id]);
  const winners = results
    ? results.standings.filter(entry => entry.rank <= 3)
    : lobby.arena.experienceVersion !== 1 && arenaFinalLabel(lobby) === "Final results" ? lobby.arena.standings.slice(0, 3) : [];
  if (!winners.length) return null;
  return <section aria-label="Final podium" className={`relative overflow-hidden rounded-2xl border border-amber-200/25 bg-gradient-to-br from-amber-200/10 via-slate-950 to-cyan-200/10 p-5 ${celebrate ? styles.celebrate : ""}`}>
    <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.25em] text-amber-200">The Academy podium</p><h2 className="mt-2 text-2xl font-black text-white">Well played, everyone.</h2><p className="mt-1 text-sm text-slate-400">Final standings{results ? " · prizes added to your wallets" : ""}</p></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-3">{winners.map(prize => {
      const entry = lobby.arena.standings.find(e => e.studentId === prize.studentId);
      if (!entry) return null;
      return <article key={prize.studentId} className={`flex min-w-0 flex-col items-center rounded-xl border p-4 text-center ${prize.rank === 1 ? "border-amber-200/40 bg-amber-200/10" : "border-white/10 bg-white/5"}`}>
        <p className="mb-3 font-black text-amber-100"><span aria-hidden="true">{prize.rank === 1 ? "🥇" : prize.rank === 2 ? "🥈" : "🥉"}</span> {prize.tiedCount && prize.tiedCount > 1 ? "Joint " : ""}#{prize.rank}</p>
        <Avatar entry={entry} lobby={lobby} large />
        <h3 className="mt-3 max-w-full truncate text-lg font-black text-white">{prize.name}</h3><p className="text-sm text-slate-300">{prize.score} points · {prize.wins} wins</p>
        {results && <p className="mt-3 rounded-full bg-amber-200/15 px-4 py-1 font-black text-amber-100">+{prize.coins} coins</p>}
      </article>;
    })}</div>
  </section>;
}

export function ArenaLobbyView({ lobby, now, role, status, pending, onJoin, onPause, onTogglePairings, chat, teacherControls }: Props) {
  const [tab, setTab] = useState<"Standings" | "Games" | "Chat">("Standings");
  const { arena } = lobby;
  const players = arena.standings.filter(e => e.status !== "withdrawn")
    .sort((a, b) => b.score - a.score || b.wins - a.wins || a.name.localeCompare(b.name));
  const active = lobby.pairings.filter(p => p.status === "active");
  const recent = lobby.pairings.filter(p => p.status === "completed").slice(0, 6);
  const finalLabel = arenaFinalLabel(lobby);
  const accepting = ["scheduled", "active"].includes(arena.status);
  const ready = arena.entry && arena.entry.queueEnabled !== false && ["waiting", "joined"].includes(arena.entry.status);
  return <div className="min-w-0 space-y-4">
    <Link className="inline-block text-xs font-bold text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-cyan-200" href={role === "teacher" ? "/admin/tournaments" : "/student/tournaments"}>← All tournaments</Link>
    <div className="sticky top-16 z-20 overflow-hidden rounded-2xl border border-cyan-200/20 bg-[#091523]/95 shadow-xl backdrop-blur-md lg:static">
      <header className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">Academy Arena · {arena.timeControl.name}</p><h1 className="mt-1 break-words text-xl font-black text-white sm:text-2xl">{arena.name}</h1></div>
        <div className="shrink-0 text-right"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{arena.status === "scheduled" ? "Starts in" : finalLabel ? "Arena closed" : "Time left"}</p><p className="font-mono text-3xl font-bold tabular-nums text-cyan-100">{accepting ? arenaClock(Date.parse(arena.status === "scheduled" ? arena.startsAt : arena.endsAt) - now) : "0:00"}</p></div>
      </header>
      {arena.experienceVersion === 1 && <div className="flex flex-wrap items-center justify-between gap-2 border-y border-white/5 bg-amber-200/5 px-4 py-2 text-xs sm:px-5"><span className="font-bold text-amber-100">Podium prizes</span><span className="text-slate-200">🥇 100 <span className="mx-2 text-slate-600">/</span> 🥈 50 <span className="mx-2 text-slate-600">/</span> 🥉 30 coins</span></div>}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${accepting && !arena.pairingsPaused ? "bg-emerald-300" : "bg-amber-200"}`} aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm font-bold text-white" role="status">{finalLabel || status}</p>
        {role === "student" && accepting && arena.entry?.status !== "playing" && <Button variant={ready ? "ghost" : "primary"} className="px-3 py-2 text-xs" disabled={pending} onClick={ready ? onPause : onJoin}>{pending ? "Updating…" : ready ? "Take a break" : !arena.entry ? "Join Arena" : "Rejoin queue"}</Button>}
        {role === "teacher" && accepting && <Button className="px-3 py-2 text-xs" variant="secondary" disabled={pending} onClick={onTogglePairings}>{arena.pairingsPaused ? "Resume pairings" : "Pause pairings"}</Button>}
      </div>
    </div>
    <Podium lobby={lobby} />
    <div className="grid grid-cols-3 rounded-xl border border-white/10 bg-slate-950 p-1 lg:hidden" role="tablist" aria-label="Arena sections">{(["Standings", "Games", "Chat"] as const).map((name, index) => <button key={name} id={`arena-tab-${name}`} role="tab" aria-selected={tab === name} aria-controls={`arena-panel-${name}`} tabIndex={tab === name ? 0 : -1} onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
      const name = (["Standings", "Games", "Chat"] as const)[next]; setTab(name); document.getElementById(`arena-tab-${name}`)?.focus();
    }} onClick={() => setTab(name)} className={`min-h-11 rounded-lg text-sm font-bold focus-visible:outline focus-visible:outline-cyan-200 ${tab === name ? "bg-cyan-200/15 text-cyan-100" : "text-slate-400"}`}>{name}{name === "Games" ? ` · ${active.length}` : ""}</button>)}</div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section id="arena-panel-Standings" aria-label="Player standings" className={`min-w-0 space-y-4 ${tab === "Standings" ? "" : "hidden lg:block"}`}>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4"><h2 className="font-black text-white">Players</h2><span className="text-xs text-slate-400">{players.length} players</span></div>
          <div>{players.map((entry, index) => <div key={entry.studentId} className={`flex min-w-0 items-center gap-3 border-b border-white/5 px-3 py-3 last:border-0 ${arena.entry?.studentId === entry.studentId ? "bg-cyan-200/10" : ""}`}>
            <span className="w-6 shrink-0 text-center text-sm font-black text-slate-400">{index + 1}</span>
            <span className={styles.avatar}><Avatar entry={entry} lobby={lobby} /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{entry.name}{arena.entry?.studentId === entry.studentId && <span className="ml-2 text-xs font-normal text-cyan-200">you</span>}</p><p className="mt-1 text-[11px] text-slate-400">{entry.wins} wins · {entry.gamesPlayed} games{entry.status === "playing" ? " · Playing" : entry.status === "waiting" ? " · Queued" : ""}</p></div>
            <div className="text-right"><p className="text-xl font-black tabular-nums text-amber-100">{entry.score}</p><p className="text-[9px] uppercase text-slate-500">points</p></div>
          </div>)}</div>
          {!players.length && <p className="px-5 py-10 text-center text-sm text-slate-400">Be the first to join the Arena.</p>}
        </div>
        <details className="rounded-xl border border-white/10 p-4 text-xs text-slate-400"><summary className="cursor-pointer font-bold">Arena rules</summary><p className="mt-3 leading-6">Win: 2 points. Draw: 1 point. Eligible Berserk wins earn the existing bonus. No consecutive opponents. Games started before the deadline still count.</p>{role === "teacher" && <p className="mt-2 leading-6">Students pair first; a practice bot may join after five seconds. Only students qualify for podium prizes.</p>}{arena.experienceVersion === 1 && <p className="mt-2 leading-6">Prizes require a completed game. Ties use wins, then head-to-head only if everyone in the tied group has met. Remaining ties share the affected prizes, rounded down to whole coins.</p>}{arena.description && <p className="mt-2">{arena.description}</p>}</details>
      </section>
      <div className="min-w-0 space-y-4">
        <section id="arena-panel-Games" aria-label="Live games" className={`rounded-2xl border border-white/10 bg-slate-950/85 p-4 ${tab === "Games" ? "" : "hidden lg:block"}`}>
          <div className="mb-4 flex items-center justify-between"><h2 className="font-black text-white">Live boards</h2><span className="text-xs text-emerald-200">{active.length} in play</span></div>
          <div className="grid grid-cols-2 gap-3">{active.map(pairing => <LiveBoard key={pairing.id} pairing={pairing} lobby={lobby} role={role} now={now} />)}</div>
          {!active.length && <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center"><p className="text-2xl text-cyan-200" aria-hidden="true">♜</p><p className="mt-3 text-sm font-bold text-slate-300">{accepting ? "The next boards will appear here" : "All boards have finished"}</p><p className="mt-1 text-xs text-slate-500">{accepting ? "Watch a game while you wait." : "Thanks for playing!"}</p></div>}
          {recent.length > 0 && <details className="mt-4 border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs font-bold text-slate-400">Recent results</summary><div className="mt-2 divide-y divide-white/5">{recent.map(p => <p key={p.id} className="py-2 text-xs text-slate-300">{p.whiteName} <span className="font-black text-amber-100">{p.whitePoints}–{p.blackPoints}</span> {p.blackName}</p>)}</div></details>}
        </section>
        <section id="arena-panel-Chat" aria-label="Arena chat" className={tab === "Chat" ? "" : "hidden lg:block"}>{chat}</section>
      </div>
    </div>
    {role === "teacher" && <details className="rounded-xl border border-white/10 bg-slate-950/80 p-4"><summary className="cursor-pointer font-bold text-slate-300">Teacher tools · bots & forced pairings</summary><div className="mt-4 grid gap-4 lg:grid-cols-2">{teacherControls}</div></details>}
  </div>;
}
