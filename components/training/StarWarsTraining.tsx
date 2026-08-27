"use client";

import { Chess, type Square } from "chess.js";
import { Chessboard, defaultPieces, type ChessboardOptions } from "react-chessboard";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BOARD_INTERACTION_OPTIONS, BOARD_MOTION_OPTIONS } from "@/chess/components/boardMotion";
import { useChessSounds } from "@/chess/hooks/useChessSounds";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import {
  attemptStarWarsMove,
  findStarWarsSolution,
  initialStarWarsState,
  starWarsPuzzleForScore,
  type StarWarsMove,
  type StarWarsState
} from "@/lib/puzzle-training/starWars";

type RunPhase = "playing" | "solved" | "failed";
type BoardArrow = { startSquare: string; endSquare: string; color: string };

const BEST_SCORE_STORAGE_KEY = "academy-star-wars-best-score:v1";
const NEXT_MISSION_DELAY_MS = 450;
const PLAN_ARROW_COLOR = "#c084fc";
const WRONG_MOVE_COLOR = "#fb7185";
const STAR_SVG = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M50 6 61.8 35.8 94 37.8 69.2 58.4 77.2 89.6 50 72.4 22.8 89.6 30.8 58.4 6 37.8 38.2 35.8Z' fill='%23fde047' stroke='%23fff7b3' stroke-width='7' stroke-linejoin='round'/%3E%3C/svg%3E\")";

const pieceNames = {
  b: "bishop",
  k: "king",
  n: "knight",
  q: "queen",
  r: "rook"
} as const;

function HiddenBoardPiece() {
  return <span aria-hidden="true" className="block h-full w-full opacity-0" />;
}

function legalDestinations(fen: string, square: Square) {
  const chess = new Chess(fen);
  return chess.moves({ square, verbose: true }).map((move) => move.to);
}

function routeLabel(route: readonly StarWarsMove[]) {
  return route.map((move) => `${move.from}→${move.to}`).join(" · ");
}

function randomRunVariant() {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const seed = new Uint32Array(1);
    globalThis.crypto.getRandomValues(seed);
    return seed[0] ?? 0;
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function StarWarsTraining({ onExit }: { onExit: () => void }) {
  const [runVariant, setRunVariant] = useState(randomRunVariant);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [puzzle, setPuzzle] = useState(() => starWarsPuzzleForScore(0, runVariant));
  const [gameState, setGameState] = useState<StarWarsState>(() => initialStarWarsState(puzzle));
  const [phase, setPhase] = useState<RunPhase>("playing");
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [failedMove, setFailedMove] = useState<StarWarsMove | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalSquares, setLegalSquares] = useState<Square[]>([]);
  const [planMode, setPlanMode] = useState(false);
  const [planStart, setPlanStart] = useState<Square | null>(null);
  const [planArrows, setPlanArrows] = useState<BoardArrow[]>([]);
  const [feedback, setFeedback] = useState("Plan the entire route before moving. Every move must land on a star.");
  const [failureRoute, setFailureRoute] = useState<StarWarsMove[]>([]);
  const nextMissionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { play: playSound, prepare: prepareSound } = useChessSounds();

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY));
      if (Number.isInteger(saved) && saved > 0) setBestScore(saved);
    } catch {
      // Storage can be unavailable in private browsing; the run still works.
    }
  }, []);

  useEffect(() => () => {
    if (nextMissionTimer.current) clearTimeout(nextMissionTimer.current);
  }, []);

  const customPieces = useMemo(() => ({
    ...defaultPieces,
    ...Object.fromEntries(puzzle.hiddenPieceTypes.map((pieceType) => [pieceType, HiddenBoardPiece]))
  }), [puzzle.hiddenPieceTypes]);

  function clearPlanning() {
    setPlanArrows([]);
    setPlanStart(null);
  }

  function loadMission(nextScore: number, variant: number, celebrateScore = false) {
    const nextPuzzle = starWarsPuzzleForScore(nextScore, variant);
    setPuzzle(nextPuzzle);
    setGameState(initialStarWarsState(nextPuzzle));
    setPhase("playing");
    setLastMove(null);
    setFailedMove(null);
    setSelectedSquare(null);
    setLegalSquares([]);
    setPlanMode(false);
    setPlanStart(null);
    setPlanArrows([]);
    setFailureRoute([]);
    setFeedback(celebrateScore
      ? `+1 point! Score ${nextScore}. Plan a ${nextPuzzle.stars.length}-move route and collect one star on every move.`
      : `Plan a ${nextPuzzle.stars.length}-move route. Collect one star on every move.`);
  }

  function saveBest(nextScore: number) {
    if (nextScore <= bestScore) return;
    setBestScore(nextScore);
    try {
      window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(nextScore));
    } catch {
      // A blocked preference write must never interrupt the game.
    }
  }

  function move(from: string, to: string) {
    if (phase !== "playing") return false;
    prepareSound();
    const attemptedMove = { from: from as Square, to: to as Square };
    const result = attemptStarWarsMove(gameState, attemptedMove);
    if (result.status === "illegal") return false;

    setSelectedSquare(null);
    setLegalSquares([]);
    setPlanMode(false);
    setPlanStart(null);

    if (result.status === "failed") {
      setFailedMove(attemptedMove);
      setFailureRoute(findStarWarsSolution(gameState) ?? []);
      setPhase("failed");
      setFeedback("That move did not collect a star, so the run is over.");
      return false;
    }

    setGameState(result.state);
    setLastMove([result.move.from, result.move.to]);
    clearPlanning();
    playSound("capture");

    if (result.status === "solved") {
      const nextScore = score + 1;
      setScore(nextScore);
      saveBest(nextScore);
      setPhase("solved");
      setFeedback(`Perfect route! +1 point. Score ${nextScore}. Loading the next mission...`);
      playSound("end");
      if (nextMissionTimer.current) clearTimeout(nextMissionTimer.current);
      nextMissionTimer.current = setTimeout(() => {
        nextMissionTimer.current = null;
        loadMission(nextScore, runVariant, true);
      }, NEXT_MISSION_DELAY_MS);
      return true;
    }

    setFeedback(`${result.state.remainingStars.length} ${result.state.remainingStars.length === 1 ? "star" : "stars"} left. Keep following your plan.`);
    return true;
  }

  function handlePlanSquare(square: Square) {
    if (!planStart) {
      setPlanStart(square);
      setFeedback("Plan started. Tap the destination square for your arrow.");
      return;
    }
    if (planStart === square) {
      setPlanStart(null);
      setFeedback("Plan arrow canceled.");
      return;
    }
    const arrow = { startSquare: planStart, endSquare: square, color: PLAN_ARROW_COLOR };
    setPlanArrows((current) => current.some((item) => item.startSquare === arrow.startSquare && item.endSquare === arrow.endSquare)
      ? current.filter((item) => !(item.startSquare === arrow.startSquare && item.endSquare === arrow.endSquare))
      : [...current, arrow]);
    setPlanStart(null);
    setFeedback("Arrow added. Map the rest of your route, or turn off Plan mode to move.");
  }

  function handleSquareClick(square: Square) {
    if (phase !== "playing") return;
    if (planMode) {
      handlePlanSquare(square);
      return;
    }
    if (selectedSquare && legalSquares.includes(square)) {
      move(selectedSquare, square);
      return;
    }
    if (gameState.movableSquares.includes(square)) {
      setSelectedSquare(square);
      setLegalSquares(legalDestinations(gameState.fen, square));
      return;
    }
    setSelectedSquare(null);
    setLegalSquares([]);
  }

  function startNewRun() {
    let nextVariant = randomRunVariant();
    if (nextVariant === runVariant) nextVariant = (nextVariant + 1) >>> 0;
    setRunVariant(nextVariant);
    setScore(0);
    loadMission(0, nextVariant);
  }

  const movesUsed = puzzle.stars.length - gameState.remainingStars.length;
  const learnerPieces = [...new Set(puzzle.pieces.map((piece) => pieceNames[piece.type]))];
  const arrows: BoardArrow[] = [
    ...planArrows,
    ...(failedMove ? [{ startSquare: failedMove.from, endSquare: failedMove.to, color: WRONG_MOVE_COLOR }] : [])
  ];

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    for (const square of lastMove ?? []) {
      styles[square] = { backgroundColor: "rgba(34,211,238,.25)", boxShadow: "inset 0 0 0 4px rgba(103,232,249,.75)" };
    }
    for (const square of legalSquares) {
      styles[square] = { ...styles[square], backgroundImage: "radial-gradient(circle, rgba(15,23,42,.62) 0 16%, transparent 19%)" };
    }
    for (const square of gameState.remainingStars) {
      styles[square] = {
        ...styles[square],
        backgroundImage: `${STAR_SVG}, radial-gradient(circle, rgba(250,204,21,.34) 0 42%, transparent 66%)`,
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
        backgroundSize: "56% 56%, 100% 100%",
        boxShadow: "inset 0 0 0 3px rgba(254,240,138,.65), 0 0 18px rgba(250,204,21,.5)"
      };
    }
    if (selectedSquare) {
      styles[selectedSquare] = { ...styles[selectedSquare], backgroundColor: "rgba(34,211,238,.28)", boxShadow: "inset 0 0 0 5px rgba(103,232,249,.95)" };
    }
    if (planStart) {
      styles[planStart] = { ...styles[planStart], backgroundColor: "rgba(192,132,252,.28)", boxShadow: "inset 0 0 0 5px rgba(216,180,254,.95)" };
    }
    if (failedMove) {
      styles[failedMove.to] = { ...styles[failedMove.to], boxShadow: "inset 0 0 0 5px rgba(251,113,133,.95)" };
    }
    return styles;
  }, [failedMove, gameState.remainingStars, lastMove, legalSquares, planStart, selectedSquare]);

  const boardOptions: ChessboardOptions = {
    id: `academy-star-wars-${puzzle.id}`,
    position: gameState.fen,
    pieces: customPieces,
    boardOrientation: "white",
    showNotation: true,
    ...BOARD_MOTION_OPTIONS,
    ...BOARD_INTERACTION_OPTIONS,
    allowDragging: phase === "playing" && !planMode,
    allowDrawingArrows: phase === "playing",
    arrows,
    arrowOptions: {
      color: PLAN_ARROW_COLOR,
      secondaryColor: WRONG_MOVE_COLOR,
      tertiaryColor: "#60a5fa",
      opacity: 0.72,
      activeOpacity: 0.55,
      arrowWidthDenominator: 5,
      activeArrowWidthMultiplier: 0.9,
      arrowLengthReducerDenominator: 8,
      sameTargetArrowLengthReducerDenominator: 4,
      arrowStartOffset: 0
    },
    clearArrowsOnClick: false,
    clearArrowsOnPositionChange: false,
    onArrowsChange: ({ arrows: nextArrows }) => setPlanArrows(nextArrows.map((arrow) => ({ ...arrow, color: arrow.color || PLAN_ARROW_COLOR }))),
    squareStyles,
    lightSquareStyle: { backgroundColor: "#cffafe" },
    darkSquareStyle: { backgroundColor: "#0e7490" },
    boardStyle: { borderRadius: 10, touchAction: "none", boxShadow: "0 0 46px rgba(139,92,246,.25)" },
    canDragPiece: ({ piece, square }) => phase === "playing"
      && !planMode
      && piece.pieceType.startsWith("w")
      && square !== null
      && gameState.movableSquares.includes(square as Square),
    onSquareClick: ({ square }) => handleSquareClick(square as Square),
    onPieceDrop: ({ sourceSquare, targetSquare }) => {
      if (!targetSquare || phase !== "playing" || planMode) return false;
      if (!gameState.movableSquares.includes(sourceSquare as Square)) return false;
      if (!legalDestinations(gameState.fen, sourceSquare as Square).includes(targetSquare as Square)) return false;
      return move(sourceSquare, targetSquare);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-violet-300/25">
        <div className="grid grid-cols-4 divide-x divide-white/10">
          {[
            ["Score", score],
            ["Best", bestScore],
            ["Mission", score + 1],
            ["Stars", `${puzzle.stars.length - gameState.remainingStars.length}/${puzzle.stars.length}`]
          ].map(([label, value]) => (
            <div key={String(label)} className="p-3 text-center sm:p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
              <p className="mt-1 text-xl font-black text-white sm:text-2xl">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,640px)_minmax(280px,1fr)]">
        <div className="mx-auto aspect-square w-full max-w-[640px] overflow-hidden rounded-xl border border-violet-200/25 bg-slate-950/80 p-1 sm:p-2">
          <Chessboard key={`star-wars-board-${puzzle.id}-${runVariant}`} options={boardOptions} />
        </div>

        <aside className="space-y-4">
          <Card className="overflow-hidden border-violet-300/25">
            <div className="border-b border-white/10 bg-gradient-to-r from-violet-400/10 via-cyan-300/5 to-transparent p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">Star Wars · Level {puzzle.tier}</p>
                <span className="rounded-full border border-rose-200/25 bg-rose-300/10 px-3 py-1 text-xs font-black text-rose-100">1 mistake ends the run</span>
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">{puzzle.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{puzzle.briefing}</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-amber-200/20 bg-amber-300/5 p-3">
                  <p className="text-xs font-black uppercase text-amber-200">Perfect route</p>
                  <p className="mt-1 text-lg font-black text-white">{puzzle.stars.length} stars · {puzzle.stars.length} moves</p>
                </div>
                <div className="rounded-lg border border-cyan-200/20 bg-cyan-300/5 p-3">
                  <p className="text-xs font-black uppercase text-cyan-200">Your pieces</p>
                  <p className="mt-1 text-sm font-black capitalize text-white">{learnerPieces.join(" + ")}</p>
                </div>
              </div>
              <div className={`mt-4 rounded-lg border p-4 text-sm font-bold leading-6 ${phase === "failed" ? "border-rose-300/35 bg-rose-300/10 text-rose-100" : phase === "solved" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/5 text-slate-200"}`} role="status" aria-live="polite" aria-atomic="true">
                {feedback}
              </div>
              <p className="mt-3 text-xs font-bold text-slate-500">Move {Math.min(movesUsed + 1, puzzle.stars.length)} of {puzzle.stars.length} · The run ends only when a legal move does not collect a star.</p>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-black uppercase tracking-wider text-violet-200">Plan before you move</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Right-drag to draw arrows, or use Plan mode to tap each arrow's start and end squares.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant={planMode ? "primary" : "secondary"} onClick={() => {
                setPlanMode((enabled) => !enabled);
                setPlanStart(null);
                setSelectedSquare(null);
                setLegalSquares([]);
                setFeedback(planMode ? "Plan mode off. Make your first move when the route is ready." : "Plan mode on. Tap an arrow's start square, then its destination.");
              }} disabled={phase !== "playing"}>{planMode ? "Finish Planning" : "Plan Route"}</Button>
              <Button type="button" variant="ghost" onClick={clearPlanning} disabled={!planArrows.length && !planStart}>Clear Plan</Button>
            </div>
          </Card>

          <Button type="button" variant="ghost" className="w-full" onClick={onExit}>Back to Training Modes</Button>
        </aside>
      </div>

      {phase === "failed" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="star-wars-failed-title">
          <div className="w-full max-w-lg rounded-3xl border border-rose-200/35 bg-gradient-to-br from-slate-900 via-rose-950/75 to-slate-950 p-6 text-center shadow-[0_0_80px_rgba(251,113,133,.2)] sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-200">Run Over</p>
            <h3 id="star-wars-failed-title" className="mt-3 text-3xl font-black text-white">Final score: {score}</h3>
            <p className="mt-3 text-sm font-bold leading-6 text-rose-100">{feedback}</p>
            {failureRoute.length > 0 && (
              <div className="mt-5 rounded-xl border border-cyan-200/25 bg-cyan-300/5 p-4 text-left">
                <p className="text-xs font-black uppercase tracking-wide text-cyan-200">One perfect route</p>
                <p className="mt-2 break-words text-sm font-bold leading-6 text-white">{routeLabel(failureRoute)}</p>
              </div>
            )}
            <p className="mt-4 text-sm leading-6 text-slate-300">Look at the full route, remember the plan, and launch a fresh run.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button type="button" onClick={startNewRun}>Start New Run</Button>
              <Button type="button" variant="ghost" onClick={onExit}>Training Modes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
