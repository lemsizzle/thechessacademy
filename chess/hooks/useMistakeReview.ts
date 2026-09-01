"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildMistakePuzzles, equivalentEngineMoves, mainlineNodeIds, type MistakePuzzle, type PositionEvaluation } from "@/chess/analysis/mistakes";
import { continueExploration, playReviewMove, resetExploration as resetExplorationLine, undoExploration, type ExplorationPosition } from "@/chess/analysis/mistakeExploration";
import type { AnalysisTree } from "@/chess/analysis/types";
import { AnalysisStockfishService } from "@/chess/engine/AnalysisStockfishService";
import type { StockfishCandidate } from "@/chess/types";

type PuzzleResult = { status: "incorrect" | "correct" | "revealed"; attemptedSan: string; attemptedUci: string } | null;

function lineToSan(fen: string, pv: string[]) {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of pv.slice(0, 8)) {
    const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
    if (!match) break;
    const move = chess.move({ from: match[1], to: match[2], promotion: match[3] });
    if (!move) break;
    san.push(move.san);
  }
  return san.join(" ");
}

function normalizeEvaluation(nodeId: string, fen: string, lines: StockfishCandidate[]): PositionEvaluation | null {
  const line = lines[0];
  if (!line) return null;
  const whiteToMove = fen.split(" ")[1] === "w";
  return {
    nodeId,
    scoreWhiteCp: line.scoreCp === null ? null : whiteToMove ? line.scoreCp : -line.scoreCp,
    mateWhite: line.mate === null ? null : whiteToMove ? line.mate : -line.mate,
    bestMoveUci: line.uci,
    acceptedMovesUci: equivalentEngineMoves(lines),
    bestLineSan: lineToSan(fen, line.pv),
    depth: line.depth
  };
}

export function useMistakeReview(tree: AnalysisTree, reviewColor?: "white" | "black", reviewGameId?: string) {
  const serviceRef = useRef<AnalysisStockfishService | null>(null);
  const scanRef = useRef(0);
  const [status, setStatus] = useState<"idle" | "scanning" | "ready" | "error">("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [puzzles, setPuzzles] = useState<MistakePuzzle[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [result, setResult] = useState<PuzzleResult>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [explorationLine, setExplorationLine] = useState<ExplorationPosition[]>([]);
  const [queueSave, setQueueSave] = useState<{ status: "idle" | "saving" | "saved" | "error"; message: string }>({ status: "idle", message: "" });

  const cancel = useCallback(() => {
    scanRef.current += 1;
    serviceRef.current?.terminate();
    serviceRef.current = null;
    setStatus((value) => value === "scanning" ? "idle" : value);
  }, []);

  const scan = useCallback(async () => {
    if (!reviewColor) return;
    cancel();
    const request = ++scanRef.current;
    const ids = mainlineNodeIds(tree);
    const service = new AnalysisStockfishService();
    serviceRef.current = service;
    setStatus("scanning");
    setError("");
    setPuzzles([]);
    setActiveIndex(null);
    setResult(null);
    setDisplayFen(null);
    setExplorationLine([]);
    setQueueSave({ status: "idle", message: "" });
    setProgress({ current: 0, total: ids.length });
    const evaluations: PositionEvaluation[] = [];
    try {
      for (let index = 0; index < ids.length; index += 1) {
        if (request !== scanRef.current) return;
        const node = tree.nodes[ids[index]];
        if (!node) continue;
        const lines = await service.analyze(node.fen, 350);
        const evaluation = normalizeEvaluation(node.id, node.fen, lines);
        if (evaluation) evaluations.push(evaluation);
        setProgress({ current: index + 1, total: ids.length });
      }
      if (request !== scanRef.current) return;
      const nextPuzzles = buildMistakePuzzles(tree, evaluations, reviewColor);
      setPuzzles(nextPuzzles);
      setStatus("ready");
      if (reviewGameId) {
        setQueueSave({ status: "saving", message: "Adding these positions to your personal review queue…" });
        try {
          const response = await fetch("/api/student/adaptive-review/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gameId: reviewGameId, puzzles: nextPuzzles })
          });
          const body = await response.json().catch(() => ({})) as { saved?: number; error?: string };
          if (!response.ok) throw new Error(body.error ?? "The review queue could not be updated.");
          setQueueSave({
            status: "saved",
            message: nextPuzzles.length
              ? `${body.saved ?? nextPuzzles.length} position${nextPuzzles.length === 1 ? "" : "s"} added to Adaptive Training.`
              : "Your review queue is up to date; no significant mistakes were found."
          });
        } catch (saveError) {
          setQueueSave({ status: "error", message: saveError instanceof Error ? saveError.message : "The review queue could not be updated." });
        }
      }
    } catch (cause) {
      if (request !== scanRef.current) return;
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "The game review could not be completed.");
    } finally {
      if (request === scanRef.current) {
        service.terminate();
        serviceRef.current = null;
      }
    }
  }, [cancel, reviewColor, reviewGameId, tree]);

  const open = useCallback((index = 0) => {
    if (!puzzles[index]) return;
    setActiveIndex(index);
    setResult(null);
    setDisplayFen(puzzles[index].fen);
    setExplorationLine([]);
  }, [puzzles]);

  const close = useCallback(() => {
    setActiveIndex(null);
    setResult(null);
    setDisplayFen(null);
    setExplorationLine([]);
  }, []);

  const goTo = useCallback((index: number) => {
    if (!puzzles[index]) return;
    setActiveIndex(index);
    setResult(null);
    setDisplayFen(puzzles[index].fen);
    setExplorationLine([]);
  }, [puzzles]);

  const submitMove = useCallback((from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
    if (activeIndex === null) return;
    const puzzle = puzzles[activeIndex];
    if (!puzzle) return;
    const uci = `${from}${to}${promotion ?? ""}`;
    if (result?.status === "correct") {
      const explored = continueExploration(explorationLine, uci);
      if (!explored) return;
      setDisplayFen(explored.move.fen);
      setExplorationLine(explored.line);
      return;
    }
    const played = playReviewMove(puzzle.fen, uci);
    if (!played) return;
    if (puzzle.acceptedMovesUci.includes(uci)) {
      setResult({ status: "correct", attemptedSan: played.san, attemptedUci: uci });
      setDisplayFen(played.fen);
      setExplorationLine([{ fen: played.fen, lastMoveUci: uci }]);
    } else {
      setResult({ status: "incorrect", attemptedSan: played.san, attemptedUci: uci });
      setDisplayFen(puzzle.fen);
      setExplorationLine([]);
    }
  }, [activeIndex, explorationLine, puzzles, result?.status]);

  const reveal = useCallback(() => {
    if (activeIndex === null) return;
    const puzzle = puzzles[activeIndex];
    if (!puzzle) return;
    const best = playReviewMove(puzzle.fen, puzzle.bestMoveUci);
    setResult({ status: "revealed", attemptedSan: puzzle.bestMoveSan, attemptedUci: puzzle.bestMoveUci });
    setDisplayFen(best?.fen ?? puzzle.fen);
    setExplorationLine([]);
  }, [activeIndex, puzzles]);

  const undoExplorationMove = useCallback(() => {
    const nextLine = undoExploration(explorationLine);
    if (nextLine === explorationLine) return;
    setExplorationLine(nextLine);
    setDisplayFen(nextLine[nextLine.length - 1].fen);
  }, [explorationLine]);

  const resetExploration = useCallback(() => {
    const nextLine = resetExplorationLine(explorationLine);
    const solvedPosition = nextLine[0];
    if (!solvedPosition || nextLine === explorationLine) return;
    setExplorationLine(nextLine);
    setDisplayFen(solvedPosition.fen);
  }, [explorationLine]);

  useEffect(() => () => {
    scanRef.current += 1;
    serviceRef.current?.terminate();
  }, []);

  const activePuzzle = activeIndex === null ? null : puzzles[activeIndex] ?? null;
  const explorationMoveCount = Math.max(0, explorationLine.length - 1);
  const lastMoveUci = explorationLine[explorationLine.length - 1]?.lastMoveUci
    ?? (result?.status === "revealed" ? activePuzzle?.bestMoveUci ?? null : null);
  return {
    status, progress, error, puzzles, activeIndex, activePuzzle, result,
    displayFen, lastMoveUci, explorationMoveCount, queueSave,
    scan, cancel, open, close, goTo, submitMove, reveal, undoExplorationMove, resetExploration
  };
}
