"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chessJsColor, fromChessJsColor, oppositeColor } from "@/chess/game/config";
import { createOutcome, detectBoardOutcome, gameMoves, hasHumanMove, promotionOptions, resultHeader, tryMove, undoComputerTurn } from "@/chess/game/rules";
import { useChessSounds } from "@/chess/hooks/useChessSounds";
import { useGameClock } from "@/chess/hooks/useGameClock";
import { useStockfish } from "@/chess/hooks/useStockfish";
import type { ClockSnapshot, ComputerGameConfig, GameOutcome, PromotionPiece } from "@/chess/types";

const STANDARD_FEN = new Chess().fen();
const UCI_MOVE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

export function useComputerGame() {
  const chessRef = useRef(new Chess());
  const outcomeRef = useRef<GameOutcome | null>(null);
  const clockHistoryRef = useRef<Array<ClockSnapshot | null>>([]);
  const engineRequestFenRef = useRef<string | null>(null);
  const startedAtRef = useRef("");
  const completedAtRef = useRef("");
  const saveStartedRef = useRef(false);
  const [config, setConfig] = useState<ComputerGameConfig | null>(null);
  const [fen, setFen] = useState(STANDARD_FEN);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [moves, setMoves] = useState(() => gameMoves(chessRef.current));
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const [engineRetry, setEngineRetry] = useState(0);
  const { display: clockDisplay, expiredColor, reset: resetClock, completeMove: completeClockMove, restore: restoreClock, pause: pauseClock } = useGameClock();
  const { requestMove: requestEngineMove, stop: stopEngine, thinking, engineError, clearEngineError } = useStockfish();
  const { muted, setMuted, play: playSound } = useChessSounds();

  const syncPosition = useCallback((move?: { from: string; to: string }) => {
    const chess = chessRef.current;
    setFen(chess.fen());
    setMoves(gameMoves(chess));
    if (move) setLastMove([move.from, move.to]);
    else {
      const history = chess.history({ verbose: true });
      const latest = history.at(-1);
      setLastMove(latest ? [latest.from, latest.to] : null);
    }
  }, []);

  const finishGame = useCallback((nextOutcome: GameOutcome) => {
    if (outcomeRef.current) return;
    outcomeRef.current = nextOutcome;
    completedAtRef.current = new Date().toISOString();
    chessRef.current.header("Result", resultHeader(nextOutcome));
    pauseClock();
    stopEngine();
    playSound("end");
    setOutcome(nextOutcome);
    setResultOpen(true);
  }, [pauseClock, playSound, stopEngine]);

  const startGame = useCallback((nextConfig: ComputerGameConfig) => {
    stopEngine();
    clearEngineError();
    const chess = new Chess();
    chess.header(
      "Event", "Chess Academy vs Computer",
      "Site", "The Chess Academy",
      "White", nextConfig.humanColor === "white" ? "Student" : nextConfig.bot.name,
      "Black", nextConfig.humanColor === "black" ? "Student" : nextConfig.bot.name
    );
    chessRef.current = chess;
    outcomeRef.current = null;
    engineRequestFenRef.current = null;
    startedAtRef.current = new Date().toISOString();
    completedAtRef.current = "";
    saveStartedRef.current = false;
    const initialClock = resetClock(nextConfig.timeControl);
    clockHistoryRef.current = [initialClock];
    setConfig(nextConfig);
    setFen(chess.fen());
    setMoves([]);
    setLastMove(null);
    setOutcome(null);
    setResultOpen(false);
    setPendingPromotion(null);
    setBoardOrientation(nextConfig.humanColor);
    setSaveStatus("idle");
    setSaveMessage("");
    setSavedGameId(null);
    setEngineRetry(0);
  }, [clearEngineError, resetClock, stopEngine]);

  const playMoveSound = useCallback((captured: boolean) => {
    const chess = chessRef.current;
    playSound(chess.inCheck() ? "check" : captured ? "capture" : "move");
  }, [playSound]);

  const commitHumanMove = useCallback((from: string, to: string, promotion?: PromotionPiece) => {
    if (!config || outcomeRef.current || thinking) return false;
    const chess = chessRef.current;
    if (chess.turn() !== chessJsColor(config.humanColor)) return false;
    const move = tryMove(chess, { from, to, promotion });
    if (!move) return false;
    const snapshot = completeClockMove(config.humanColor);
    clockHistoryRef.current.push(snapshot);
    engineRequestFenRef.current = null;
    syncPosition(move);
    playMoveSound(Boolean(move.captured));
    const boardOutcome = detectBoardOutcome(chess, config.humanColor);
    if (boardOutcome) finishGame(boardOutcome);
    return true;
  }, [completeClockMove, config, finishGame, playMoveSound, syncPosition, thinking]);

  const attemptHumanMove = useCallback((from: string, to: string) => {
    if (!config || outcomeRef.current || thinking) return;
    const options = promotionOptions(chessRef.current, from, to);
    if (options.length) {
      setPendingPromotion({ from, to });
      return;
    }
    commitHumanMove(from, to);
  }, [commitHumanMove, config, thinking]);

  const choosePromotion = useCallback((promotion: PromotionPiece) => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    commitHumanMove(from, to, promotion);
  }, [commitHumanMove, pendingPromotion]);

  useEffect(() => {
    if (!config || outcome || pendingPromotion) return;
    const chess = chessRef.current;
    if (chess.turn() === chessJsColor(config.humanColor)) return;
    if (engineRequestFenRef.current === fen) return;
    engineRequestFenRef.current = fen;
    let ignore = false;

    const moveHistory = chess.history({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ""}`);
    void requestEngineMove(fen, config.bot, { moveHistory }).then((uci) => {
      if (ignore || !uci || outcomeRef.current || chessRef.current.fen() !== fen) return;
      const match = UCI_MOVE.exec(uci);
      if (!match) throw new Error("Stockfish returned an invalid move.");
      const move = tryMove(chessRef.current, {
        from: match[1],
        to: match[2],
        promotion: match[3] as PromotionPiece | undefined
      });
      if (!move) throw new Error("Stockfish returned an illegal move.");
      const engineColor = oppositeColor(config.humanColor);
      const snapshot = completeClockMove(engineColor);
      clockHistoryRef.current.push(snapshot);
      syncPosition(move);
      playMoveSound(Boolean(move.captured));
      const boardOutcome = detectBoardOutcome(chessRef.current, config.humanColor);
      if (boardOutcome) finishGame(boardOutcome);
    }).catch(() => {
      // The engine hook presents the actionable error without crashing the board.
    });

    return () => {
      ignore = true;
    };
  }, [completeClockMove, config, engineRetry, fen, finishGame, outcome, pendingPromotion, playMoveSound, requestEngineMove, syncPosition]);

  useEffect(() => {
    if (!config || !expiredColor || outcomeRef.current) return;
    finishGame(createOutcome("timeout", oppositeColor(expiredColor), config.humanColor));
  }, [config, expiredColor, finishGame]);

  useEffect(() => {
    if (!config || !outcome || saveStartedRef.current) return;
    saveStartedRef.current = true;
    setSaveStatus("saving");
    const chess = chessRef.current;
    const payload = {
      opponentId: config.bot.id,
      opponentName: config.bot.name,
      playerColor: config.humanColor,
      result: outcome.result,
      resultReason: outcome.reason,
      winnerColor: outcome.winnerColor,
      timeControlId: config.timeControl.id,
      initialFen: STANDARD_FEN,
      finalFen: chess.fen(),
      pgn: chess.pgn(),
      moves: gameMoves(chess).map(({ from, to, promotion }) => ({ from, to, promotion })),
      startedAt: startedAtRef.current,
      completedAt: completedAtRef.current
    };

    void fetch("/api/student/chess-games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (response) => {
      const body = await response.json().catch(() => ({})) as { error?: string; gameId?: string };
      if (!response.ok) throw new Error(body.error ?? "Completed game could not be saved.");
      if (!body.gameId) throw new Error("The saved game ID was not returned.");
      setSavedGameId(body.gameId);
      setSaveStatus("saved");
      setSaveMessage("Game saved to your academy record.");
    }).catch((error) => {
      setSaveStatus("failed");
      setSaveMessage(error instanceof Error ? error.message : "Completed game could not be saved.");
    });
  }, [config, outcome]);

  const resign = useCallback(() => {
    if (!config || outcomeRef.current) return;
    finishGame(createOutcome("resignation", oppositeColor(config.humanColor), config.humanColor));
  }, [config, finishGame]);

  const retryComputerMove = useCallback(() => {
    if (!config || outcomeRef.current || chessRef.current.turn() === chessJsColor(config.humanColor)) return;
    stopEngine();
    clearEngineError();
    engineRequestFenRef.current = null;
    setEngineRetry((value) => value + 1);
  }, [clearEngineError, config, stopEngine]);

  const takeBack = useCallback(() => {
    if (!config || outcomeRef.current || !hasHumanMove(chessRef.current, config.humanColor)) return;
    stopEngine();
    engineRequestFenRef.current = null;
    const undone = undoComputerTurn(chessRef.current, config.humanColor);
    if (!undone.length) return;
    clockHistoryRef.current.splice(Math.max(1, clockHistoryRef.current.length - undone.length));
    restoreClock(clockHistoryRef.current.at(-1) ?? null);
    setPendingPromotion(null);
    syncPosition();
  }, [config, restoreClock, stopEngine, syncPosition]);

  const leaveGame = useCallback(() => {
    stopEngine();
    pauseClock();
    outcomeRef.current = null;
    setConfig(null);
    setOutcome(null);
    setResultOpen(false);
    setPendingPromotion(null);
  }, [pauseClock, stopEngine]);

  const activeColor = outcome ? null : clockDisplay?.activeColor ?? fromChessJsColor(chessRef.current.turn());
  const humanTurn = Boolean(config && !outcome && !thinking && chessRef.current.turn() === chessJsColor(config.humanColor));
  const canTakeBack = Boolean(config && !outcome && hasHumanMove(chessRef.current, config.humanColor));
  const clockTimes = useMemo(() => ({
    white: clockDisplay?.whiteMs ?? null,
    black: clockDisplay?.blackMs ?? null
  }), [clockDisplay]);

  return {
    config,
    fen,
    moves,
    lastMove,
    outcome,
    resultOpen,
    setResultOpen,
    pendingPromotion,
    setPendingPromotion,
    boardOrientation,
    setBoardOrientation,
    activeColor,
    humanTurn,
    canTakeBack,
    clockTimes,
    thinking,
    engineError,
    saveStatus,
    saveMessage,
    savedGameId,
    muted,
    setMuted,
    startGame,
    attemptHumanMove,
    choosePromotion,
    resign,
    retryComputerMove,
    takeBack,
    leaveGame
  };
}
