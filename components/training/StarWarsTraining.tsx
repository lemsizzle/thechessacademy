"use client";

import { type Square } from "chess.js";
import { Chessboard, defaultPieces, type ChessboardOptions } from "react-chessboard";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import {
  annotationColorForModifiers,
  toggleBoardArrow,
  toggleBoardCircle,
  type BoardArrow,
  type BoardCircle
} from "@/chess/components/boardAnnotations";
import { BOARD_INTERACTION_OPTIONS, BOARD_MOTION_OPTIONS } from "@/chess/components/boardMotion";
import { useChessSounds } from "@/chess/hooks/useChessSounds";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import {
  attemptStarWarsMove,
  findStarWarsSolution,
  initialStarWarsState,
  starWarsPuzzleForScore,
  starWarsLegalDestinations,
  type StarWarsMove,
  type StarWarsState
} from "@/lib/puzzle-training/starWars";
import {
  parseStoredStarWarsBestScore,
  STAR_WARS_BEST_SCORE_STORAGE_KEY
} from "@/lib/puzzle-training/starWarsProgress";

type RunPhase = "loading" | "playing" | "solved" | "failed" | "unavailable";
type ScoreSyncState = "idle" | "saving" | "saved" | "error";
type DrawingGesture = { startSquare: Square; endSquare: Square | null; color: string };
type StarWarsStartResponse = {
  run?: { runId: string; runVariant: number; score: number; personalBest: number };
  error?: string;
};
type StarWarsProgressResponse = {
  result?: { score: number; personalBest: number };
  error?: string;
};

const NEXT_MISSION_DELAY_MS = 450;
const ANNOTATION_ARROW_COLOR = "#c084fc";
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

function routeLabel(route: readonly StarWarsMove[]) {
  return route.map((move) => `${move.from}→${move.to}`).join(" · ");
}

export function StarWarsTraining({ onExit }: { onExit: () => void }) {
  const [runId, setRunId] = useState<string | null>(null);
  const [runVariant, setRunVariant] = useState(0);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [puzzle, setPuzzle] = useState(() => starWarsPuzzleForScore(0, 0));
  const [gameState, setGameState] = useState<StarWarsState>(() => initialStarWarsState(puzzle));
  const [phase, setPhase] = useState<RunPhase>("loading");
  const [scoreSyncState, setScoreSyncState] = useState<ScoreSyncState>("idle");
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [failedMove, setFailedMove] = useState<StarWarsMove | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalSquares, setLegalSquares] = useState<Square[]>([]);
  const [annotationArrows, setAnnotationArrows] = useState<BoardArrow[]>([]);
  const [annotationCircles, setAnnotationCircles] = useState<BoardCircle[]>([]);
  const [drawingGesture, setDrawingGesture] = useState<DrawingGesture | null>(null);
  const [feedback, setFeedback] = useState("Preparing a verified Star Wars run...");
  const [failureRoute, setFailureRoute] = useState<StarWarsMove[]>([]);
  const nextMissionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rightGestureRef = useRef<Omit<DrawingGesture, "endSquare"> | null>(null);
  const missionRouteRef = useRef<StarWarsMove[]>([]);
  const completedRoutesRef = useRef<StarWarsMove[][]>([]);
  const activeRunIdRef = useRef<string | null>(null);
  const latestSubmittedScoreRef = useRef(0);
  const latestSavedScoreRef = useRef(0);
  const mountedRef = useRef(true);
  const startRequestedRef = useRef(false);
  const { play: playSound, prepare: prepareSound } = useChessSounds();

  useEffect(() => {
    try {
      setBestScore(parseStoredStarWarsBestScore(window.localStorage.getItem(STAR_WARS_BEST_SCORE_STORAGE_KEY)));
    } catch {
      // Storage can be unavailable in private browsing; the run still works.
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!startRequestedRef.current) {
      startRequestedRef.current = true;
      void beginServerRun();
    }
    return () => {
      mountedRef.current = false;
      if (nextMissionTimer.current) clearTimeout(nextMissionTimer.current);
    };
  }, []);

  useEffect(() => {
    function cancelReleasedGesture(event: MouseEvent) {
      if (event.button !== 2 || !rightGestureRef.current) return;
      rightGestureRef.current = null;
      setDrawingGesture(null);
    }
    window.addEventListener("mouseup", cancelReleasedGesture);
    return () => window.removeEventListener("mouseup", cancelReleasedGesture);
  }, []);

  const customPieces = useMemo(() => ({
    ...defaultPieces,
    ...Object.fromEntries(puzzle.hiddenPieceTypes.map((pieceType) => [pieceType, HiddenBoardPiece]))
  }), [puzzle.hiddenPieceTypes]);

  function clearAnnotations() {
    setAnnotationArrows([]);
    setAnnotationCircles([]);
    setDrawingGesture(null);
    rightGestureRef.current = null;
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
    setAnnotationArrows([]);
    setAnnotationCircles([]);
    setDrawingGesture(null);
    rightGestureRef.current = null;
    missionRouteRef.current = [];
    setFailureRoute([]);
    setFeedback(celebrateScore
      ? `+1 point! Score ${nextScore}. Find a ${nextPuzzle.stars.length}-move route that keeps the next star reachable.`
      : `Find a ${nextPuzzle.stars.length}-move route. Keep another star reachable after every capture.`);
  }

  function saveBest(nextScore: number) {
    setBestScore((currentBest) => {
      if (nextScore <= currentBest) return currentBest;
      try {
        window.localStorage.setItem(STAR_WARS_BEST_SCORE_STORAGE_KEY, String(nextScore));
      } catch {
        // A blocked preference write must never interrupt the game.
      }
      return nextScore;
    });
  }

  async function beginServerRun() {
    if (nextMissionTimer.current) {
      clearTimeout(nextMissionTimer.current);
      nextMissionTimer.current = null;
    }
    setPhase("loading");
    activeRunIdRef.current = null;
    setScoreSyncState("idle");
    setFeedback("Preparing a verified Star Wars run...");
    try {
      const response = await fetch("/api/student/star-wars/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store"
      });
      const body = await response.json() as StarWarsStartResponse;
      if (!response.ok || !body.run) throw new Error(body.error ?? "Star Wars could not start.");
      if (!mountedRef.current) return;
      setRunId(body.run.runId);
      activeRunIdRef.current = body.run.runId;
      setRunVariant(body.run.runVariant);
      setScore(body.run.score);
      completedRoutesRef.current = [];
      missionRouteRef.current = [];
      latestSubmittedScoreRef.current = body.run.score;
      latestSavedScoreRef.current = body.run.score;
      saveBest(body.run.personalBest);
      loadMission(body.run.score, body.run.runVariant);
    } catch (error) {
      if (!mountedRef.current) return;
      setRunId(null);
      activeRunIdRef.current = null;
      setPhase("unavailable");
      setFeedback(error instanceof Error ? error.message : "Star Wars could not start.");
    }
  }

  async function submitProgress(routes: StarWarsMove[][], targetRunId: string) {
    const submittedScore = routes.length;
    const startScore = Math.min(latestSavedScoreRef.current, submittedScore);
    const pendingRoutes = routes.slice(startScore);
    if (!pendingRoutes.length) {
      setScoreSyncState("saved");
      return;
    }
    latestSubmittedScoreRef.current = Math.max(latestSubmittedScoreRef.current, submittedScore);
    setScoreSyncState("saving");
    try {
      const requestBody = JSON.stringify({ runId: targetRunId, startScore, routes: pendingRoutes });
      const response = await fetch("/api/student/star-wars/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        cache: "no-store",
        keepalive: requestBody.length < 60_000
      });
      const body = await response.json() as StarWarsProgressResponse;
      if (!response.ok || !body.result) throw new Error(body.error ?? "Score save failed.");
      if (!mountedRef.current || activeRunIdRef.current !== targetRunId) return;
      latestSavedScoreRef.current = Math.max(latestSavedScoreRef.current, body.result.score);
      saveBest(body.result.personalBest);
      if (latestSavedScoreRef.current >= latestSubmittedScoreRef.current) setScoreSyncState("saved");
    } catch {
      if (mountedRef.current
        && activeRunIdRef.current === targetRunId
        && latestSavedScoreRef.current < latestSubmittedScoreRef.current) {
        setScoreSyncState("error");
      }
    }
  }

  function move(from: string, to: string) {
    if (phase !== "playing") return false;
    prepareSound();
    const attemptedMove = { from: from as Square, to: to as Square };
    const result = attemptStarWarsMove(gameState, attemptedMove);
    clearAnnotations();
    if (result.status === "illegal") return false;

    if (result.status === "failed") {
      if (result.reason === "stranded") {
        setGameState(result.state);
        setLastMove([attemptedMove.from, attemptedMove.to]);
        playSound("capture");
      }
      setSelectedSquare(null);
      setLegalSquares([]);
      setFailedMove(attemptedMove);
      setFailureRoute(findStarWarsSolution(gameState) ?? []);
      setPhase("failed");
      setFeedback(result.reason === "stranded"
        ? "That star was captured, but no remaining star can be reached next. The run is over."
        : "That move did not collect a star, so the run is over.");
      return false;
    }

    const completedMove = result.move;
    setGameState(result.state);
    setLastMove([completedMove.from, completedMove.to]);
    playSound("capture");

    if (result.status === "solved") {
      setSelectedSquare(null);
      setLegalSquares([]);
      const nextScore = score + 1;
      const completedRoute = [...missionRouteRef.current, completedMove];
      const completedRoutes = [...completedRoutesRef.current, completedRoute];
      missionRouteRef.current = [];
      completedRoutesRef.current = completedRoutes;
      setScore(nextScore);
      saveBest(nextScore);
      if (runId) void submitProgress(completedRoutes, runId);
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

    missionRouteRef.current = [...missionRouteRef.current, completedMove];
    setSelectedSquare(result.move.to);
    setLegalSquares(starWarsLegalDestinations(result.state, result.move.to));
    setFeedback(`${result.state.remainingStars.length} ${result.state.remainingStars.length === 1 ? "star" : "stars"} left. Keep the next capture reachable.`);
    return true;
  }

  function handleSquareClick(square: Square) {
    if (phase !== "playing") return;
    clearAnnotations();
    if (selectedSquare && legalSquares.includes(square)) {
      move(selectedSquare, square);
      return;
    }
    if (gameState.movableSquares.includes(square)) {
      setSelectedSquare(square);
      setLegalSquares(starWarsLegalDestinations(gameState, square));
      return;
    }
    setSelectedSquare(null);
    setLegalSquares([]);
  }

  function handleBoardMouseDown(square: Square, event: ReactMouseEvent) {
    if (event.button === 0) clearAnnotations();
    if (event.button !== 2 || phase !== "playing") return;
    const gesture = { startSquare: square, color: annotationColorForModifiers(event) };
    rightGestureRef.current = gesture;
    setDrawingGesture({ ...gesture, endSquare: null });
  }

  function handleBoardMouseOver(square: Square) {
    const gesture = rightGestureRef.current;
    if (!gesture) return;
    setDrawingGesture({ ...gesture, endSquare: square === gesture.startSquare ? null : square });
  }

  function handleBoardMouseUp(square: Square, event: ReactMouseEvent) {
    if (event.button !== 2) return;
    const gesture = rightGestureRef.current;
    rightGestureRef.current = null;
    setDrawingGesture(null);
    if (!gesture) return;
    if (gesture.startSquare === square) {
      setAnnotationCircles((current) => toggleBoardCircle(current, { square, color: gesture.color }));
      return;
    }
    setAnnotationArrows((current) => toggleBoardArrow(current, {
      startSquare: gesture.startSquare,
      endSquare: square,
      color: gesture.color
    }));
  }

  function startNewRun() {
    void beginServerRun();
  }

  const movesUsed = puzzle.stars.length - gameState.remainingStars.length;
  const learnerPieceCounts = new Map<string, number>();
  for (const piece of puzzle.pieces) {
    const name = pieceNames[piece.type];
    learnerPieceCounts.set(name, (learnerPieceCounts.get(name) ?? 0) + 1);
  }
  const learnerPieces = [...learnerPieceCounts].map(([name, count]) => count === 1 ? name : `${count} ${name}s`);
  const previewArrow = drawingGesture?.endSquare ? {
    startSquare: drawingGesture.startSquare,
    endSquare: drawingGesture.endSquare,
    color: drawingGesture.color
  } : null;
  const arrows: BoardArrow[] = [
    ...annotationArrows,
    ...(previewArrow ? [previewArrow] : []),
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
    if (failedMove) {
      styles[failedMove.to] = { ...styles[failedMove.to], boxShadow: "inset 0 0 0 5px rgba(251,113,133,.95)" };
    }
    for (const circle of annotationCircles) {
      const existingBackground = styles[circle.square]?.backgroundImage;
      const existingPosition = styles[circle.square]?.backgroundPosition;
      const existingRepeat = styles[circle.square]?.backgroundRepeat;
      const existingSize = styles[circle.square]?.backgroundSize;
      const circleLayer = `radial-gradient(circle, transparent 0 49%, ${circle.color} 52% 61%, transparent 64%)`;
      styles[circle.square] = {
        ...styles[circle.square],
        backgroundImage: existingBackground ? `${circleLayer}, ${existingBackground}` : circleLayer,
        backgroundPosition: existingBackground ? `center, ${existingPosition ?? "center"}` : "center",
        backgroundRepeat: existingBackground ? `no-repeat, ${existingRepeat ?? "no-repeat"}` : "no-repeat",
        backgroundSize: existingBackground ? `100% 100%, ${existingSize ?? "100% 100%"}` : "100% 100%"
      };
    }
    return styles;
  }, [annotationCircles, failedMove, gameState.remainingStars, lastMove, legalSquares, selectedSquare]);

  const boardOptions: ChessboardOptions = {
    id: `academy-star-wars-${puzzle.id}`,
    position: gameState.fen,
    pieces: customPieces,
    boardOrientation: "white",
    showNotation: true,
    ...BOARD_MOTION_OPTIONS,
    ...BOARD_INTERACTION_OPTIONS,
    allowDragging: phase === "playing",
    allowDrawingArrows: false,
    arrows,
    arrowOptions: {
      color: ANNOTATION_ARROW_COLOR,
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
    clearArrowsOnClick: true,
    clearArrowsOnPositionChange: true,
    squareStyles,
    lightSquareStyle: { backgroundColor: "#cffafe" },
    darkSquareStyle: { backgroundColor: "#0e7490" },
    boardStyle: { borderRadius: 10, touchAction: "none", boxShadow: "0 0 46px rgba(139,92,246,.25)" },
    canDragPiece: ({ piece, square }) => phase === "playing"
      && piece.pieceType.startsWith("w")
      && square !== null
      && gameState.movableSquares.includes(square as Square),
    onSquareClick: ({ square }) => handleSquareClick(square as Square),
    onSquareMouseDown: ({ square }, event) => handleBoardMouseDown(square as Square, event),
    onMouseOverSquare: ({ square }) => handleBoardMouseOver(square as Square),
    onSquareMouseUp: ({ square }, event) => handleBoardMouseUp(square as Square, event),
    onPieceDrop: ({ sourceSquare, targetSquare }) => {
      if (!targetSquare || phase !== "playing") return false;
      if (!gameState.movableSquares.includes(sourceSquare as Square)) return false;
      if (!starWarsLegalDestinations(gameState, sourceSquare as Square).includes(targetSquare as Square)) return false;
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

      {phase === "unavailable" ? (
        <Card className="border-rose-300/35 bg-rose-300/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <div>
              <p className="font-black text-rose-100">Star Wars could not start</p>
              <p className="mt-1 text-sm text-rose-100/80">{feedback}</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => void beginServerRun()}>Try Again</Button>
          </div>
        </Card>
      ) : null}

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
              {scoreSyncState === "error" ? (
                <div className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-200/30 bg-amber-300/10 p-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
                  <p className="text-sm font-bold text-amber-100">Your run is safe here, but the leaderboard save needs another try.</p>
                  <Button type="button" variant="secondary" onClick={() => {
                    if (runId && completedRoutesRef.current.length) {
                      void submitProgress(completedRoutesRef.current, runId);
                    }
                  }}>Retry Save</Button>
                </div>
              ) : scoreSyncState === "saving" ? (
                <p className="mt-3 text-xs font-bold text-cyan-100" role="status">Saving your leaderboard score...</p>
              ) : scoreSyncState === "saved" ? (
                <p className="mt-3 text-xs font-bold text-emerald-200" role="status">Leaderboard score saved.</p>
              ) : null}
              <p className="mt-3 text-xs font-bold text-slate-500">Move {Math.min(movesUsed + 1, puzzle.stars.length)} of {puzzle.stars.length} · Missing a star or leaving no reachable star ends the run.</p>
              <p className="mt-2 text-xs text-slate-500">Right-drag to draw arrows or right-click to circle a square. A normal board click clears your marks.</p>
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
