"use client";

import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { puzzleTrainingPositions } from "@/data/puzzleTraining";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const BEST_SCORE_KEY = "chess-academy-puzzle-survival-best";

const PIECES: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
};

type RoundState = "ready" | "correct" | "wrong" | "game-over";

function nextPuzzleIndex(currentIndex: number) {
  if (puzzleTrainingPositions.length < 2) return 0;
  let nextIndex = currentIndex;
  while (nextIndex === currentIndex) nextIndex = Math.floor(Math.random() * puzzleTrainingPositions.length);
  return nextIndex;
}

function squareName(fileIndex: number, rankIndex: number) {
  return `${FILES[fileIndex]}${8 - rankIndex}` as Square;
}

export function PuzzleSurvival() {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [lastScore, setLastScore] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>("ready");
  const [message, setMessage] = useState("Select a piece, then choose its destination.");
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputLocked = useRef(false);
  const puzzle = puzzleTrainingPositions[puzzleIndex];
  const chess = useMemo(() => new Chess(puzzle.fen), [puzzle.fen]);

  useEffect(() => {
    const storedBest = Number(window.localStorage.getItem(BEST_SCORE_KEY) ?? 0);
    if (Number.isFinite(storedBest) && storedBest > 0) setBestScore(storedBest);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  function loadNextPuzzle(delay = 650) {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      setPuzzleIndex((current) => nextPuzzleIndex(current));
      setSelectedSquare(null);
      setRoundState("ready");
      inputLocked.current = false;
      setMessage("Select a piece, then choose its destination.");
    }, delay);
  }

  function recordCorrectMove() {
    const nextScore = score + 1;
    setScore(nextScore);
    setRoundState("correct");
    setMessage(`Correct! ${puzzle.title} solved.`);
    if (nextScore > bestScore) {
      setBestScore(nextScore);
      window.localStorage.setItem(BEST_SCORE_KEY, String(nextScore));
    }
    loadNextPuzzle();
  }

  function recordWrongMove() {
    const remainingLives = lives - 1;
    setSelectedSquare(null);
    setLives(remainingLives);

    if (remainingLives <= 0) {
      setLastScore(score);
      setScore(0);
      setRoundState("game-over");
      setMessage("The run is over. Your score has reset to zero.");
      return;
    }

    setRoundState("wrong");
    setMessage(`Not quite. ${remainingLives} ${remainingLives === 1 ? "chance" : "chances"} left.`);
    loadNextPuzzle(750);
  }

  function tryMove(from: Square, to: Square) {
    if (inputLocked.current) return;
    inputLocked.current = true;
    try {
      chess.move({ from, to, promotion: puzzle.solution.promotion });
    } catch {
      recordWrongMove();
      return;
    }

    if (from === puzzle.solution.from && to === puzzle.solution.to) recordCorrectMove();
    else recordWrongMove();
  }

  function handleSquareClick(square: Square) {
    if (roundState !== "ready" || inputLocked.current) return;
    const piece = chess.get(square);

    if (!selectedSquare) {
      if (piece?.color === chess.turn()) {
        setSelectedSquare(square);
        setMessage(`Selected ${square}. Now choose where it should move.`);
      }
      return;
    }

    if (piece?.color === chess.turn()) {
      setSelectedSquare(square);
      setMessage(`Selected ${square}. Now choose where it should move.`);
      return;
    }

    tryMove(selectedSquare, square);
  }

  function beginNewRun() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setPuzzleIndex((current) => nextPuzzleIndex(current));
    setSelectedSquare(null);
    setLives(3);
    setScore(0);
    setRoundState("ready");
    inputLocked.current = false;
    setMessage("New run started. Find the winning move.");
  }

  const board = chess.board();
  const boardFeedback = roundState === "correct"
    ? "ring-2 ring-emerald-300 shadow-[0_0_34px_rgba(52,211,153,0.36)]"
    : roundState === "wrong"
      ? "ring-2 ring-rose-400 shadow-[0_0_34px_rgba(251,113,133,0.34)]"
      : "ring-1 ring-cyan-200/30 shadow-[0_0_42px_rgba(56,189,248,0.2)]";

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-white/10">
          <div className="p-4 text-center">
            <p className="text-xs font-black uppercase text-slate-500">Score</p>
            <p className="mt-1 text-3xl font-black text-cyan-100">{score}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-xs font-black uppercase text-slate-500">Chances</p>
            <p className="mt-2 text-xl" aria-label={`${lives} chances remaining`}>
              {[0, 1, 2].map((life) => <span key={life} className={life < lives ? "text-rose-300" : "text-slate-700"} aria-hidden="true">♥</span>)}
            </p>
          </div>
          <div className="p-4 text-center">
            <p className="text-xs font-black uppercase text-slate-500">Best Run</p>
            <p className="mt-1 text-3xl font-black text-amber-200">{bestScore}</p>
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,720px)_minmax(260px,1fr)]">
        <div className="relative mx-auto w-full max-w-[720px]">
          <div className={`grid aspect-square w-full grid-cols-8 overflow-hidden rounded-lg transition ${boardFeedback}`}>
            {board.flatMap((rank, rankIndex) => rank.map((piece, fileIndex) => {
              const square = squareName(fileIndex, rankIndex);
              const isLight = (rankIndex + fileIndex) % 2 === 0;
              const isSelected = selectedSquare === square;
              return (
                <button
                  type="button"
                  key={square}
                  onClick={() => handleSquareClick(square)}
                  className={`relative flex aspect-square min-w-0 items-center justify-center transition active:scale-[0.97] ${isLight ? "bg-cyan-100" : "bg-cyan-800"} ${isSelected ? "z-10 ring-4 ring-inset ring-amber-300" : "hover:brightness-110"}`}
                  aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : " empty"}`}
                >
                  {fileIndex === 0 && <span className={`absolute left-1 top-0.5 text-[9px] font-black sm:text-xs ${isLight ? "text-cyan-900" : "text-cyan-100"}`}>{8 - rankIndex}</span>}
                  {rankIndex === 7 && <span className={`absolute bottom-0.5 right-1 text-[9px] font-black sm:text-xs ${isLight ? "text-cyan-900" : "text-cyan-100"}`}>{FILES[fileIndex]}</span>}
                  {piece && (
                    <span className={`select-none text-4xl leading-none sm:text-6xl lg:text-7xl ${piece.color === "w" ? "text-white [text-shadow:0_2px_0_#334155,0_0_8px_rgba(255,255,255,0.45)]" : "text-slate-950 [text-shadow:0_1px_0_#94a3b8]"}`} aria-hidden="true">
                      {PIECES[piece.color][piece.type]}
                    </span>
                  )}
                </button>
              );
            }))}
          </div>

          {roundState === "game-over" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-950/86 p-6 backdrop-blur-sm">
              <div className="max-w-sm text-center">
                <p className="text-xs font-black uppercase text-rose-200">Run Complete</p>
                <h2 className="mt-2 text-3xl font-black text-white">You scored {lastScore}</h2>
                <p className="mt-2 text-sm text-slate-300">Your survival score reset, but your best run is still saved.</p>
                <Button type="button" onClick={beginNewRun} className="mt-5">Begin New Run</Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded border border-cyan-200/30 bg-cyan-300/10 px-2 py-1 text-xs font-black uppercase text-cyan-100">{puzzle.theme}</span>
              <span className="text-xs font-bold text-slate-500">White to move</span>
            </div>
            <h2 className="mt-4 text-2xl font-black text-white">{puzzle.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{puzzle.instruction}</p>
            <div className={`mt-5 rounded-md border px-3 py-3 text-sm font-bold ${roundState === "correct" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : roundState === "wrong" || roundState === "game-over" ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : "border-white/10 bg-white/5 text-slate-200"}`} aria-live="polite">
              {message}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-black uppercase text-amber-200">Survival Rules</p>
            <ol className="mt-3 space-y-3 text-sm text-slate-300">
              <li className="flex gap-3"><span className="font-black text-cyan-200">1</span><span>Solve one position to earn one point.</span></li>
              <li className="flex gap-3"><span className="font-black text-cyan-200">2</span><span>A wrong move costs one chance and loads a new puzzle.</span></li>
              <li className="flex gap-3"><span className="font-black text-cyan-200">3</span><span>Lose all three chances and the run resets to zero.</span></li>
            </ol>
          </Card>

          <div className="flex flex-wrap gap-2" aria-label="Training themes">
            {["Forks", "Pins", "Skewers", "Discovered Attacks", "Mate in 1"].map((theme) => (
              <span key={theme} className="rounded border border-white/10 bg-slate-950/50 px-2 py-1 text-xs font-bold text-slate-400">{theme}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
