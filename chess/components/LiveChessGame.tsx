"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { BoardCaptureParticles } from "@/chess/components/BoardCaptureParticles";
import { BoardSoundSettings } from "@/chess/components/BoardSoundSettings";
import { BOARD_ANNOTATION_COLORS } from "@/chess/components/boardAnnotations";
import { GameDialog } from "@/chess/components/GameDialog";
import { MoveHistory } from "@/chess/components/MoveHistory";
import { PlayerPanel } from "@/chess/components/PlayerPanel";
import { PromotionDialog } from "@/chess/components/PromotionDialog";
import { VictoryCelebration } from "@/chess/components/VictoryCelebration";
import { promotionOptions, tryMove } from "@/chess/game/rules";
import { oppositeColor } from "@/chess/game/colors";
import { materialAdvantageForColor, whiteMaterialAdvantage } from "@/chess/game/material";
import { crossedOneMinuteWarning } from "@/chess/game/clockWarning";
import { useLiveGameSounds } from "@/chess/hooks/useLiveGameSounds";
import { canPlayPremove, isPremovePromotion, type LivePremove } from "@/chess/live/premove";
import { hasCoachPresence, type RealtimePresenceState } from "@/chess/live/presence";
import type { LiveGameAction, LiveGameSnapshot } from "@/chess/live/types";
import type { ChessColor, PromotionPiece } from "@/chess/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useOptionalCorrespondence } from "@/components/correspondence/CorrespondenceProvider";
import { formatCorrespondenceTimeLeft, nextCorrespondenceGameToMove } from "@/lib/correspondence/clientTypes";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type GameResponse = { ok: boolean; game?: LiveGameSnapshot; error?: string };
type Confirmation = "cancel" | "resign" | null;
type RematchDecision = "request" | "accept" | "decline";
type RematchResponse = { ok: boolean; rematch?: { status: "waiting" | "matched" | "declined"; gameId: string | null; source: LiveGameSnapshot }; error?: string };

const boardColumnStyle = {
  width: "min(100%, 700px, max(220px, calc(100svh - 25rem)))"
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
  if (!game.resultReason) {
    if (!game.winnerColor) return "Good Game.";
    return game.winnerColor === game.viewer.color ? "You won. Good Game." : "You lost. Good Game.";
  }
  const reason = game.resultReason.replaceAll("_", " ");
  if (!game.winnerColor) return `Draw by ${reason}.`;
  return game.winnerColor === game.viewer.color ? `You won by ${reason}.` : `You lost by ${reason}.`;
}

export function LiveChessGame({ gameId, mode = "live" }: { gameId: string; mode?: "live" | "correspondence" }) {
  const router = useRouter();
  const correspondence = useOptionalCorrespondence();
  const refreshCorrespondence = correspondence?.refresh;
  const [game, setGame] = useState<LiveGameSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [optimisticFen, setOptimisticFen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<"connecting" | "live" | "polling">("connecting");
  const [coachSpectating, setCoachSpectating] = useState(false);
  const [orientation, setOrientation] = useState<ChessColor>("white");
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);
  const [challengeAgainSent, setChallengeAgainSent] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; mode: "move" | "premove" } | null>(null);
  const [premove, setPremove] = useState<LivePremove | null>(null);
  const [pendingMoveAtMs, setPendingMoveAtMs] = useState<number | null>(null);
  const [annotationMode, setAnnotationMode] = useState<"arrow" | "circle" | null>(null);
  const [annotationStart, setAnnotationStart] = useState<string | null>(null);
  const [boardArrows, setBoardArrows] = useState<Array<{ startSquare: string; endSquare: string; color: string }>>([]);
  const [boardCircles, setBoardCircles] = useState<Array<{ square: string; color: string }>>([]);
  const claimedVersion = useRef<number | null>(null);
  const claimRetryAt = useRef(0);
  const announcedCompletedGame = useRef<string | null>(null);
  const awaitingRematchResponse = useRef(false);
  const previousViewerClockRef = useRef<{ gameId: string; milliseconds: number | null } | null>(null);
  const { muted, toggleMuted, receiveGameSnapshot, playClockWarning, captureEffect } = useLiveGameSounds();
  const isCorrespondence = mode === "correspondence" || game?.gameMode === "correspondence";

  const receiveGame = useCallback((next: LiveGameSnapshot) => {
    if (next.gameMode !== mode) {
      setGame(null);
      setError(`Open this game from ${next.gameMode === "correspondence" ? "Correspondence" : "Live Games"}.`);
      setLoading(false);
      return;
    }
    receiveGameSnapshot({ id: next.id, status: next.status, moves: next.moves });
    setGame(next);
    setServerOffsetMs(Date.now() - new Date(next.serverNow).getTime());
    setError("");
    setLoading(false);
  }, [mode, receiveGameSnapshot]);

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
      .on("presence", { event: "sync" }, () => {
        setCoachSpectating(hasCoachPresence(channel.presenceState() as RealtimePresenceState));
      })
      .subscribe((status) => setConnection(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "polling" : "connecting"));
    return () => {
      setCoachSpectating(false);
      void client.removeChannel(channel);
    };
  }, [game?.realtimeTopic, game?.status, refresh]);

  useEffect(() => {
    if (!game || game.status === "cancelled") return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, isCorrespondence ? 30_000 : connection === "live" ? 15_000 : 3_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [connection, game?.status, isCorrespondence, refresh]);

  useEffect(() => {
    if (!game || game.status !== "completed" || announcedCompletedGame.current === game.id) return;
    announcedCompletedGame.current = game.id;
    setResultOpen(true);
  }, [game]);

  useEffect(() => {
    if (!game || game.status !== "active" || (game.clocks.whiteMs === null && !isCorrespondence)) return;
    let timeout: number;
    const tick = () => {
      const nextNow = Date.now();
      setNowMs(nextNow);
      const remaining = isCorrespondence && game.turnDeadlineAt
        ? Math.max(0, new Date(game.turnDeadlineAt).getTime() - (nextNow - serverOffsetMs))
        : clockValue(game, game.activeColor, nextNow, serverOffsetMs);
      const delay = isCorrespondence && remaining !== null
        ? remaining < 60_000 ? 1_000 : Math.max(1_000, Math.min(30_000, remaining % 30_000 || 30_000))
        : remaining !== null && remaining < 10_000
        ? 100
        : remaining !== null
          ? Math.max(100, Math.min(1_000, remaining % 1_000 || 1_000))
          : 1_000;
      timeout = window.setTimeout(tick, delay);
    };
    timeout = window.setTimeout(tick, 100);
    return () => window.clearTimeout(timeout);
  }, [game, isCorrespondence, serverOffsetMs]);

  useEffect(() => {
    if (!isCorrespondence || game?.status !== "active" || !game.turnDeadlineAt) return;
    const remaining = new Date(game.turnDeadlineAt).getTime() - (Date.now() - serverOffsetMs);
    if (remaining <= 0) {
      void refresh();
      return;
    }
    const timeout = window.setTimeout(() => void refresh(), Math.min(remaining + 250, 2_147_000_000));
    return () => window.clearTimeout(timeout);
  }, [game?.status, game?.turnDeadlineAt, isCorrespondence, refresh, serverOffsetMs]);

  useEffect(() => {
    setBoardArrows([]);
    setBoardCircles([]);
    setAnnotationStart(null);
    setPendingPromotion(null);
    claimedVersion.current = null;
    claimRetryAt.current = 0;
  }, [gameId, game?.fen, game?.version]);

  useEffect(() => {
    if (game?.status === "active") return;
    setPremove(null);
  }, [game?.status]);

  useEffect(() => {
    if (!game || isCorrespondence) return;
    if (game.rematchGameId) {
      awaitingRematchResponse.current = false;
      router.push(`/student/play/live/${game.rematchGameId}`);
      return;
    }
    if (game.rematchRequestedBy === game.viewer.id) {
      awaitingRematchResponse.current = true;
      return;
    }
    if (awaitingRematchResponse.current && !game.rematchRequestedBy) {
      awaitingRematchResponse.current = false;
      setResultOpen(false);
      router.replace("/student/play");
    }
  }, [game, isCorrespondence, router]);

  const clockNowMs = pendingMoveAtMs ?? nowMs;
  const displayedClocks = useMemo(() => game ? {
    white: clockValue(game, "white", clockNowMs, serverOffsetMs),
    black: clockValue(game, "black", clockNowMs, serverOffsetMs)
  } : { white: null, black: null }, [clockNowMs, game, serverOffsetMs]);
  const correspondenceDeadlineText = isCorrespondence
    ? formatCorrespondenceTimeLeft(game?.turnDeadlineAt ?? null, nowMs - serverOffsetMs)
    : "";
  const materialBalance = useMemo(
    () => game ? whiteMaterialAdvantage(optimisticFen ?? game.fen) : 0,
    [game, optimisticFen]
  );

  useEffect(() => {
    if (!game) return;
    const current = displayedClocks[game.viewer.color];
    const previous = previousViewerClockRef.current;
    if (previous?.gameId === game.id
      && game.status === "active"
      && game.activeColor === game.viewer.color
      && crossedOneMinuteWarning(previous.milliseconds, current)) playClockWarning();
    previousViewerClockRef.current = { gameId: game.id, milliseconds: current };
  }, [displayedClocks, game, playClockWarning]);

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
    setPendingMoveAtMs(Date.now());
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
      if (isCorrespondence && body.game.status === "active") {
        const refreshedInbox = await refreshCorrespondence?.({ notify: false });
        const nextGame = refreshedInbox
          ? nextCorrespondenceGameToMove(refreshedInbox.activeGames, body.game.id)
          : null;
        if (nextGame) router.replace(`/student/play/correspondence/${nextGame.id}`);
      }
    } catch (caught) {
      setOptimisticFen(null);
      setError(caught instanceof Error ? caught.message : "Move could not be played.");
      await refresh();
    } finally {
      setPending(false);
      setPendingMoveAtMs(null);
      setPendingPromotion(null);
    }
  }, [game, isCorrespondence, pending, receiveGame, refresh, refreshCorrespondence, router]);

  useEffect(() => {
    if (!game || !premove || pending || game.status !== "active" || game.activeColor !== game.viewer.color) return;
    const queued = premove;
    setPremove(null);
    if (!canPlayPremove(game.fen, queued)) {
      setError("That premove is no longer legal after your opponent's reply.");
      return;
    }
    void sendMove(queued.from, queued.to, queued.promotion);
  }, [game, pending, premove, sendMove]);

  function attemptMove(from: string, to: string) {
    if (!game) return;
    if (!isCorrespondence && game.status === "active" && game.activeColor !== game.viewer.color) {
      if (isPremovePromotion(new Chess(game.fen), game.viewer.color, from, to)) {
        setPendingPromotion({ from, to, mode: "premove" });
      } else {
        setPremove({ from, to });
      }
      return;
    }
    const options = promotionOptions(new Chess(game.fen), from, to);
    if (options.length) {
      setPendingPromotion({ from, to, mode: "move" });
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

  function clearBoardAnnotations() {
    setBoardArrows((current) => current.length ? [] : current);
    setBoardCircles((current) => current.length ? [] : current);
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

  async function submitRematchDecision(decision: RematchDecision) {
    if (!game || rematchPending) return;
    setRematchPending(true); setError("");
    if (isCorrespondence) {
      const otherColor = oppositeColor(game.viewer.color);
      const opponent = game.players[otherColor];
      if (!opponent || !correspondence) {
        setError("This student could not be challenged right now.");
        setRematchPending(false);
        return;
      }
      const sent = await correspondence.sendChallenge(opponent.id, opponent.name);
      setChallengeAgainSent(sent);
      setRematchPending(false);
      return;
    }
    if (decision === "request") awaitingRematchResponse.current = true;
    try {
      const response = await fetch(`/api/student/live-games/${game.id}/rematch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, version: game.version })
      });
      const body = await response.json() as RematchResponse;
      if (!response.ok || !body.rematch) throw new Error(body.error || "The rematch decision could not be saved.");
      receiveGame(body.rematch.source);
      if (decision === "decline" || body.rematch.status === "declined") {
        awaitingRematchResponse.current = false;
        setResultOpen(false);
        router.push("/student/play");
        return;
      }
      if (body.rematch.gameId) {
        awaitingRematchResponse.current = false;
        setResultOpen(false);
        router.push(`/student/play/live/${body.rematch.gameId}`);
      }
    } catch (caught) {
      if (decision === "request") awaitingRematchResponse.current = false;
      setError(caught instanceof Error ? caught.message : "The rematch decision could not be saved.");
    }
    finally { setRematchPending(false); }
  }

  function requestRematch() {
    void submitRematchDecision(opponentRequestedRematch ? "accept" : "request");
  }

  function declineRematch() {
    void submitRematchDecision("decline");
  }

  if (loading) return <Card className="p-6 text-sm text-slate-300">{isCorrespondence ? "Opening your correspondence board..." : "Connecting to the live game..."}</Card>;
  if (!game) return <Card className="p-6"><p className="text-rose-100" role="alert">{error || `${isCorrespondence ? "Correspondence" : "Live"} game could not be loaded.`}</p><Button href={isCorrespondence ? "/student/play/correspondence" : "/student/play/live"} variant="secondary" className="mt-4">Back to {isCorrespondence ? "Correspondence" : "Live Games"}</Button></Card>;

  const viewerColor = game.viewer.color;
  const opponentColor = oppositeColor(viewerColor);
  const opponent = game.players[opponentColor];
  const viewer = game.players[viewerColor];
  const lastMove = game.moves.length ? [game.moves[game.moves.length - 1].from, game.moves[game.moves.length - 1].to] as [string, string] : null;
  const canQueuePremove = !isCorrespondence && game.status === "active" && game.activeColor !== viewerColor && !pending;
  const interactive = game.status === "active" && !pending && (game.activeColor === viewerColor || canQueuePremove);
  const opponentOfferedDraw = Boolean(game.drawOfferedBy && game.drawOfferedBy !== game.viewer.id);
  const viewerOfferedDraw = game.drawOfferedBy === game.viewer.id;
  const viewerRequestedRematch = game.rematchRequestedBy === game.viewer.id;
  const opponentRequestedRematch = Boolean(game.rematchRequestedBy && !viewerRequestedRematch);
  const rematchLabel = isCorrespondence
    ? challengeAgainSent ? "Challenge Sent" : rematchPending ? "Sending..." : "Challenge Again"
    : rematchPending
    ? "Requesting..."
    : viewerRequestedRematch
      ? "Waiting for Opponent"
      : opponentRequestedRematch
        ? "Accept Rematch"
        : "Request Rematch";
  const statusText = game.status === "waiting"
    ? "Waiting for your opponent to join. This page will update automatically."
    : game.status === "active"
      ? pending ? "Move sent. Your clock is paused while the server confirms." : game.activeColor === viewerColor ? "Your move." : premove ? "Premove queued. It will play after your opponent moves." : `Waiting for ${opponent?.name ?? "your opponent"}. You can queue a premove.`
      : completionText(game);

  return (
    <div className="space-y-4">
      {game.status === "completed" && game.winnerColor === viewerColor ? <VictoryCelebration /> : null}
      {game.status === "waiting" && !isCorrespondence ? (
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

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,700px)_minmax(300px,1fr)] xl:gap-x-16">
        <div className="mx-auto min-w-0 space-y-2" style={boardColumnStyle}>
          <PlayerPanel name={opponent?.name ?? "Waiting for opponent"} subtitle={`Playing ${opponentColor} · ${isCorrespondence ? "3 days per move" : game.timeControl.name}`} clockMs={displayedClocks[opponentColor]} active={game.status === "active" && game.activeColor === opponentColor} avatar={opponent?.avatar} avatarItems={game.avatarItems} materialAdvantage={materialAdvantageForColor(materialBalance, opponentColor)} />
          <div className="relative">
            <div className="mb-2 flex justify-end sm:absolute sm:left-[calc(100%+0.5rem)] sm:top-0 sm:z-30 sm:mb-0"><BoardSoundSettings muted={muted} onToggleMuted={toggleMuted} /></div>
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-cyan-200/20 bg-slate-950/70 p-1 sm:p-2">
              <AcademyChessboard fen={optimisticFen ?? game.fen} orientation={orientation} humanColor={viewerColor} interactive={interactive} lastMove={lastMove} onMove={attemptMove} allowPremoves={canQueuePremove} premove={premove ? [premove.from, premove.to] : null} arrows={boardArrows} circles={boardCircles} allowDrawingArrows annotationMode={annotationMode} onAnnotationSquare={handleAnnotationSquare} onArrowsChange={setBoardArrows} onCircleToggle={toggleCircle} onClearAnnotations={clearBoardAnnotations} boardId={`live-game-${game.id}`} />
              <BoardCaptureParticles effect={captureEffect} orientation={orientation} />
            </div>
          </div>
          <PlayerPanel name={viewer?.name ?? "You"} subtitle={`You are playing ${viewerColor}${isCorrespondence ? " · 3 days per move" : ""}`} clockMs={displayedClocks[viewerColor]} active={game.status === "active" && game.activeColor === viewerColor} avatar={viewer?.avatar} avatarItems={game.avatarItems} materialAdvantage={materialAdvantageForColor(materialBalance, viewerColor)} />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-cyan-200">{isCorrespondence ? "Correspondence game" : "Live game"}</p>
                <h2 className="mt-1 text-xl font-black text-white">{opponent ? `vs ${opponent.name}` : "Waiting challenge"}</h2>
                <p className="mt-1 text-xs font-bold text-slate-400">{isCorrespondence ? "Casual · random colors · 3 days per move" : `${game.matchmaking ? "Academy match" : "Private challenge"} · ${game.timeControl.name}`}</p>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[11px] font-bold uppercase ${connection === "live" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>{connection === "live" ? (isCorrespondence ? "Synced" : "Live") : connection}</span>
            </div>
            <p className="mt-4 rounded-md border border-white/10 bg-white/5 p-3 text-sm font-bold leading-5 text-slate-200" aria-live="polite">{statusText}</p>
            {premove ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-fuchsia-300/30 bg-fuchsia-300/10 p-3 text-sm font-bold text-fuchsia-100">
                <span>Premove: {premove.from} → {premove.to}</span>
                <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setPremove(null)}>Cancel</Button>
              </div>
            ) : null}
            {isCorrespondence && game.status === "active" ? (
              <div className={`mt-3 rounded-md border p-3 ${game.activeColor === viewerColor ? "border-amber-200/30 bg-amber-200/10" : "border-cyan-200/25 bg-cyan-200/10"}`}>
                <p className={`text-xs font-black uppercase tracking-wider ${game.activeColor === viewerColor ? "text-amber-100" : "text-cyan-100"}`}>{game.activeColor === viewerColor ? "Time for your move" : `${opponent?.name ?? "Opponent"}'s time`}</p>
                <p className="mt-1 text-xl font-black text-white" aria-live="polite">{correspondenceDeadlineText}</p>
              </div>
            ) : null}
            {game.status === "active" && coachSpectating ? (
              <p className="mt-3 flex items-center gap-2 rounded-md border border-cyan-200/25 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100" aria-live="polite">
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" aria-hidden="true" />
                Coach is spectating
              </p>
            ) : null}
            {game.status === "completed" && game.arenaTournamentId ? (
              <div className="mt-3 rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-200">Arena game complete</p>
                <p className="mt-1 text-sm font-bold text-emerald-50">Your score is saved. Arena matchmaking continues when another player is available.</p>
                <Button href="/student/tournaments" className="mt-3 w-full">Return to Arena</Button>
              </div>
            ) : game.status === "completed" ? (
              <div className="mt-3 rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
                <p className="text-xs font-black uppercase tracking-wider text-amber-200">Play again</p>
                <p className="mt-1 text-sm font-bold text-amber-50">
                  {isCorrespondence
                    ? challengeAgainSent ? "Your new challenge has been sent." : "Invite the same student to a fresh correspondence game with random colors."
                    : viewerRequestedRematch ? "Your opponent has been invited. This game will open automatically when they accept." : opponentRequestedRematch ? "Your opponent wants a rematch." : "Challenge the same opponent to another game with colors swapped."}
                </p>
                {opponentRequestedRematch && !isCorrespondence ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button type="button" variant="ghost" disabled={rematchPending} onClick={declineRematch}>Decline</Button>
                    <Button type="button" disabled={rematchPending} onClick={requestRematch}>{rematchLabel}</Button>
                  </div>
                ) : (
                  <Button type="button" className="mt-3 w-full" disabled={rematchPending || viewerRequestedRematch || challengeAgainSent} onClick={requestRematch}>{rematchLabel}</Button>
                )}
              </div>
            ) : null}
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
              <Button href={game.arenaTournamentId ? "/student/tournaments" : isCorrespondence ? "/student/play/correspondence" : "/student/play/live"} variant="ghost">{game.arenaTournamentId ? "Arena" : isCorrespondence ? "Correspondence" : "Live Games"}</Button>
              {game.status === "active" ? <Button type="button" variant="ghost" disabled={pending || Boolean(game.drawOfferedBy)} onClick={() => void sendAction("offer_draw")}>{viewerOfferedDraw ? "Draw Offered" : "Offer Draw"}</Button> : null}
              {game.status === "active" ? <Button type="button" variant="ghost" className="border-rose-300/25 text-rose-100" disabled={pending} onClick={() => setConfirmation("resign")}>⚑ Resign</Button> : null}
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-cyan-200">Board drawings</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" aria-pressed={annotationMode === null} variant={annotationMode === null ? "secondary" : "ghost"} onClick={() => { setAnnotationMode(null); setAnnotationStart(null); }}>Move</Button>
                <Button type="button" aria-pressed={annotationMode === "arrow"} variant={annotationMode === "arrow" ? "secondary" : "ghost"} onClick={() => { setAnnotationMode("arrow"); setAnnotationStart(null); }}>Arrow</Button>
                <Button type="button" aria-pressed={annotationMode === "circle"} variant={annotationMode === "circle" ? "secondary" : "ghost"} onClick={() => { setAnnotationMode("circle"); setAnnotationStart(null); }}>Circle</Button>
                <Button type="button" variant="ghost" disabled={!boardArrows.length && !boardCircles.length} onClick={clearBoardAnnotations}>Clear</Button>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      {pendingPromotion ? <PromotionDialog color={viewerColor} onChoose={(piece) => {
        if (pendingPromotion.mode === "premove") {
          setPremove({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece });
          setPendingPromotion(null);
          return;
        }
        void sendMove(pendingPromotion.from, pendingPromotion.to, piece);
      }} onCancel={() => setPendingPromotion(null)} /> : null}
      {confirmation ? <GameDialog title={confirmation === "resign" ? `Resign this ${isCorrespondence ? "correspondence" : "live"} game?` : "Cancel this challenge?"} description={confirmation === "resign" ? "Your opponent will win immediately." : "The private challenge code will stop working."} primaryLabel={confirmation === "resign" ? "Resign" : "Cancel Challenge"} onPrimary={() => void sendAction(confirmation)} secondaryLabel="Keep Playing" onSecondary={() => setConfirmation(null)} /> : null}
      {resultOpen && game.status === "completed" && game.arenaTournamentId ? (
        <GameDialog
          title="Arena Game Complete"
          description={completionText(game)}
          primaryLabel="Return to Arena"
          onPrimary={() => router.push("/student/tournaments")}
          secondaryLabel="Close"
          onSecondary={() => setResultOpen(false)}
        >
          <Button className="mt-4 w-full" href={`/student/play/game/${encodeURIComponent(game.id)}/analysis`}>Review my three key moments</Button>
          <p className="mt-3 text-sm font-bold text-slate-300">Your result has been added to the standings. You will be paired again when another Arena player is ready.</p>
        </GameDialog>
      ) : resultOpen && game.status === "completed" ? (
        <GameDialog
          title="Good Game"
          description={completionText(game)}
          primaryLabel={rematchLabel}
          primaryDisabled={rematchPending || viewerRequestedRematch || challengeAgainSent}
          onPrimary={requestRematch}
          secondaryLabel={opponentRequestedRematch && !isCorrespondence ? "Decline & Return to Play" : "Close"}
          onSecondary={opponentRequestedRematch && !isCorrespondence ? declineRematch : () => setResultOpen(false)}
        >
          <Button className="mt-4 w-full" href={`/student/play/game/${encodeURIComponent(game.id)}/analysis`}>Review my three key moments</Button>
          <p className="mt-3 text-sm font-bold text-slate-300">
            {isCorrespondence
              ? challengeAgainSent ? "Your challenge is waiting in the other student's inbox." : "Want another slow game? Send a new correspondence challenge."
              : viewerRequestedRematch ? "Waiting for your opponent to accept. The rematch will open automatically." : opponentRequestedRematch ? "Your opponent has already requested another game." : "Want another game? Request a rematch and your opponent can accept from this screen."}
          </p>
        </GameDialog>
      ) : null}
    </div>
  );
}
