"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useCorrespondence } from "@/components/correspondence/CorrespondenceProvider";
import { formatCorrespondenceTimeLeft, type CorrespondenceChallenge, type CorrespondenceGameSummary } from "@/lib/correspondence/clientTypes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function ChallengeCard({ challenge, incoming, pending, onAction }: {
  challenge: CorrespondenceChallenge;
  incoming: boolean;
  pending: boolean;
  onAction: (action: "accept" | "reject" | "cancel") => void;
}) {
  const other = incoming ? challenge.challenger : challenge.recipient;
  const profileHref = other.slug ? `/student/students/${encodeURIComponent(other.slug)}` : null;
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {profileHref ? <Link href={profileHref} className="font-black text-white hover:text-cyan-100 hover:underline">{other.name}</Link> : <p className="font-black text-white">{other.name}</p>}
          <p className="mt-1 text-sm text-slate-400">{incoming ? "Invited you to play" : "Waiting for their response"}</p>
        </div>
        <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-2 py-1 text-[11px] font-black uppercase text-amber-100">Pending</span>
      </div>
          <p className="mt-3 text-xs text-slate-500">Random colors · 3 days per move</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {incoming ? (
          <>
            <Button type="button" disabled={pending} onClick={() => onAction("accept")}>Accept</Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => onAction("reject")}>Reject</Button>
          </>
        ) : <Button type="button" variant="ghost" disabled={pending} onClick={() => onAction("cancel")}>Cancel challenge</Button>}
      </div>
    </article>
  );
}

function GameCard({ game, nowMs }: { game: CorrespondenceGameSummary; nowMs: number }) {
  const yourMove = game.activeColor === game.viewerColor;
  return (
    <Link href={`/student/play/correspondence/${game.id}`} className={`block rounded-lg border p-4 transition ${yourMove ? "border-amber-200/35 bg-amber-200/10 hover:bg-amber-200/15" : "border-white/10 bg-white/[0.04] hover:border-cyan-200/25 hover:bg-white/[0.07]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-white">vs {game.opponent?.name ?? "Academy student"}</p>
          <p className={`mt-1 text-sm font-bold ${yourMove ? "text-amber-100" : "text-slate-400"}`}>{yourMove ? "Your move" : "Waiting for opponent"}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${yourMove ? "border-amber-200/35 bg-amber-200/10 text-amber-100" : "border-cyan-200/25 bg-cyan-200/10 text-cyan-100"}`}>
          {formatCorrespondenceTimeLeft(game.turnDeadlineAt, nowMs)}
        </span>
      </div>
      <p className="mt-3 text-xs capitalize text-slate-500">{game.viewerColor} · {yourMove ? "Ready to move" : "Position available to review"}</p>
    </Link>
  );
}

export function CorrespondenceHub() {
  const router = useRouter();
  const { inbox, loading, error, pendingKey, refresh, actOnChallenge } = useCorrespondence();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const incoming = useMemo(() => inbox.incoming.filter((challenge) => challenge.status === "pending"), [inbox.incoming]);
  const outgoing = useMemo(() => inbox.outgoing.filter((challenge) => challenge.status === "pending"), [inbox.outgoing]);
  const yourMove = useMemo(() => inbox.activeGames.filter((game) => game.activeColor === game.viewerColor), [inbox.activeGames]);
  const waiting = useMemo(() => inbox.activeGames.filter((game) => game.activeColor !== game.viewerColor), [inbox.activeGames]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  function handleAction(challengeId: string, action: "accept" | "reject" | "cancel") {
    void actOnChallenge(challengeId, action).then((gameId) => {
      if (action === "accept" && gameId) router.push(`/student/play/correspondence/${gameId}`);
    });
  }

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" aria-label="Correspondence summary">
            <span className="rounded-lg border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-sm font-bold text-amber-100"><strong className="mr-1 text-lg">{yourMove.length}</strong> to move</span>
            <span className="rounded-lg border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm font-bold text-cyan-100"><strong className="mr-1 text-lg">{waiting.length}</strong> waiting</span>
            <span className="rounded-lg border border-white/10 bg-white/[.035] px-3 py-2 text-sm font-bold text-slate-200"><strong className="mr-1 text-lg text-white">{incoming.length}</strong> invites</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href="/student/leaderboard">New Challenge</Button>
            <Button type="button" variant="ghost" disabled={loading} onClick={() => void refresh()}>Refresh</Button>
          </div>
        </div>
      </Card>

      {error ? <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-4 text-sm font-bold text-rose-100" role="alert">{error}</p> : null}
      {loading && !inbox.activeGames.length ? <Card className="p-5 text-sm text-slate-400">Loading your correspondence games...</Card> : null}

      <section aria-labelledby="your-move-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="your-move-title" className="text-xl font-black text-white">Your move</h2>
          <span className="text-sm font-bold text-slate-500">{yourMove.length} game{yourMove.length === 1 ? "" : "s"}</span>
        </div>
        {yourMove.length ? <div className="grid gap-3 md:grid-cols-2">{yourMove.map((game) => <GameCard key={game.id} game={game} nowMs={nowMs} />)}</div> : (
          <Card className="border-dashed p-5 text-sm text-slate-400">You are caught up. Games that need your move will appear here.</Card>
        )}
      </section>

      <section aria-labelledby="waiting-games-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="waiting-games-title" className="text-xl font-black text-white">Waiting for your opponent</h2>
          <span className="text-sm font-bold text-slate-500">{waiting.length} game{waiting.length === 1 ? "" : "s"}</span>
        </div>
        {waiting.length ? <div className="grid gap-3 md:grid-cols-2">{waiting.map((game) => <GameCard key={game.id} game={game} nowMs={nowMs} />)}</div> : (
          <Card className="border-dashed p-5 text-sm text-slate-400">No games are waiting on an opponent.</Card>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="incoming-hub-title">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 id="incoming-hub-title" className="text-xl font-black text-white">Incoming challenges</h2><span className="text-sm font-bold text-slate-500">{incoming.length}</span></div>
          <div className="grid gap-3">
            {incoming.length ? incoming.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} incoming pending={pendingKey?.startsWith(`${challenge.id}:`) ?? false} onAction={(action) => handleAction(challenge.id, action)} />) : <Card className="border-dashed p-5 text-sm text-slate-400">No challenges are waiting for your answer.</Card>}
          </div>
        </section>
        <section aria-labelledby="outgoing-hub-title">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 id="outgoing-hub-title" className="text-xl font-black text-white">Sent challenges</h2><span className="text-sm font-bold text-slate-500">{outgoing.length} / 5</span></div>
          <div className="grid gap-3">
            {outgoing.length ? outgoing.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} incoming={false} pending={pendingKey?.startsWith(`${challenge.id}:`) ?? false} onAction={(action) => handleAction(challenge.id, action)} />) : <Card className="border-dashed p-5 text-sm text-slate-400">You have no unanswered sent challenges.</Card>}
          </div>
        </section>
      </div>
    </div>
  );
}
