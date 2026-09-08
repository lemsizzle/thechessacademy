"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InternalArenaLobby as LobbyData } from "@/chess/arena/types";
import { ArenaLobbyView } from "@/components/tournaments/ArenaLobbyView";
import { useArenaQueue } from "@/chess/hooks/useArenaQueue";
import { arenaQueueLabel } from "@/chess/arena/presentation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ArenaBotControls } from "@/components/tournaments/ArenaBotControls";


type LobbyResponse = { ok?: boolean; lobby?: LobbyData; matchmaking?: { status: string; gameId: string | null }; error?: string };
type LobbyRole = "student" | "teacher";

const fieldClass = "rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60";

export function InternalArenaLobby({ tournamentId, role, adminActionToken = "" }: { tournamentId: string; role: LobbyRole; adminActionToken?: string }) {
  const arenaQueue = useArenaQueue(role === "student" ? tournamentId : null);
  const serverOffset = useRef(0);
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
      const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin", headers, signal: AbortSignal.timeout(8000) });
      const body = await response.json() as LobbyResponse;
      if (!response.ok || !body.lobby) throw new Error(body.error || "The Arena lobby could not be loaded.");
      setLobby(body.lobby);
      if (body.lobby.serverTime) serverOffset.current = Date.parse(body.lobby.serverTime) - Date.now();

    } finally {
      loadingRef.current = false;
    }
  }, [endpoint, headers]);

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "The Arena lobby could not be loaded.")); }, [load]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now() + serverOffset.current);
      if (document.visibilityState === "visible") void load().catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const available = lobby?.arena.standings.filter((entry) => entry.status === "waiting" || entry.status === "joined") ?? [];
  const queued = lobby?.arena.standings.filter((entry) => entry.status === "waiting") ?? [];

  async function studentQueue(action: "join" | "pause") {
    if (!lobby) return;
    setPending(action); setMessage("");
    try {
      // One queue hook owns assignment navigation, including explicit join responses.
      const queue = await arenaQueue.update(action);
      if (!queue || queue.gameId) return;
      setMessage(action === "pause" ? "You left the queue. You can rejoin when ready." : lobby.arena.status === "scheduled" ? "You are registered for this Arena." : "You are in the matchmaking queue.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Arena matchmaking could not be updated.");
    } finally { setPending(""); }
  }

  async function togglePairings() {
    if (!lobby || pending) return;
    setPending("pairings"); setMessage("");
    try {
      const response = await fetch(`/api/admin/internal-arenas/${tournamentId}`, {
        method: "PATCH", credentials: "same-origin",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ action: lobby.arena.pairingsPaused ? "resume_pairings" : "pause_pairings" })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Pairings could not be updated.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Pairings could not be updated."); }
    finally { setPending(""); }
  }

  async function forceMatch() {
    if (lobby?.arena.pairingsPaused) { setMessage("Resume pairings before forcing a match."); return; }
    if (!firstStudentId || !secondStudentId || firstStudentId === secondStudentId) {
      setMessage("Choose two different available players.");
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
  const status = role === "teacher" ? arena.pairingsPaused ? "Pairings paused" : `${queued.filter(e => !e.bot).length} students in the queue`
    : arenaQueue.error || (!arena.entry ? "Join the Arena to play" : arenaQueue.queue ? arenaQueueLabel(arenaQueue.queue) : "Checking your pairing…");
  return <div className="space-y-3">
    {message && <p role="status" className="rounded-lg border border-cyan-200/20 bg-cyan-200/5 p-3 text-sm text-cyan-100">{message}</p>}
    <ArenaLobbyView lobby={lobby} now={now} role={role} status={status} pending={Boolean(pending)}
      onJoin={() => void studentQueue("join")} onPause={() => void studentQueue("pause")} onTogglePairings={() => void togglePairings()}
      chat={<Card className="p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase text-cyan-200">Tournament room</p><h2 className="mt-1 text-xl font-black text-white">Live Chat</h2></div><span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" aria-label="Chat updating live" /></div>
            <div className="mt-4 max-h-96 space-y-3 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/70 p-3" aria-live="polite">
              {lobby.messages.map((chat) => <div key={chat.id} className={`rounded-md p-2.5 ${chat.senderRole === "teacher" ? "border border-amber-300/25 bg-amber-300/10" : "bg-white/5"}`}><div className="flex items-baseline justify-between gap-2"><p className={`text-xs font-black ${chat.senderRole === "teacher" ? "text-amber-100" : "text-cyan-100"}`}>{chat.senderName}{chat.senderRole === "teacher" ? " · Teacher" : ""}</p><time className="text-[10px] text-slate-500" dateTime={chat.createdAt}>{new Date(chat.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p className="mt-1 break-words text-sm leading-5 text-slate-100">{chat.message}</p></div>)}
              {!lobby.messages.length ? <p className="py-6 text-center text-sm text-slate-500">No messages yet. Say good luck!</p> : null}
            </div>
            <form className="mt-3 space-y-2" onSubmit={(event) => void sendChat(event)}><label className="sr-only" htmlFor="arena-chat-message">Arena chat message</label><textarea id="arena-chat-message" className={`${fieldClass} min-h-20 w-full resize-none`} maxLength={280} value={chatText} onChange={(event) => setChatText(event.target.value)} disabled={!lobby.canChat || pending === "chat"} placeholder={lobby.canChat ? "Write an encouraging message..." : "Join this Arena to use chat."} /><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-500">{chatText.length}/280</span><Button type="submit" disabled={!lobby.canChat || pending === "chat" || !chatText.trim()}>{pending === "chat" ? "Sending..." : "Send"}</Button></div></form>
          </Card>}
      teacherControls={<><ArenaBotControls arena={arena} adminActionToken={adminActionToken} onChange={load} />{role === "teacher" && arena.status === "active" ? <Card className="p-5"><p className="text-xs font-black uppercase text-amber-200">Teacher control</p><h2 className="mt-1 text-lg font-black text-white">Force Matchmaking</h2><p className="mt-2 text-xs leading-5 text-slate-400">Pair any two available players, including two bots.</p><div className="mt-3 grid gap-2"><select className={fieldClass} aria-label="First player" value={firstStudentId} onChange={(event) => setFirstStudentId(event.target.value)}><option value="">First player</option>{available.map((entry) => <option key={entry.studentId} value={entry.studentId}>{entry.name} ({entry.status})</option>)}</select><select className={fieldClass} aria-label="Second player" value={secondStudentId} onChange={(event) => setSecondStudentId(event.target.value)}><option value="">Second player</option>{available.map((entry) => <option key={entry.studentId} value={entry.studentId}>{entry.name} ({entry.status})</option>)}</select></div><Button type="button" variant="secondary" className="mt-3 w-full" disabled={pending === "force" || available.length < 2} onClick={() => void forceMatch()}>{pending === "force" ? "Pairing..." : "Force Match"}</Button></Card> : null}</>} />
  </div>;
}
