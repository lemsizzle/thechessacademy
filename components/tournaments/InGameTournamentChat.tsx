"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { InternalArenaChatMessage } from "@/chess/arena/types";
import { Button } from "@/components/Button";

// Separate state keeps typing and message updates independent of the board/clock.
export const InGameTournamentChat = memo(function InGameTournamentChat({ tournamentId }: { tournamentId: string }) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<InternalArenaChatMessage[]>([]);
  const [canChat, setCanChat] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const endpoint = `/api/student/internal-arenas/${encodeURIComponent(tournamentId)}`;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let busy = false;
    async function load() {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const response = await fetch(`${endpoint}/chat`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Chat could not be loaded.");
        if (!controller.signal.aborted) {
          // A poll started before a send must not erase that newly sent message.
          setMessages(previous => [...new Map([...previous, ...body.messages].map((message: InternalArenaChatMessage) => [message.id, message])).values()]
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).slice(-50));
          setCanChat(body.canChat); setLoaded(true); setLoadError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "Chat is reconnecting.");
      } finally { busy = false; }
    }
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    document.addEventListener("visibilitychange", load);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", load); };
  }, [endpoint, open]);

  useEffect(() => {
    if (open && stickToBottom.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, open]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || sendingRef.current || !canChat) return;
    sendingRef.current = true; setSending(true); setError("");
    try {
      const response = await fetch(`${endpoint}/lobby`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: draft }), signal: AbortSignal.timeout(8000) });
      const body = await response.json();
      if (!response.ok || !body.message) throw new Error(body.error || "Message could not be sent. Please try again.");
      stickToBottom.current = true;
      setMessages(previous => [...previous.filter(message => message.id !== body.message.id), body.message].slice(-50));
      setDraft("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Message could not be sent."); }
    finally { sendingRef.current = false; setSending(false); }
  }

  return <section className="min-w-0 rounded-xl border border-cyan-200/20 bg-slate-950 p-4" aria-label="Tournament chat">
    <button type="button" className="flex min-h-10 w-full items-center justify-between gap-3 text-left font-black text-cyan-100" aria-expanded={open} aria-controls="in-game-tournament-chat" onClick={() => setOpen(!open)}>Tournament chat <span className="text-xs">{open ? "Hide" : "Show"}</span></button>
    {open && <div id="in-game-tournament-chat">
      <p className="mb-3 text-xs text-slate-400">The same room as the tournament lobby. Your game clock keeps running.</p>
      <div ref={log} role="log" aria-label="Tournament messages" className="max-h-52 space-y-3 overflow-y-auto overscroll-contain break-words rounded-lg bg-white/5 p-3" onScroll={() => { if (log.current) stickToBottom.current = log.current.scrollHeight - log.current.scrollTop - log.current.clientHeight < 40; }}>
        {!messages.length && <p className="text-sm text-slate-400">{loaded ? "No messages yet. Say good luck!" : "Connecting to chat…"}</p>}
        {messages.map(message => <div key={message.id}><p className={`text-xs font-bold ${message.senderRole === "teacher" ? "text-amber-200" : "text-cyan-200"}`}>{message.senderName}{message.senderRole === "teacher" ? " · Teacher" : ""}</p><p className="text-sm text-slate-100">{message.message}</p></div>)}
      </div>
      {(error || loadError) && <p role="alert" className="mt-2 text-xs text-amber-200">{error || loadError}</p>}
      <form onSubmit={event => void send(event)} className="mt-3 space-y-2">
        <label htmlFor="in-game-chat-draft" className="sr-only">Tournament message</label>
        <textarea id="in-game-chat-draft" maxLength={280} rows={2} disabled={!canChat || sending} value={draft} onChange={event => setDraft(event.target.value)} className="w-full resize-none rounded-lg border border-white/20 bg-slate-900 p-2 text-sm text-white" placeholder={loaded && !canChat ? "Chat is closed." : "Write an encouraging message…"} />
        <div className="flex items-center justify-between"><span className="text-xs text-slate-400">{draft.length}/280</span><Button type="submit" disabled={!canChat || sending || !draft.trim()}>{sending ? "Sending…" : "Send"}</Button></div>
      </form>
    </div>}
  </section>;
});
