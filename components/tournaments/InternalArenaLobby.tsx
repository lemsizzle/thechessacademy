"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { InternalArena, InternalArenaLobby as LobbyData, InternalArenaPairing, InternalArenaStanding } from "@/chess/arena/types";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

type LobbyResponse = { ok?: boolean; lobby?: LobbyData; matchmaking?: { status: string; gameId: string | null }; error?: string };
type LobbyRole = "student" | "teacher";

const fieldClass = "rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60";

function countdown(arena: InternalArena, now: number) {
  const target = arena.status === "scheduled" ? Date.parse(arena.startsAt) : Date.parse(arena.endsAt);
  const totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours ? `${hours}h ` : ""}${minutes}m ${seconds}s`;
}

function resultText(pairing: InternalArenaPairing) {
  if (pairing.result === "draw") return `Draw · ${pairing.whitePoints}-${pairing.blackPoints} points`;
  if (pairing.result === "white_win") return `${pairing.whiteName} won · ${pairing.whitePoints}-${pairing.blackPoints} points`;
  if (pairing.result === "black_win") return `${pairing.blackName} won · ${pairing.blackPoints}-${pairing.whitePoints} points`;
  return "Game in progress";
}

function PodiumPlace({ entry, lobby, rank }: { entry: InternalArenaStanding; lobby: LobbyData; rank: 1 | 2 | 3 }) {
  const styles = rank === 1
    ? "order-1 border-amber-200/50 bg-amber-200/15 sm:order-2 sm:-translate-y-6"
    : rank === 2
      ? "order-2 border-slate-200/35 bg-slate-200/10 sm:order-1"
      : "order-3 border-orange-300/35 bg-orange-300/10";
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center rounded-xl border p-4 text-center shadow-glow ${styles}`}>
      <span className="text-3xl" aria-hidden="true">{medal}</span>
      <AvatarRenderer
        items={lobby.avatarItems}
        avatar={entry.avatar ?? { studentId: entry.studentId, equippedItems: {} }}
        size="lg"
        label={`${entry.name}, place ${rank}`}
      />
      <p className="mt-3 max-w-full truncate text-lg font-black text-white">{entry.name}</p>
      <p className="mt-1 text-sm font-black text-amber-100">{entry.score} points</p>
      <p className="mt-1 text-xs font-bold text-slate-300">{entry.wins} wins · {entry.gamesPlayed} games</p>
    </div>
  );
}

function ArenaPodium({ lobby }: { lobby: LobbyData }) {
  const topThree = lobby.arena.standings.slice(0, 3);
  const gamesStillFinishing = lobby.pairings.some((pairing) => pairing.status === "active");
  if (lobby.arena.status !== "finished" || gamesStillFinishing || !topThree.length) return null;
  const displayOrder = [topThree[1], topThree[0], topThree[2]].filter((entry): entry is InternalArenaStanding => Boolean(entry));
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-r from-amber-300/20 via-cyan-300/15 to-orange-300/20 p-5 text-center sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-100">Final results</p>
        <h2 className="mt-2 text-3xl font-black text-white">Arena Podium</h2>
        <p className="mt-2 text-sm text-slate-300">Congratulations to our top three players!</p>
        <div className="mx-auto mt-10 flex max-w-4xl flex-col items-stretch gap-4 sm:flex-row sm:items-end">
          {displayOrder.map((entry) => <PodiumPlace key={entry.studentId} entry={entry} lobby={lobby} rank={entry.rank as 1 | 2 | 3} />)}
        </div>
      </div>
    </Card>
  );
}

function PairingRow({ pairing, role, tournamentId, viewerStudentId }: { pairing: InternalArenaPairing; role: LobbyRole; tournamentId: string; viewerStudentId?: string }) {
  const viewerGame = viewerStudentId === pairing.whiteStudentId || viewerStudentId === pairing.blackStudentId;
  const href = role === "teacher"
    ? `/admin/live-games/${pairing.gameId}`
    : viewerGame
      ? `/student/play/live/${pairing.gameId}`
      : pairing.status === "active"
        ? `/student/tournaments/${tournamentId}/watch/${pairing.gameId}`
        : null;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black text-white"><span aria-label="White">♔</span> {pairing.whiteName} <span className="mx-1 text-slate-500">vs</span> {pairing.blackName} <span aria-label="Black">♚</span></p>
        {href ? <Button href={href} variant="ghost" className="px-3 py-1.5 text-xs">{role === "teacher" || !viewerGame ? "Watch" : "Open Game"}</Button> : null}
      </div>
      <p className={`mt-1 text-xs font-bold ${pairing.status === "active" ? "text-emerald-200" : "text-slate-400"}`}>{resultText(pairing)}</p>
    </div>
  );
}

export function InternalArenaLobby({ tournamentId, role, adminActionToken = "" }: { tournamentId: string; role: LobbyRole; adminActionToken?: string }) {
  const router = useRouter();
  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [chatText, setChatText] = useState("");
  const [firstStudentId, setFirstStudentId] = useState("");
  const [secondStudentId, setSecondStudentId] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const loadingRef = useRef(false);
  const endpoint = `/api/${role === "teacher" ? "admin" : "student"}/internal-arenas/${tournamentId}/lobby`;
  const headers = useMemo(() => adminActionToken ? { "x-admin-action-token": adminActionToken } : undefined, [adminActionToken]);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin", headers });
      const body = await response.json() as LobbyResponse;
      if (!response.ok || !body.lobby) throw new Error(body.error || "The Arena lobby could not be loaded.");
      setLobby(body.lobby);
      if (role === "student" && body.lobby.arena.entry?.status === "playing" && body.lobby.arena.entry.currentGameId) {
        router.push(`/student/play/live/${body.lobby.arena.entry.currentGameId}`);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [endpoint, headers, role, router]);

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "The Arena lobby could not be loaded.")); }, [load]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") void load().catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const available = lobby?.arena.standings.filter((entry) => entry.status === "waiting" || entry.status === "joined") ?? [];
  const queued = lobby?.arena.standings.filter((entry) => entry.status === "waiting") ?? [];
  const activePairings = lobby?.pairings.filter((pairing) => pairing.status === "active") ?? [];
  const recentPairings = lobby?.pairings.filter((pairing) => pairing.status === "completed").slice(0, 8) ?? [];

  async function studentQueue(action: "join" | "pause") {
    if (!lobby) return;
    setPending(action); setMessage("");
    try {
      const response = await fetch(`/api/student/internal-arenas/${tournamentId}/join`, { method: action === "join" ? "POST" : "DELETE" });
      const body = await response.json() as LobbyResponse;
      if (!response.ok) throw new Error(body.error || "Arena matchmaking could not be updated.");
      if (body.matchmaking?.gameId) {
        router.push(`/student/play/live/${body.matchmaking.gameId}`);
        return;
      }
      setMessage(action === "pause" ? "You left the queue. You can rejoin when ready." : lobby.arena.status === "scheduled" ? "You are registered for this Arena." : "You are in the matchmaking queue.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Arena matchmaking could not be updated.");
    } finally { setPending(""); }
  }

  async function forceMatch() {
    if (!firstStudentId || !secondStudentId || firstStudentId === secondStudentId) {
      setMessage("Choose two different available students.");
      return;
    }
    setPending("force"); setMessage("");
    try {
      const response = await fetch(`/api/admin/internal-arenas/${tournamentId}/force-match`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-admin-action-token": adminActionToken },
        body: JSON.stringify({ firstStudentId, secondStudentId })
      });
      const body = await response.json() as LobbyResponse;
      if (!response.ok || !body.matchmaking?.gameId) throw new Error(body.error || "Students could not be paired.");
      setFirstStudentId(""); setSecondStudentId(""); setMessage("The forced pairing is live.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Students could not be paired.");
    } finally { setPending(""); }
  }

  async function sendChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chatText.trim()) return;
    setPending("chat"); setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", ...(adminActionToken ? { "x-admin-action-token": adminActionToken } : {}) },
        body: JSON.stringify({ message: chatText })
      });
      const body = await response.json() as LobbyResponse;
      if (!response.ok) throw new Error(body.error || "Your message could not be sent.");
      setChatText("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your message could not be sent.");
    } finally { setPending(""); }
  }

  if (!lobby) return <Card className="p-6 text-sm text-slate-300">{message || "Opening the Arena lobby..."}</Card>;
  const arena = lobby.arena;
  const studentIsWaiting = arena.entry?.status === "waiting";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button href={role === "teacher" ? "/admin/tournaments" : "/student/tournaments"} variant="ghost">← All Arenas</Button>
        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${arena.status === "active" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : arena.status === "scheduled" ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/5 text-slate-300"}`}>{arena.status}</span>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="h-1 bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-200" />
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Academy Arena Lobby</p>
            <h1 className="mt-1 text-3xl font-black text-white">{arena.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{arena.description}</p>
            <p className="mt-3 text-sm font-bold text-slate-400">{arena.timeControl.name} · {arena.rated ? "Rated" : "Casual"} · {arena.classGroup || "All students"}</p>
          </div>
          <div className="shrink-0 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 text-center">
            <p className="text-xs font-black uppercase text-cyan-100">{arena.status === "scheduled" ? "Starts in" : arena.status === "active" ? "Time left" : "Tournament"}</p>
            <p className="mt-1 text-xl font-black text-white">{arena.status === "scheduled" || arena.status === "active" ? countdown(arena, now) : "Complete"}</p>
          </div>
        </div>
      </Card>

      <ArenaPodium lobby={lobby} />
      {message ? <p className="rounded-md border border-cyan-300/25 bg-cyan-300/10 p-3 text-sm font-bold text-cyan-50" aria-live="polite">{message}</p> : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.75fr)]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase text-emerald-200">Live leaderboard</p><h2 className="mt-1 text-xl font-black text-white">Current Standings</h2></div>
              {role === "student" && arena.status === "active" && studentIsWaiting ? <Button type="button" variant="ghost" disabled={pending === "pause"} onClick={() => void studentQueue("pause")}>Leave Queue</Button> : null}
              {role === "student" && arena.status === "active" && !studentIsWaiting && arena.entry?.status !== "playing" ? <Button type="button" disabled={pending === "join"} onClick={() => void studentQueue("join")}>Enter Queue</Button> : null}
              {role === "student" && arena.status === "scheduled" && !arena.entry ? <Button type="button" variant="secondary" disabled={pending === "join"} onClick={() => void studentQueue("join")}>Join Early</Button> : null}
            </div>
            <div className="mt-4 overflow-x-auto rounded-md border border-white/10">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-white/5 text-slate-400"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Player</th><th className="px-3 py-2">Points</th><th className="px-3 py-2">Games</th><th className="px-3 py-2">W-D-L</th></tr></thead>
                <tbody>{arena.standings.map((entry) => <tr key={entry.studentId} className={`border-t border-white/5 ${arena.entry?.studentId === entry.studentId ? "bg-cyan-300/10 text-cyan-50" : "text-slate-200"}`}><td className="px-3 py-2 font-black">#{entry.rank}</td><td className="px-3 py-2 font-bold">{entry.name}{entry.status === "playing" ? " · playing" : entry.status === "waiting" ? " · queued" : ""}</td><td className="px-3 py-2 font-black text-amber-100">{entry.score}</td><td className="px-3 py-2">{entry.gamesPlayed}</td><td className="px-3 py-2">{entry.wins}-{entry.draws}-{entry.losses}</td></tr>)}</tbody>
              </table>
              {!arena.standings.length ? <p className="p-4 text-sm text-slate-500">No players have joined yet.</p> : null}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-black uppercase text-amber-200">Boards in play</p>
            <h2 className="mt-1 text-xl font-black text-white">Current Pairings</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {activePairings.map((pairing) => <PairingRow key={pairing.id} pairing={pairing} role={role} tournamentId={tournamentId} viewerStudentId={arena.entry?.studentId} />)}
            </div>
            {!activePairings.length ? <p className="mt-4 rounded-md border border-dashed border-white/10 p-4 text-sm text-slate-400">No games are in progress right now.</p> : null}
            {recentPairings.length ? <><h3 className="mt-6 text-sm font-black uppercase text-slate-300">Recent results</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{recentPairings.map((pairing) => <PairingRow key={pairing.id} pairing={pairing} role={role} tournamentId={tournamentId} viewerStudentId={arena.entry?.studentId} />)}</div></> : null}
          </Card>
        </div>

        <aside className="min-w-0 space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase text-emerald-200">Ready to play</p><h2 className="mt-1 text-xl font-black text-white">Queue</h2></div><span className="rounded-full bg-emerald-300/10 px-3 py-1 text-sm font-black text-emerald-100">{queued.length}</span></div>
            <div className="mt-4 space-y-2">{queued.map((entry, index) => <div key={entry.studentId} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"><span className="font-bold text-white">{entry.name}</span><span className="text-xs font-black text-slate-400">#{index + 1}</span></div>)}</div>
            {!queued.length ? <p className="mt-4 text-sm text-slate-400">The queue is empty.</p> : null}
          </Card>

          {role === "teacher" && arena.status === "active" ? <Card className="p-5"><p className="text-xs font-black uppercase text-amber-200">Teacher control</p><h2 className="mt-1 text-lg font-black text-white">Force Matchmaking</h2><p className="mt-2 text-xs leading-5 text-slate-400">Pair any two available registered students, including students who paused their queue.</p><div className="mt-3 grid gap-2"><select className={fieldClass} aria-label="First player" value={firstStudentId} onChange={(event) => setFirstStudentId(event.target.value)}><option value="">First player</option>{available.map((entry) => <option key={entry.studentId} value={entry.studentId}>{entry.name} ({entry.status})</option>)}</select><select className={fieldClass} aria-label="Second player" value={secondStudentId} onChange={(event) => setSecondStudentId(event.target.value)}><option value="">Second player</option>{available.map((entry) => <option key={entry.studentId} value={entry.studentId}>{entry.name} ({entry.status})</option>)}</select></div><Button type="button" variant="secondary" className="mt-3 w-full" disabled={pending === "force" || available.length < 2} onClick={() => void forceMatch()}>{pending === "force" ? "Pairing..." : "Force Match"}</Button></Card> : null}

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase text-cyan-200">Tournament room</p><h2 className="mt-1 text-xl font-black text-white">Live Chat</h2></div><span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" aria-label="Chat updating live" /></div>
            <div className="mt-4 max-h-96 space-y-3 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/70 p-3" aria-live="polite">
              {lobby.messages.map((chat) => <div key={chat.id} className={`rounded-md p-2.5 ${chat.senderRole === "teacher" ? "border border-amber-300/25 bg-amber-300/10" : "bg-white/5"}`}><div className="flex items-baseline justify-between gap-2"><p className={`text-xs font-black ${chat.senderRole === "teacher" ? "text-amber-100" : "text-cyan-100"}`}>{chat.senderName}{chat.senderRole === "teacher" ? " · Teacher" : ""}</p><time className="text-[10px] text-slate-500" dateTime={chat.createdAt}>{new Date(chat.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p className="mt-1 break-words text-sm leading-5 text-slate-100">{chat.message}</p></div>)}
              {!lobby.messages.length ? <p className="py-6 text-center text-sm text-slate-500">No messages yet. Say good luck!</p> : null}
            </div>
            <form className="mt-3 space-y-2" onSubmit={(event) => void sendChat(event)}><label className="sr-only" htmlFor="arena-chat-message">Arena chat message</label><textarea id="arena-chat-message" className={`${fieldClass} min-h-20 w-full resize-none`} maxLength={280} value={chatText} onChange={(event) => setChatText(event.target.value)} disabled={!lobby.canChat || pending === "chat"} placeholder={lobby.canChat ? "Write an encouraging message..." : "Join this Arena to use chat."} /><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-500">{chatText.length}/280</span><Button type="submit" disabled={!lobby.canChat || pending === "chat" || !chatText.trim()}>{pending === "chat" ? "Sending..." : "Send"}</Button></div></form>
          </Card>
        </aside>
      </div>
    </div>
  );
}
