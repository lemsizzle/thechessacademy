"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TournamentRoundCountdown } from "./TournamentRoundProgress";
import { BATTLE_LABELS, BATTLE_MODES, BATTLE_TIMES, type BattleMode } from "@/lib/puzzle-battle/types";
import { tournamentStandings, type PuzzleTournament, type TournamentEntry } from "@/lib/puzzle-battle/tournament";

type Summary = Pick<PuzzleTournament, "id" | "title" | "mode" | "duration" | "rounds" | "round" | "status"> & { players: number };
const field = "mt-1 block min-h-11 w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white";
function EloEditor({ entry, disabled, save }: { entry: TournamentEntry; disabled: boolean; save: (elo: number) => void }) {
  const [elo, setElo] = useState(entry.elo ?? 800);
  return <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); save(elo); }}>
    <label className="text-xs">{entry.name} Elo<input aria-label={`${entry.name} Elo`} className={`${field} max-w-24`} type="number" min={200} max={2400} step={1} value={elo} onChange={e => setElo(Number(e.target.value))} /></label>
    <Button type="submit" disabled={disabled || elo === entry.elo} variant="secondary">Save</Button>
  </form>;
}

export function PuzzleTournaments({ teacher = false, adminActionToken = "" }: { teacher?: boolean; adminActionToken?: string }) {
  const endpoint = `/api/${teacher ? "admin" : "student"}/puzzle-tournaments`;
  const [id, setId] = useState<string | null>(null), [loaded, setLoaded] = useState(false);
  const [tournament, setTournament] = useState<PuzzleTournament | null>(null), [list, setList] = useState<Summary[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [title, setTitle] = useState("Class Puzzle Cup"), [mode, setMode] = useState<BattleMode>("survival");
  const [duration, setDuration] = useState(180), [rounds, setRounds] = useState(3);
  const [botName, setBotName] = useState("Maple Knight"), [elo, setElo] = useState(800);
  const [confirm, setConfirm] = useState<{ action: string; entryId?: string; label: string } | null>(null);
  const [shownRound, setShownRound] = useState<number | null>(null);
  const createId = useRef<string | null>(null), botId = useRef<string | null>(null);
  const generation = useRef(0), reading = useRef(false), writing = useRef(false), currentId = useRef<string | null>(null);
  const lastRead = useRef(0), terminal = useRef(false);
  const request = useCallback(async (suffix: string, body?: object) => {
    const response = await fetch(`${endpoint}${suffix}`, { method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(30000),
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(teacher ? { "x-admin-action-token": adminActionToken } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Couldn't load the tournament. Please retry.");
    return data as { tournament?: PuzzleTournament; tournaments?: Summary[] };
  }, [endpoint, teacher, adminActionToken]);
  const load = useCallback(async () => {
    if (reading.current || writing.current || document.hidden) return;
    reading.current = true;
    lastRead.current = Date.now();
    const token = generation.current;
    try {
      const data = await request(currentId.current ? `?id=${encodeURIComponent(currentId.current)}` : "");
      if (token !== generation.current) return;
      if (data.tournament) {
        terminal.current = ["finished", "cancelled"].includes(data.tournament.status);
        setTournament(data.tournament);
      } else setList(data.tournaments ?? []);
      setError("");
    } catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : "Connection lost. Please retry."); }
    finally { reading.current = false; if (token === generation.current) setLoaded(true); }
  }, [request]);
  useEffect(() => {
    currentId.current = new URLSearchParams(location.search).get("id"); setId(currentId.current);
    void load();
    const timer = setInterval(() => { if (!terminal.current && Date.now() - lastRead.current >= (currentId.current ? 10000 : 30000)) void load(); }, 1000);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { generation.current++; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);
  function open(next: string | null) {
    generation.current++; currentId.current = next; setId(next); setTournament(null); setLoaded(false); setError(""); setConfirm(null); setShownRound(null);
    history.replaceState(null,"", next ? `?id=${encodeURIComponent(next)}` : location.pathname);
    lastRead.current = 0; terminal.current = false;
    void load();
  }
  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (writing.current) return;
    writing.current = true; generation.current++; setBusy(true); setError(""); setNotice("");
    const token = generation.current;
    try {
      const data = await request("", { action, id: currentId.current, ...extra });
      if (token !== generation.current || !data.tournament) return;
      terminal.current = ["finished", "cancelled"].includes(data.tournament.status);
      setTournament(data.tournament); setShownRound(null); setConfirm(null); setLoaded(true);
      if (!currentId.current) { currentId.current = data.tournament.id; setId(data.tournament.id); history.replaceState(null,"",`?id=${data.tournament.id}`); }
      if (action === "create") createId.current = null;
      if (action === "bot") { botId.current = null; setBotName(""); }
      setNotice(action === "start" ? `Round ${data.tournament.round} starts after the countdown. Students can open their assigned battles now.` : action === "join" ? "You're in! Stay here for your pairing." : "Saved.");
    } catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : "Couldn't save. Please retry."); }
    finally { writing.current = false; setBusy(false); }
  }
  const t = tournament;
  const rows = t ? tournamentStandings(t) : [];
  const myMatch = t?.matches.find(m => m.round === t.round && (m.a === t.me || m.b === t.me));
  const roundMatches = t?.matches.filter(m => m.round === (shownRound ?? t.round)) ?? [];
  const canStart = t && ["waiting","active"].includes(t.status) && t.entries.length >= 2 && t.round < t.rounds && !t.matches.some(m => !m.result);
  const names = new Map(t?.entries.map(e => [e.id,e.name]));
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-widest text-cyan-200">Puzzle Battle tournaments</p><h2 className="mt-1 text-2xl font-black">{t?.title ?? "Race, solve, and climb the standings"}</h2></div>
      <div className="flex gap-2">{id && <Button variant="ghost" disabled={busy} onClick={() => open(null)}>All puzzle tournaments</Button>}<Button variant="secondary" disabled={busy} onClick={() => void load()}>Refresh</Button></div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p>}
    {notice && <p role="status" className="text-sm text-cyan-100">{notice}</p>}
    {!loaded && <p role="status" className="text-slate-300">Loading tournaments…</p>}
    {!id && <>
      {teacher && <Card className="p-5"><h3 className="text-lg font-black">Host a Puzzle Battle tournament</h3>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); createId.current ??= crypto.randomUUID(); void act("create",{ requestId: createId.current, title, mode, duration, rounds }); }}>
          <label className="text-sm font-bold">Tournament name<input required maxLength={80} value={title} onChange={e => { setTitle(e.target.value); createId.current = null; }} className={field} /></label>
          <label className="text-sm font-bold">Battle mode<select className={field} value={mode} onChange={e => { setMode(e.target.value as BattleMode); createId.current=null; }}>{BATTLE_MODES.map(m => <option key={m} value={m}>{BATTLE_LABELS[m]}</option>)}</select></label>
          <label className="text-sm font-bold">Time per battle<select className={field} value={duration} onChange={e => { setDuration(Number(e.target.value)); createId.current=null; }}>{BATTLE_TIMES.map(n => <option key={n} value={n}>{n/60} min</option>)}</select></label>
          <label className="text-sm font-bold">Number of rounds<input className={field} type="number" min={1} max={9} value={rounds} onChange={e => { setRounds(Number(e.target.value)); createId.current=null; }} /></label>
          <p className="text-sm text-slate-300 sm:col-span-2">Start the tournament once. Later rounds begin automatically when every battle finishes, with a 10-second countdown. Up to 32 players, including bots.</p>
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create tournament"}</Button>
        </form></Card>}
      <Card className="p-5"><h3 className="text-lg font-black">Tournament lobbies</h3>{loaded && !list.length && <p className="mt-3 text-slate-400">No Puzzle Battle tournaments yet.{!teacher && " Your teacher can host one here."}</p>}
        <ul className="divide-y divide-white/10">{list.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{item.title}</p><p className="text-sm text-slate-400">{BATTLE_LABELS[item.mode]} · {item.duration/60} min · {item.rounds} rounds · {item.players} players · {item.status === "waiting" ? "Open for entry" : item.status}</p></div><Button onClick={() => open(item.id)} variant="secondary">Open lobby</Button></li>)}</ul>
      </Card>
    </>}
    {t && <>
      <Card className="space-y-4 p-5">
        <p className="font-bold text-cyan-100">{BATTLE_LABELS[t.mode]} · {t.duration/60} min per battle · {t.status === "waiting" ? `${t.rounds} rounds planned` : `Round ${t.round} of ${t.rounds}`} · {t.status === "waiting" ? "Registration open" : t.status}</p>
        <p className="text-sm leading-6 text-slate-300">Win = 2 points, draw = 1, loss = 0. An odd player gets a bye worth 2 points; byes rotate. Players with equal points share a place. Pairings favor similar scores and avoid repeats when possible. Everyone gets the same puzzles each round.</p>
        <p className="text-sm text-slate-300">{t.mode === "hide-and-seek" ? "Hide and Seek: one board. First to find every safe square wins; a wrong square loses immediately. An unfinished race at the time limit is a draw." : "Survival and Star Wars: three lives. Each completed puzzle earns one battle point; the higher score when the battle ends wins."}</p>
        <div className="flex flex-wrap gap-2">
          {!teacher && t.status === "waiting" && <Button disabled={busy || (!t.me && t.entries.length >= 32)} onClick={() => t.me ? setConfirm({ action:"leave",label:"Leave this tournament before it starts?" }) : void act("join")}>{t.me ? "Leave tournament" : "Join tournament"}</Button>}
          <Button variant="secondary" onClick={async () => { const url = `${location.origin}/student/tournaments/puzzle?id=${t.id}`; try { await navigator.clipboard.writeText(url); setNotice("Student lobby link copied."); } catch { setNotice(url); } }}>Copy student link</Button>
          {teacher && t.status === "waiting" && <Button disabled={busy || !canStart} onClick={() => void act("start",{ version:t.version })}>{busy ? "Preparing…" : "Start tournament"}</Button>}
          {teacher && ["waiting","active"].includes(t.status) && <Button variant="ghost" disabled={busy} onClick={() => setConfirm({action:"cancel",label:"Cancel this tournament? Unfinished battles will close. Completed round results stay in history."})}>Cancel tournament</Button>}
        </div>
        {t.status === "active" && <><TournamentRoundCountdown tournament={t} /><p className="text-sm text-amber-100">{t.advanceError || (t.matches.some(m => !m.result) ? "Open your battle to play. The next round begins automatically once every battle finishes." : "Round complete. Preparing the next pairings automatically…")}</p></>}
        {!teacher && t.me && t.status === "waiting" && <p className="text-sm text-emerald-200">You're registered. Stay in the lobby for your first pairing.</p>}
        {t.status === "finished" && <p className="text-lg font-black text-amber-200">Tournament complete! {rows.filter(r => r.rank === 1).map(r => r.name).join(" and ")} {rows.filter(r => r.rank === 1).length > 1 ? "share first place" : "takes first place"}.</p>}
      </Card>
      {confirm && <Card className="border-amber-200/30 p-4"><p>{confirm.label}</p><div className="mt-3 flex gap-2"><Button disabled={busy} onClick={() => void act(confirm.action,{entryId:confirm.entryId})}>Confirm</Button><Button disabled={busy} variant="secondary" onClick={() => setConfirm(null)}>Keep it</Button></div></Card>}
      {!teacher && myMatch && <Card className="border-cyan-200/40 p-5"><h3 className="text-lg font-black">Your round {t.round}</h3>
        <p className="my-3">{myMatch.b ? `${names.get(myMatch.a)} vs ${names.get(myMatch.b)}` : "You have a bye this round: 2 points. Wait here for the next pairing."}</p>
        {myMatch.battleId && <Button href={`/student/training/battle?id=${myMatch.battleId}`}>{myMatch.result ? "View battle result" : "Play your battle"}</Button>}
      </Card>}
      {teacher && t.status === "waiting" && <Card className="p-5"><h3 className="text-lg font-black">Add a bot</h3><p className="mt-2 text-sm text-slate-300">Elo controls puzzle solving speed and accuracy. Only you see ratings and bot controls; students see the same player names and presentation for everyone. Elo is an estimated difficulty, not a competitive rating.</p>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); botId.current ??= crypto.randomUUID(); void act("bot",{requestId:botId.current,name:botName,elo}); }}>
          <label className="grow text-sm font-bold">Player name<input className={field} maxLength={60} required value={botName} onChange={e => { setBotName(e.target.value); botId.current=null; }} /></label>
          <label className="text-sm font-bold">Bot Elo<input className={`${field} max-w-32`} type="number" min={200} max={2400} step={1} value={elo} onChange={e => { setElo(Number(e.target.value)); botId.current=null; }} /></label>
          <Button type="submit" disabled={busy || t.entries.length >= 32}>Add player</Button>
        </form>
        <div className="mt-4 space-y-3">{t.entries.filter(e => e.elo != null).map(e => <EloEditor key={e.id} entry={e} disabled={busy} save={value => void act("rating",{entryId:e.id,elo:value})} />)}</div>
      </Card>}
      <Card className="overflow-hidden p-5"><h3 className="text-lg font-black">{t.status === "waiting" ? `Players (${rows.length}/32)` : "Standings"}</h3>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr><th className="p-2">Place</th><th className="p-2">Player</th><th className="p-2">Points</th><th className="p-2">W / D / L</th><th className="p-2">Byes</th>{teacher && <th className="p-2">Teacher controls</th>}</tr></thead>
          <tbody className="divide-y divide-white/10">{rows.map(row => <tr key={row.id} className={row.id===t.me ? "bg-cyan-200/10" : ""}><td className="p-2">{row.rank}</td><td className="p-2 font-bold">{row.name}{row.id===t.me ? " (you)" : ""}</td><td className="p-2 font-black text-amber-200">{row.points}</td><td className="whitespace-nowrap p-2">{row.wins} / {row.draws} / {row.losses}</td><td className="p-2">{row.byes}</td>{teacher && <td className="p-2"><span className="mr-2 text-xs text-slate-400">{row.elo != null ? `Bot · ${row.elo} Elo` : "Student"}</span>{t.status === "waiting" && <button type="button" disabled={busy} className="min-h-10 text-xs text-rose-200 underline" onClick={() => setConfirm({action:"remove",entryId:row.id,label:`Remove ${row.name} from this tournament?`})}>Remove</button>}</td>}</tr>)}</tbody></table></div>
        {!rows.length && <p className="mt-4 text-slate-400">Share the lobby link so students can join{teacher ? ", or add a bot above" : ""}.</p>}
      </Card>
      {t.round > 0 && <Card className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-black">Pairings and results</h3><label className="text-sm">Round<select className={field} value={shownRound ?? t.round} onChange={e => setShownRound(Number(e.target.value))}>{Array.from({length:t.round},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label></div>
        <ul className="divide-y divide-white/10">{roundMatches.map(m => <li key={m.id} className="py-4"><p className="font-bold">{names.get(m.a)}{m.b ? ` vs ${names.get(m.b)}` : " · Bye"}</p><p className="mt-1 text-sm text-slate-300">{m.b ? `${m.scoreA} – ${m.scoreB} · ` : ""}{!m.result ? "In progress" : m.result.reason === "bye" ? "2 tournament points" : m.result.reason === "cancelled" ? "Cancelled" : m.result.winnerEntryId ? `${names.get(m.result.winnerEntryId)} wins` : "Draw"}</p></li>)}</ul>
      </Card>}
    </>}
  </div>;
}
