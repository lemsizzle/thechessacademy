"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StockfishCancelledError, StockfishService } from "@/chess/engine/StockfishService";
import type { BotDifficulty, BotMoveContext } from "@/chess/types";

export function useStockfish() {
  const serviceRef = useRef<StockfishService | null>(null);
  const [thinking, setThinking] = useState(false);
  const [engineError, setEngineError] = useState("");

  function service() {
    serviceRef.current ??= new StockfishService();
    return serviceRef.current;
  }

  const requestMove = useCallback(async (fen: string, difficulty: BotDifficulty, context: BotMoveContext) => {
    setThinking(true);
    setEngineError("");
    try {
      return await service().requestMove(fen, difficulty, context);
    } catch (error) {
      if (error instanceof StockfishCancelledError) return null;
      const message = error instanceof Error ? error.message : "The computer opponent could not move.";
      setEngineError(message);
      throw error;
    } finally {
      setThinking(false);
    }
  }, []);

  const stop = useCallback(() => {
    serviceRef.current?.stop();
    setThinking(false);
  }, []);

  const clearEngineError = useCallback(() => setEngineError(""), []);

  useEffect(() => () => {
    serviceRef.current?.terminate();
    serviceRef.current = null;
  }, []);

  return { requestMove, stop, thinking, engineError, clearEngineError };
}
