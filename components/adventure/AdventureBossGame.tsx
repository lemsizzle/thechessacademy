"use client";

import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { BOT_DIFFICULTIES } from "@/chess/game/config";
import { useStockfish } from "@/chess/hooks/useStockfish";
import type { BotDifficulty } from "@/chess/types";
import { Button } from "@/components/Button";

const KINGPIN_BOT: BotDifficulty = {
  ...BOT_DIFFICULTIES[0],
  id: "kingpin-local",
  name: "Kingpin",
  title: "Pawnhaven Boss",
  estimatedRating: 400,
  description: "A first boss who makes recognizable beginner mistakes, but still wants the last word."
};

type BossResult = "victory" | "defeat" | "draw" | null;

export function AdventureBossGame({ onFinishChapter, onCheckmate, onRetreat }: { onFinishChapter: () => void; onCheckmate: () => void; onRetreat: () => void }) {
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(() => chessRef.current.fen());
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [result, setResult] = useState<BossResult>(null);
  const [status, setStatus] = useState("Your move. Kingpin plays Black.");
  const { requestMove, thinking, engineError, clearEngineError } = useStockfish();

  function resetGame() {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setLastMove(null);
    setMoves([]);
    setResult(null);
    clearEngineError();
    setStatus("Your move. Kingpin plays Black.");
  }

  function finish(chess: Chess) {
    if (chess.isCheckmate()) {
      onCheckmate();
      const playerWon = chess.turn() === "b";
      setResult(playerWon ? "victory" : "defeat");
      setStatus(playerWon ? "Checkmate. Kingpin's gang has lost the board." : "Checkmate. Kingpin folds his cape with entirely too much confidence.");
      return true;
    }
    if (chess.isDraw()) {
      setResult("draw");
      setStatus(chess.isStalemate() ? "Stalemate. Kingpin calls it 'a tactical postponement.'" : "The game is drawn. Pawnhaven needs one more try.");
      return true;
    }
    return false;
  }

  function sync(chess: Chess, from: string, to: string) {
    setFen(chess.fen());
    setLastMove([from, to]);
    setMoves(chess.history());
  }

  function move(from: string, to: string) {
    if (result || thinking || chessRef.current.turn() !== "w") return;
    const chess = chessRef.current;
    try {
      const played = chess.move({ from, to, promotion: "q" });
      sync(chess, played.from, played.to);
      if (!finish(chess)) setStatus("Kingpin is thinking… Try not to let his cape distract you.");
    } catch {
      setStatus("That move is not legal. Even Kingpin cannot complain about that one.");
    }
  }

  useEffect(() => {
    if (result || chessRef.current.turn() !== "b") return;
    const requestedFen = fen;
    let cancelled = false;
    const history = chessRef.current.history({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ""}`);
    void requestMove(requestedFen, KINGPIN_BOT, { moveHistory: history }).then((uci) => {
      if (cancelled || !uci || chessRef.current.fen() !== requestedFen) return;
      const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
      if (!match) throw new Error("Kingpin's move was not valid.");
      const played = chessRef.current.move({ from: match[1], to: match[2], promotion: match[3] as "q" | "r" | "b" | "n" | undefined });
      sync(chessRef.current, played.from, played.to);
      if (!finish(chessRef.current)) setStatus("Your move. Lem is watching the whole board, not just the shiny pieces.");
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [fen, requestMove, result]);

  return (
    <section className="rounded-2xl border border-rose-200/25 bg-slate-950/90 p-4 shadow-[0_0_48px_rgba(244,63,94,.13)] sm:p-6">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-200">Boss battle · local prototype</p>
          <h2 className="mt-1 text-3xl font-black text-white">Kingpin vs You</h2>
          <p className="mt-2 text-sm text-slate-300">Untimed, local-only play using the Academy's 2D board and browser-based opponent system. No game record is saved.</p>
        </div>
        <span className="w-fit rounded-full border border-rose-200/25 bg-rose-300/10 px-3 py-1 text-xs font-bold text-rose-100">♛ Kingpin · beginner boss</span>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="mx-auto aspect-square w-full max-w-[650px] overflow-hidden rounded-xl border border-rose-100/20 bg-slate-900 p-1 sm:p-2">
          <AcademyChessboard fen={fen} orientation="white" humanColor="white" interactive={!result && !thinking} lastMove={lastMove} onMove={move} boardId="adventure-kingpin" />
        </div>
        <aside className="space-y-4">
          <div className={`rounded-xl border p-4 text-sm leading-6 ${engineError ? "border-rose-300/35 bg-rose-300/10 text-rose-100" : "border-white/10 bg-white/5 text-slate-200"}`} aria-live="polite">
            <p className="text-xs font-black uppercase tracking-wider text-amber-200">Battle status</p>
            <p className="mt-2">{engineError || status}</p>
            {engineError && <Button type="button" variant="secondary" className="mt-3" onClick={resetGame}>Start fresh</Button>}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Moves</p>
            <p className="mt-2 max-h-36 overflow-y-auto text-sm leading-6 text-slate-300">{moves.length ? moves.join(" ") : "The board is ready."}</p>
          </div>
          {!result && <Button type="button" variant="ghost" className="w-full" onClick={onRetreat}>Back to boss prep</Button>}
          {result && result !== "victory" && <Button type="button" className="w-full" onClick={resetGame}>Try Kingpin again</Button>}
          {result === "victory" && <Button type="button" className="w-full" onClick={onFinishChapter}>Free Pawnhaven</Button>}
        </aside>
      </div>
    </section>
  );
}
