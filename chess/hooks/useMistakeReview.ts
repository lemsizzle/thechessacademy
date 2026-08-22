"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildMistakePuzzles, equivalentEngineMoves, mainlineNodeIds, type MistakePuzzle, type PositionEvaluation } from "@/chess/analysis/mistakes";
import type { AnalysisTree } from "@/chess/analysis/types";
import { AnalysisStockfishService } from "@/chess/engine/AnalysisStockfishService";
import type { StockfishCandidate } from "@/chess/types";

type PuzzleResult = { status: "incorrect" | "correct" | "revealed"; attemptedSan: string } | null;

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

function playUci(fen: string, uci: string) {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
  if (!match) return null;
  try {
    const chess = new Chess(fen);
    const move = chess.move({ from: match[1], to: match[2], promotion: match[3] });
    return move ? { fen: chess.fen(), san: move.san } : null;
  } catch {
    return null;
  }
}

export function useMistakeReview(tree: AnalysisTree, reviewColor?: "white" | "black") {
  const serviceRef = useRef<AnalysisStockfishService | null>(null);
  const scanRef = useRef(0);
  const [status, setStatus] = useState<"idle" | "scanning" | "ready" | "error">("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [puzzles, setPuzzles] = useState<MistakePuzzle[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [result, setResult] = useState<PuzzleResult>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);

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
      setPuzzles(buildMistakePuzzles(tree, evaluations, reviewColor));
      setStatus("ready");
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
  }, [cancel, reviewColor, tree]);

  const open = useCallback((index = 0) => {
    if (!puzzles[index]) return;
    setActiveIndex(index);
    setResult(null);
    setDisplayFen(puzzles[index].fen);
  }, [puzzles]);

  const close = useCallback(() => {
    setActiveIndex(null);
    setResult(null);
    setDisplayFen(null);
  }, []);

  const goTo = useCallback((index: number) => {
    if (!puzzles[index]) return;
    setActiveIndex(index);
    setResult(null);
    setDisplayFen(puzzles[index].fen);
  }, [puzzles]);

  const submitMove = useCallback((from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
    if (activeIndex === null) return;
    const puzzle = puzzles[activeIndex];
    if (!puzzle) return;
    const uci = `${from}${to}${promotion ?? ""}`;
    const played = playUci(puzzle.fen, uci);
    if (!played) return;
    if (puzzle.acceptedMovesUci.includes(uci)) {
      setResult({ status: "correct", attemptedSan: played.san });
      setDisplayFen(played.fen);
    } else {
      setResult({ status: "incorrect", attemptedSan: played.san });
      setDisplayFen(puzzle.fen);
    }
  }, [activeIndex, puzzles]);

  const reveal = useCallback(() => {
    if (activeIndex === null) return;
    const puzzle = puzzles[activeIndex];
    if (!puzzle) return;
    const best = playUci(puzzle.fen, puzzle.bestMoveUci);
    setResult({ status: "revealed", attemptedSan: puzzle.bestMoveSan });
    setDisplayFen(best?.fen ?? puzzle.fen);
  }, [activeIndex, puzzles]);

  useEffect(() => () => {
    scanRef.current += 1;
    serviceRef.current?.terminate();
  }, []);

  const activePuzzle = activeIndex === null ? null : puzzles[activeIndex] ?? null;
  return {
    status, progress, error, puzzles, activeIndex, activePuzzle, result,
    displayFen, scan, cancel, open, close, goTo, submitMove, reveal
  };
}
