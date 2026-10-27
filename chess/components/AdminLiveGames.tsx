"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TeacherLiveGameSummary } from "@/chess/live/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { DisplayedBadge } from "@/components/DisplayedBadge";
import { TeacherLiveBoardCard } from "./TeacherLiveBoardCard";
import { teacherPreviewGames } from "@/chess/live/teacherPreviews";
import { getSupabaseClient } from "@/lib/supabase/client";

type ListResponse = { ok?: boolean; games?: TeacherLiveGameSummary[]; error?: string };

export function AdminLiveGames({ initialGames, adminActionToken }: { initialGames: TeacherLiveGameSummary[]; adminActionToken: string }) {
  const [games, setGames] = useState(initialGames);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => teacherPreviewGames(initialGames).map(game => game.id));
  const preferredIds = useRef(selectedIds);
  const request = useRef<AbortController | null>(null);
  const queued = useRef(false);
  const [liveTopics, setLiveTopics] = useState<string[]>([]);
  const previews = teacherPreviewGames(games, selectedIds);
  const topicKey = previews.map(game => game.preview?.realtimeTopic ?? "").filter(Boolean).sort().join("|");
  const remainingGames = games.filter(game => !previews.some(preview => preview.id === game.id));
  const pollMs = previews.some(game => !game.preview?.realtimeTopic || !liveTopics.includes(game.preview.realtimeTopic)) ? 5_000 : 10_000;

  const refresh = useCallback(async function load(showProgress = false, queueIfBusy = false): Promise<void> {
    if (document.visibilityState !== "visible") return;
    if (request.current) { queued.current ||= queueIfBusy; return; }
    const controller = new AbortController();
    request.current = controller;
    if (showProgress) setRefreshing(true);
    try {
      const watch = preferredIds.current.join(",");
      const response = await fetch(`/api/admin/live-games${watch ? `?watch=${encodeURIComponent(watch)}` : ""}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "x-admin-action-token": adminActionToken },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])
      });
      const body = await response.json() as ListResponse;
      if (controller.signal.aborted) return;
      if (response.status === 401) setGames([]);
      if (!response.ok || !body.games) throw new Error(body.error || "Live games could not be loaded.");
      preferredIds.current = teacherPreviewGames(body.games, preferredIds.current).map(game => game.id);
      setSelectedIds(preferredIds.current);
      setGames(body.games);
      setMessage("");
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Live games could not be loaded.");
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (!controller.signal.aborted) setRefreshing(false);
        const again = queued.current && !controller.signal.aborted;
        queued.current = false;
        if (again) void load();
      }
    }
  }, [adminActionToken]);

  const chooseGame = (slot: number, id: string) => {
    if (!games.some(game => game.id === id)) return;
    const next = previews.map(game => game.id);
    if (next[slot] === id) return;
    const otherSlot = next.indexOf(id);
    if (otherSlot !== -1) next[otherSlot] = next[slot];
    next[slot] = id;
    preferredIds.current = next;
    setSelectedIds(next);
    void refresh(true, true);
  };

  useEffect(() => {
    return () => { request.current?.abort(); request.current = null; queued.current = false; };
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, pollMs);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh, pollMs]);

  useEffect(() => {
    setLiveTopics([]);
    const client = getSupabaseClient();
    if (!client || !topicKey) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (document.visibilityState !== "visible" || timer) return;
      timer = setTimeout(() => { timer = undefined; if (!disposed) void refresh(false, true); }, 150);
    };
    const channels = topicKey.split("|").map(topic => client.channel(topic)
      .on("broadcast", { event: "game_changed" }, schedule)
      .subscribe(status => {
        if (disposed) return;
        setLiveTopics(current => status === "SUBSCRIBED" ? [...new Set([...current, topic])] : current.filter(item => item !== topic));
        if (status === "SUBSCRIBED") schedule();
      }));
    return () => { disposed = true; clearTimeout(timer); channels.forEach(channel => { void client.removeChannel(channel); }); };
  }, [topicKey, refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-300" aria-live="polite">{games.length} game{games.length === 1 ? "" : "s"} currently in progress</p>
        <Button type="button" variant="ghost" disabled={refreshing} onClick={() => void refresh(true)}>{refreshing ? "Refreshing..." : "Refresh"}</Button>
      </div>
      {message ? <p className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-bold text-rose-100" role="alert">{message}</p> : null}
      {games.length ? (
        <>
        <section aria-label="Live board previews" className="space-y-3">
          <div><h2 className="text-lg font-black text-white">Watch together</h2><p className="text-sm text-slate-400">Choose a game for each board. Choosing a game already on screen swaps boards. When a game ends, the next game fills its spot.</p></div>
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {previews.map((game, index) => <TeacherLiveBoardCard key={index} game={game} slot={index + 1} games={games} onChoose={id => chooseGame(index, id)} loading={refreshing} />)}
          </div>
        </section>
        {remainingGames.length > 0 && <h2 className="pt-3 text-lg font-black text-white">More live games</h2>}
        <div className="grid gap-4 lg:grid-cols-2">
          {remainingGames.map((game) => (
            <Card key={game.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wider text-cyan-200">{game.computerPractice ? "Computer practice" : game.matchmaking ? "Academy match" : "Private challenge"} · {game.rated ? "Rated" : "Casual"}</p>
                  <h2 className="mt-2 flex flex-wrap items-center gap-2 text-xl font-black text-white"><span className="truncate">{game.players.white.name}</span><DisplayedBadge badge={game.players.white.displayedBadge} studentId={game.players.white.id} /><span className="text-slate-400">vs</span><span className="truncate">{game.players.black.name}</span><DisplayedBadge badge={game.players.black.displayedBadge} studentId={game.players.black.id} /></h2>
                  <p className="mt-2 text-sm font-bold text-slate-300"><span className="text-slate-500">White:</span> {game.players.white.name}</p>
                  <p className="mt-1 text-sm font-bold text-slate-300"><span className="text-slate-500">Black:</span> {game.players.black.name}</p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-300/35 bg-emerald-300/10 px-2 py-1 text-[11px] font-black uppercase text-emerald-100">Live</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <p className="text-xs font-bold text-slate-400">{game.timeControl.name} · {game.moveCount} move{game.moveCount === 1 ? "" : "s"} · {game.players[game.activeColor].name} to move</p>
                <Button href={`/admin/live-games/${game.id}`}>Watch Game</Button>
              </div>
            </Card>
          ))}
        </div>
        </>
      ) : <EmptyState title="No games in progress" message="Students playing each other or a computer opponent will appear here automatically." />}
    </div>
  );
}
