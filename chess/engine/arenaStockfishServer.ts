import "server-only";

import { spawn } from "node:child_process";
import path from "node:path";
import { Chess } from "chess.js";
import { arenaBotDifficulty } from "@/chess/arena/bots";
import { selectHumanLikeMove } from "@/chess/bots/humanMoveSelector";
import { selectRepertoireMove } from "@/chess/bots/repertoire";
import { parseStockfishInfo } from "@/chess/engine/StockfishService";
import type { BotMoveContext, StockfishCandidate } from "@/chess/types";

/** The same bundled engine/personalities as Play, run by the server, never the opponent's browser. */
export async function chooseArenaBotMove(fen: string, difficultyId: string, context: BotMoveContext): Promise<string> {
  const bot = arenaBotDifficulty(difficultyId);
  if (!bot) throw new Error("Unknown Arena bot skill level.");
  const chess = new Chess(fen);
  if (chess.isGameOver()) throw new Error("No move is available in this position.");
  if (bot.repertoireId === "so-pawny") {
    const { SIR_LEM_REPERTOIRE } = await import("@/chess/bots/sirLemRepertoire");
    const move = selectRepertoireMove(fen, SIR_LEM_REPERTOIRE);
    if (move) return move;
  }
  return new Promise((resolve, reject) => {
    const engine = spawn(process.execPath, [path.join(process.cwd(), "public/vendor/stockfish/stockfish-18-lite-single.js")], {
      stdio: ["pipe", "pipe", "pipe"], windowsHide: true
    });
    const candidates = new Map<number, StockfishCandidate>();
    let buffer = "";
    let finished = false;
    const timeout = setTimeout(() => finish(new Error("The Arena computer took too long. Please retry.")), 10_000);
    function finish(error?: Error, move?: string) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      engine.kill();
      if (error) reject(error); else resolve(move!);
    }
    engine.on("error", (error) => finish(error));
    engine.stdin.on("error", (error) => finish(error));
    engine.on("exit", () => { if (!finished) finish(new Error("The Arena computer stopped unexpectedly.")); });
    engine.stderr.resume();
    engine.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (finished) return;
        if (line === "uciok") {
          engine.stdin.write(`setoption name Hash value 16\nsetoption name Threads value 1\nsetoption name MultiPV value ${bot!.multiPv}\nisready\n`);
        } else if (line === "readyok") {
          engine.stdin.write(`position fen ${fen}\ngo movetime ${bot!.thinkTimeMs}\n`);
        } else if (line.startsWith("bestmove ")) {
          try {
            const best = line.split(" ")[1];
            const choices = [...candidates.values()];
            if (!choices.length) choices.push({ uci: best, rank: 1, depth: 0, scoreCp: 0, mate: null, pv: [best] });
            const move = selectHumanLikeMove({ fen, candidates: choices, bot: bot!, context });
            chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
            finish(undefined, move);
          } catch (error) { finish(error instanceof Error ? error : new Error("Invalid computer move.")); }
        } else {
          const candidate = parseStockfishInfo(line);
          if (candidate && candidate.depth >= (candidates.get(candidate.rank)?.depth ?? 0)) candidates.set(candidate.rank, candidate);
        }
      }
    });
    engine.stdin.write("uci\n");
  });
}
