"use client";

import { useRef, useState } from "react";
import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import { MAX_ARENA_BOTS } from "@/chess/arena/bots";
import type { InternalArena } from "@/chess/arena/types";
import { BotPortrait } from "@/chess/components/BotPortrait";
import { Button } from "@/components/Button";

const field = "min-w-0 w-full rounded-md border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-300";

export function ArenaBotControls({ arena, adminActionToken, onChange }: { arena: InternalArena; adminActionToken: string; onChange: () => Promise<void> }) {
  const [difficultyId, setDifficultyId] = useState("knight");
  const [name, setName] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const busy = useRef(false);
  const bots = arena.standings.filter((entry) => entry.bot);
  const open = arena.status === "active" || arena.status === "scheduled";
  if (!open) return null;

  async function change(method: "POST" | "PATCH" | "DELETE", values: Record<string, string>, key: string) {
    if (busy.current) return;
    busy.current = true; setPending(key); setMessage("");
    try {
      const response = await fetch(`/api/admin/internal-arenas/${arena.id}/bots`, {
        method, credentials: "same-origin",
        headers: { "content-type": "application/json", "x-admin-action-token": adminActionToken },
        body: JSON.stringify(values)
      });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || "The bot could not be updated.");
      if (method === "POST") setName("");
      if (method === "DELETE") setRemovingId(null);
      setMessage(method === "DELETE" ? "Bot removed from the queue." : method === "PATCH" ? "Skill updated for the bot's next game." : "Bot added and ready to play.");
      await onChange();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { busy.current = false; setPending(""); }
  }

  return <section className="mt-4 min-w-0 rounded-lg border border-violet-300/25 bg-violet-300/10 p-4" aria-label="Arena bots">
    <div className="flex items-center justify-between gap-2"><h3 className="font-black text-violet-100">Computer players</h3><span className="text-xs text-slate-300">{bots.length}/{MAX_ARENA_BOTS} bots</span></div>
    <p className="mt-2 text-xs leading-5 text-slate-300">Choose a skill level, then add a bot. Students are paired with each other first; available bots fill the queue. Bot games earn Arena points but never affect PvP ratings.</p>
    <form className="mt-3 grid min-w-0 gap-2" onSubmit={(event) => {
      event.preventDefault();
      void change("POST", { difficultyId, name: name.trim() || BOT_DIFFICULTIES.find((bot) => bot.id === difficultyId)!.name }, "add");
    }}>
      <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-200">Bot skill level<select className={field} value={difficultyId} onChange={(event) => setDifficultyId(event.target.value)} disabled={Boolean(pending)}>
        {BOT_DIFFICULTIES.map((bot) => <option key={bot.id} value={bot.id}>{bot.name} · ~{bot.estimatedRating} · {bot.title}</option>)}
      </select></label>
      <label className="grid gap-1 text-xs font-bold text-slate-200">Bot name (optional)<input className={field} maxLength={40} value={name} onChange={(event) => setName(event.target.value)} placeholder={BOT_DIFFICULTIES.find((bot) => bot.id === difficultyId)?.name} disabled={Boolean(pending)} /></label>
      <Button type="submit" variant="secondary" disabled={Boolean(pending) || bots.length >= MAX_ARENA_BOTS}>{pending === "add" ? "Adding..." : "Add Bot"}</Button>
    </form>
    <p className="mt-2 text-xs text-slate-400">Skill ratings are estimates. Bots can play students or each other. Keep an Arena lobby or game board open for automatic play.</p>
    {message ? <p role="status" className="mt-3 text-sm font-bold text-cyan-100">{message}</p> : null}
    <div className="mt-4 space-y-3">{bots.map((entry) => {
      const bot = entry.bot!;
      const preset = BOT_DIFFICULTIES.find((item) => item.id === bot.difficultyId);
      const selected = edits[bot.id] ?? bot.difficultyId;
      return <div key={bot.id} className="min-w-0 rounded-lg border border-white/10 bg-slate-950/60 p-3">
        <div className="flex min-w-0 items-center gap-2"><BotPortrait src={preset?.portrait ?? "/bots/zippy-knight.png"} /><div className="min-w-0"><p className="truncate text-sm font-black text-white">{bot.name}</p><p className="text-xs text-slate-400">{bot.removed ? "Removed · finishing current game only" : entry.status === "playing" ? "Playing · changes apply next game" : "Ready for matchmaking"}</p></div></div>
        <label className="mt-3 grid min-w-0 gap-1 text-xs text-slate-300">Skill for {bot.name}<select className={field} value={selected} disabled={Boolean(pending) || bot.removed} onChange={(event) => setEdits((value) => ({ ...value, [bot.id]: event.target.value }))}>{BOT_DIFFICULTIES.map((level) => <option key={level.id} value={level.id}>{level.name} · ~{level.estimatedRating}</option>)}</select></label>
        <div className="mt-2 flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={Boolean(pending) || bot.removed || selected === bot.difficultyId} onClick={() => void change("PATCH", { botId: bot.id, name: bot.name, difficultyId: selected }, bot.id)}>Save Skill</Button><Button type="button" variant="ghost" disabled={Boolean(pending) || bot.removed} onClick={() => setRemovingId(bot.id)}>{bot.removed ? "Removed" : "Remove"}</Button></div>
        {removingId === bot.id ? <div className="mt-3 rounded-md border border-rose-300/30 bg-rose-300/10 p-3"><p className="text-sm text-rose-100">Remove {bot.name} from this Arena? Any current game will finish normally, with no further pairings.</p><div className="mt-2 flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={Boolean(pending) || bot.removed} onClick={() => void change("DELETE", { botId: bot.id }, bot.id)}>Confirm Remove</Button><Button type="button" variant="ghost" disabled={Boolean(pending)} onClick={() => setRemovingId(null)}>Keep Bot</Button></div></div> : null}
      </div>;
    })}</div>
  </section>;
}
