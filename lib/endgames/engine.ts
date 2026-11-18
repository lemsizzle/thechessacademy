import { AnalysisStockfishService } from "@/chess/engine/AnalysisStockfishService";

/** Bound worker startup as well as analysis. A failed download must not leave
 * training stuck forever before AnalysisStockfishService's search timer starts.
 */
export async function analyzeEndgame(engine: AnalysisStockfishService, fen: string, timeMs = 500) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      engine.analyze(fen, timeMs),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          engine.terminate();
          reject(new Error("The defender could not load. Check your connection and retry."));
        }, 15_000);
      })
    ]);
  } finally { clearTimeout(timer); }
}
