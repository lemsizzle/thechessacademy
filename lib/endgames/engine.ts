import { AnalysisStockfishService } from "@/chess/engine/AnalysisStockfishService";
import { StockfishCancelledError } from "@/chess/engine/StockfishService";

/** Startup has its own 60-second bound; a cold download is not a slow move.
 * Retry a failed worker once. Canceled requests must never restart themselves.
 */
export async function analyzeEndgame(engine: AnalysisStockfishService, fen: string, timeMs = 500) {
  try { return await engine.analyze(fen, timeMs); }
  catch (error) {
    if (error instanceof StockfishCancelledError) throw error;
    return engine.analyze(fen, timeMs);
  }
}
