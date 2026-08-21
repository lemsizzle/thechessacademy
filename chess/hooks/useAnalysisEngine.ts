"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnalysisStockfishService } from "@/chess/engine/AnalysisStockfishService";
import { StockfishCancelledError } from "@/chess/engine/StockfishService";
import type { StockfishCandidate } from "@/chess/types";

export type DisplayEngineLine = StockfishCandidate & { scoreWhiteCp: number | null; mateWhite: number | null; san: string };

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

export function useAnalysisEngine() {
  const serviceRef = useRef<AnalysisStockfishService | null>(null);
  const requestRef = useRef(0);
  const [lines, setLines] = useState<DisplayEngineLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    requestRef.current += 1;
    serviceRef.current?.stop();
    setLoading(false);
  }, []);

  const analyze = useCallback(async (fen: string) => {
    const request = ++requestRef.current;
    serviceRef.current ??= new AnalysisStockfishService();
    setLoading(true);
    setError("");
    try {
      const candidates = await serviceRef.current.analyze(fen);
      if (request !== requestRef.current) return;
      const whiteToMove = fen.split(" ")[1] === "w";
      setLines(candidates.map((line) => ({
        ...line,
        scoreWhiteCp: line.scoreCp === null ? null : (whiteToMove ? line.scoreCp : -line.scoreCp),
        mateWhite: line.mate === null ? null : (whiteToMove ? line.mate : -line.mate),
        san: lineToSan(fen, line.pv)
      })));
    } catch (cause) {
      if (cause instanceof StockfishCancelledError || request !== requestRef.current) return;
      setError(cause instanceof Error ? cause.message : "Stockfish analysis failed.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => () => {
    serviceRef.current?.terminate();
    serviceRef.current = null;
  }, []);

  return { lines, loading, error, analyze, stop, clear: () => setLines([]) };
}
