"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { BOARD_ANNOTATION_COLORS } from "@/chess/components/boardAnnotations";
import { GameDialog } from "@/chess/components/GameDialog";
import { MoveHistory } from "@/chess/components/MoveHistory";
import { PlayerPanel } from "@/chess/components/PlayerPanel";
import { PromotionDialog } from "@/chess/components/PromotionDialog";
import { VictoryCelebration } from "@/chess/components/VictoryCelebration";
import { promotionOptions, tryMove } from "@/chess/game/rules";
import { oppositeColor } from "@/chess/game/config";
import type { LiveGameAction, LiveGameSnapshot } from "@/chess/live/types";
import type { ChessColor, PromotionPiece } from "@/chess/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { getSupabaseClient } from "@/lib/supabase/client";

type GameResponse = { ok: boolean; game?: LiveGameSnapshot; error?: string };
type Confirmation = "cancel" | "resign" | null;

const boardColumnStyle = {
  width: "min(100%, 700px, max(80px, calc(100dvh - 14.25rem)))"
};

function clockValue(game: LiveGameSnapshot, color: ChessColor, nowMs: number, serverOffsetMs: number) {
  const base = color === "white" ? game.clocks.whiteMs : game.clocks.blackMs;
  if (base === null || game.status !== "active" || game.activeColor !== color || !game.clocks.startedAt) return base;
  const serverNow = nowMs - serverOffsetMs;
  const startedAt = new Date(game.clocks.startedAt).getTime();
  return Math.max(0, base - Math.max(0, serverNow - startedAt));
}

function completionText(game: LiveGameSnapshot) {
  if (game.status === "cancelled") return "This challenge was cancelled.";
  if (game.status !== "completed") return "";
  if (game.resultReason === "draw") return "Game drawn by agreement.";
  const reason = game.resultReason?.replaceAll("_", " ") ?? "game over";
  if (!game.winnerColor) return `Draw by ${reason}.`;
  return game.winnerColor === game.viewer.color ? `You won by ${reason}.` : `You lost by ${reason}.`;
}

export function LiveChessGame({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<LiveGameSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [optimisticFen, setOptimisticFen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<"connecting" | "live" | "polling">("connecting");
  const [orientation, setOrientation] = useState<ChessColor>("white");
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [annotationMode, setAnnotationMode] = useState<"arrow" | "circle" | null>(null);
  const [annotationStart, setAnnotationStart] = useState<string | null>(null);
  const [boardArrows, setBoardArrows] = useState<Array<{ startSquare: string; endSquare: string; color: string }>>([]);
  const [boardCircles, setBoardCircles] = useState<Array<{ square: string; color: string }>>([]);
  const claimedVersion = useRef<number | null>(null);
  const claimRetryAt = useRef(0);

  const receiveGame = useCallback((next: LiveGameSnapshot) => {
    setGame(next);
    setServerOffsetMs(Date.now() - new Date(next.serverNow).getTime());
    setError("");
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/student/live-games/${gameId}`, { cache: "no-store" });
      const body = await response.json() as GameResponse;
      if (!response.ok || !body.game) throw new Error(body.error || "Live game could not be loaded.");
      receiveGame(body.game);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Live game could not be loaded.");
      setLoading(false);
    }
  }, [gameId, receiveGame]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!game) return;
    setOrientation((current) => current === "white" && game.viewer.color === "black" ? "black" : current);
  }, [game?.viewer.color]);

  useEffect(() => {
    if (!game?.realtimeTopic || game.status === "cancelled") return;
    const client = getSupabaseClient();
    if (!client) {
      setConnection("polling");
      return;
    }
    setConnection("connecting");
    const channel = client
      .channel(game.realtimeTopic)
      .on("broadcast", { event: "game_changed" }, () => void refresh())
      .subscribe((status) => setConnection(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "polling" : "connecting"));
    return () => {
      void client.removeChannel(channel);
    };
  }, [game?.realtimeTopic, game?.status, refresh]);

  useEffect(() => {
    if (!game || game.status === "completed" || game.status === "cancelled") return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, connection === "live" ? 15_000 : 3_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [connection, game?.status, refresh]);

  useEffect(() => {
    if (!game || game.status !== "active" || game.clocks.whiteMs === null) return;
    let timeout: number;
    const tick = () => {
      const nextNow = Date.now();
      setNowMs(nextNow);
      const remaining = clockValue(game, game.activeColor, nextNow, serverOffsetMs);
      const delay = remaining !== null && remaining < 10_000
        ? 100
        : remaining !== null
          ? Math.max(100, Math.min(1_000, remaining % 1_000 || 1_000))
          : 1_000;
      timeout = window.setTimeout(tick, delay);
    };
    timeout = window.setTimeout(tick, 100);
    return () => window.clearTimeout(timeout);
  }, [game, serverOffsetMs]);

  useEffect(() => {
    setBoardArrows([]);
    setBoardCircles([]);
    setAnnotationStart(null);
    setPendingPromotion(null);
    claimedVersion.current = null;
    claimRetryAt.current = 0;
  }, [game?.fen, game?.version]);

  const displayedClocks = useMemo(() => game ? {
    white: clockValue(game, "white", nowMs, serverOffsetMs),
    black: clockValue(game, "black", nowMs, serverOffsetMs)
  } : { white: null, black: null }, [game, nowMs, serverOffsetMs]);

  const sendAction = useCallback(async (action: LiveGameAction) => {
    if (!game || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/student/live-games/${game.id}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, version: game.version })
      });
      const body = await response.json() as GameResponse;
      if (!response.ok || !body.game) throw new Error(body.error || "Game action failed.");
      receiveGame(body.game);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Game action failed.");
      if (action === "claim_timeout") {
        claimedVersion.current = null;
        claimRetryAt.current = Date.now() + 3_000;
      }
      if (action !== "offer_draw") void refresh();
    } finally {
      setPending(false);
      setConfirmation(null);
    }
  }, [game, pending, receiveGame, refresh]);

  useEffect(() => {
    if (!game || game.status !== "active" || claimedVersion.current === game.version || Date.now() < claimRetryAt.current) return;
    const activeClock = displayedClocks[game.activeColor];
    if (activeClock !== 0) return;
    claimedVersion.current = game.version;
    void sendAction("claim_timeout");
  }, [displayedClocks, game, sendAction]);

  const sendMove = useCallback(async (from: string, to: string, promotion?: PromotionPiece) => {
    if (!game || pending) return;
    const chess = new Chess(game.fen);
    if (!tryMove(chess, { from, to, promotion })) return;
    setOptimisticFen(chess.fen());
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/student/live-games/${game.id}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to, promotion, version: game.version })
      });
      const body = await response.json() as GameResponse;
      if (!response.ok || !body.game) throw new Error(body.error || "Move could not be played.");
      receiveGame(body.game);
      setOptimisticFen(null);
    } catch (caught) {
      setOptimisticFen(null);
      setError(caught instanceof Error ? caught.message : "Move could not be played.");
      await refresh();
    } finally {
      setPending(false);
      setPendingPromotion(null);
    }
  }, [game, pending, receiveGame, refresh]);

  function attemptMove(from: string, to: string) {
    if (!game) return;
    const options = promotionOptions(new Chess(game.fen), from, to);
    if (options.length) {
      setPendingPromotion({ from, to });
      return;
    }
    void sendMove(from, to);
  }

  function toggleCircle(square: string, color = BOARD_ANNOTATION_COLORS.primary) {
    setBoardCircles((current) => current.some((circle) => circle.square === square && circle.color === color)
      ? current.filter((circle) => !(circle.square === square && circle.color === color))
      : [...current.filter((circle) => circle.square !== square), { square, color }]);
  }

  function handleAnnotationSquare(square: string) {
    if (annotationMode === "circle") return toggleCircle(square);
    if (annotationMode !== "arrow") return;
    if (!annotationStart) return setAnnotationStart(square);
    if (annotationStart !== square) {
      setBoardArrows((current) => current.some((arrow) => arrow.startSquare === annotationStart && arrow.endSquare === square)
        ? current.filter((arrow) => !(arrow.startSquare === annotationStart && arrow.endSquare === square))
        : [...current, { startSquare: annotationStart, endSquare: square, color: BOARD_ANNOTATION_COLORS.primary }]);
    }
    setAnnotationStart(null);
  }

  async function copyChallenge() {
    if (!game) return;
    const url = `${window.location.origin}/student/play/live?code=${game.challengeCode}`;
    try {
      if (navigator.share) await navigator.share({ title: "Chess Academy challenge", text: `Join my Chess Academy game: ${game.challengeCode}`, url });
      else await navigator.clipboard.writeText(`${game.challengeCode}\n${url}`);
      setError("");
    } catch {
      await navigator.clipboard.writeText(game.challengeCode).catch(() => undefined);
    }
  }

  if (loading) return <Card className="p-6 text-sm text-slate-300">Connecting to the live game...</Card>;
  if (!game) return <Card className="p-6"><p className="text-rose-100" role="alert">{error || "Live game could not be loaded."}</p><Button href="/student/play/live" variant="secondary" className="mt-4">Back to Live Games</Button></Card>;

  const viewerColor = game.viewer.color;
  const opponentColor = oppositeColor(viewerColor);
  const opponent = game.players[opponentColor];
  const viewer = game.players[viewerColor];
  const lastMove = game.moves.length ? [game.moves[game.moves.length - 1].from, game.moves[game.moves.length - 1].to] as [string, string] : null;
  const interactive = game.status === "active" && game.activeColor === viewerColor && !pending;
  const opponentOfferedDraw = Boolean(game.drawOfferedBy && game.drawOfferedBy !== game.viewer.id);
  const viewerOfferedDraw = game.drawOfferedBy === game.viewer.id;
  const statusText = game.status === "waiting"
    ? "Waiting for your opponent to join. This page will update automatically."
    : game.status === "active"
      ? pending ? "Confirming with the server..." : game.activeColor === viewerColor ? "Your move." : `Waiting for ${opponent?.name ?? "your opponent"}.`
      : completionText(game);

  return (
    <div className="space-y-4">
      {game.status === "completed" && game.winnerColor === viewerColor ? <VictoryCelebration /> : null}
      {game.status === "waiting" ? (
        <Card className="p-5 text-center sm:p-6">
          <p className="text-xs font-black uppercase tracking-wider text-amber-200">Private challenge code</p>
          <p className="mt-3 font-mono text-3xl font-black tracking-[0.18em] text-white sm:text-4xl">{game.challengeCode}</p>
          <p className="mt-3 text-sm text-slate-400">Share this code with one other Chess Academy student.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={() => void copyChallenge()}>Share Challenge</Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmation("cancel")}>Cancel Challenge</Button>
          </div>
        </Card>
      ) : null}

      {error ? <p className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-bold text-rose-100" role="alert">{error}</p> : null}

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,700px)_minmax(300px,1fr)]">
        <div className="mx-auto min-w-0 space-y-3" style={boardColumnStyle}>
          <PlayerPanel name={opponent?.name ?? "Waiting for opponent"} subtitle={`Playing ${opponentColor} · ${game.timeControl.name}`} clockMs={displayedClocks[opponentColor]} active={game.status === "active" && game.activeColor === opponentColor} />
          <div className="aspect-square w-full overflow-hidden rounded-xl border border-cyan-200/20 bg-slate-950/70 p-1 sm:p-2">
            <AcademyChessboard fen={optimisticFen ?? game.fen} orientation={orientation} humanColor={viewerColor} interactive={interactive} lastMove={lastMove} onMove={attemptMove} arrows={boardArrows} circles={boardCircles} allowDrawingArrows annotationMode={annotationMode} onAnnotationSquare={handleAnnotationSquare} onArrowsChange={setBoardArrows} onCircleToggle={toggleCircle} boardId={`live-game-${game.id}`} />
          </div>
          <PlayerPanel name={viewer?.name ?? "You"} subtitle={`You are playing ${viewerColor}`} clockMs={displayedClocks[viewerColor]} active={game.status === "active" && game.activeColor === viewerColor} />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Live game</p>
                <h2 className="mt-1 text-xl font-black text-white">{opponent ? `vs ${opponent.name}` : "Waiting challenge"}</h2>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[11px] font-bold uppercase ${connection === "live" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>{connection === "live" ? "Live" : connection}</span>
            </div>
            <p className="mt-4 rounded-md border border-white/10 bg-white/5 p-3 text-sm font-bold leading-5 text-slate-200" aria-live="polite">{statusText}</p>
            {opponentOfferedDraw ? (
              <div className="mt-3 rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
                <p className="text-sm font-bold text-amber-100">Your opponent offered a draw.</p>
                <div className="mt-3 flex gap-2"><Button type="button" onClick={() => void sendAction("accept_draw")} disabled={pending}>Accept</Button><Button type="button" variant="ghost" onClick={() => void sendAction("decline_draw")} disabled={pending}>Decline</Button></div>
              </div>
            ) : null}
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-black text-white">Moves</h2><span className="text-xs text-slate-500">SAN notation</span></div>
            <MoveHistory moves={game.moves} />
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="font-black text-white">Game controls</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" variant="ghost" onClick={() => setOrientation((value) => oppositeColor(value))}>⇅ Flip Board</Button>
              <Button href="/student/play/live" variant="ghost">Live Games</Button>
              {game.status === "active" ? <Button type="button" variant="ghost" disabled={pending || Boolean(game.drawOfferedBy)} onClick={() => void sendAction("offer_draw")}>{viewerOfferedDraw ? "Draw Offered" : "Offer Draw"}</Button> : null}
              {game.status === "active" ? <Button type="button" variant="ghost" className="border-rose-300/25 text-rose-100" disabled={pending} onClick={() => setConfirmation("resign")}>⚑ Resign</Button> : null}
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-cyan-200">Board drawings</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" aria-pressed={annotationMode === null} variant={annotationMode === null ? "secondary" : "ghost"} onClick={() => { setAnnotationMode(null); setAnnotationStart(null); }}>Move</Button>
                <Button type="button" aria-pressed={annotationMode === "arrow"} variant={annotationMode === "arrow" ? "secondary" : "ghost"} onClick={() => { setAnnotationMode("arrow"); setAnnotationStart(null); }}>Arrow</Button>
                <Button type="button" aria-pressed={annotationMode === "circle"} variant={annotationMode === "circle" ? "secondary" : "ghost"} onClick={() => { setAnnotationMode("circle"); setAnnotationStart(null); }}>Circle</Button>
                <Button type="button" variant="ghost" disabled={!boardArrows.length && !boardCircles.length} onClick={() => { setBoardArrows([]); setBoardCircles([]); }}>Clear</Button>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      {pendingPromotion ? <PromotionDialog color={viewerColor} onChoose={(piece) => void sendMove(pendingPromotion.from, pendingPromotion.to, piece)} onCancel={() => setPendingPromotion(null)} /> : null}
      {confirmation ? <GameDialog title={confirmation === "resign" ? "Resign this live game?" : "Cancel this challenge?"} description={confirmation === "resign" ? "Your opponent will win immediately." : "The private challenge code will stop working."} primaryLabel={confirmation === "resign" ? "Resign" : "Cancel Challenge"} onPrimary={() => void sendAction(confirmation)} secondaryLabel="Keep Playing" onSecondary={() => setConfirmation(null)} /> : null}
    </div>
  );
}
