"use client";

import { defaultPieces } from "react-chessboard";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import { annotationColorForModifiers, toggleBoardArrow, type BoardArrow } from "@/chess/components/boardAnnotations";
import { useOutsideBoardAnnotationClear } from "@/chess/hooks/useOutsideBoardAnnotationClear";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type {
  HideAndSeekPieceCode,
  HideAndSeekPiecePlacement,
  HideAndSeekSquare
} from "@/lib/puzzle-training/hideAndSeek";

export type HideAndSeekSearchPhase = "ready" | "preparing" | "searching" | "finishing" | "restart-required" | "result";

type ActiveSearchRound = {
  id: string;
  pieces: HideAndSeekPiecePlacement[];
  startedAt: string;
  expiresAt: string;
};

type SearchResult = {
  score: number;
  totalSafe: number;
  correctCount: number;
  wrongCount: number;
  foundPercent: number;
  elapsedMs: number;
  personalBest: number;
  completedAt: string;
  correctSquares: HideAndSeekSquare[];
  wrongSquares: HideAndSeekSquare[];
  missedSquares: HideAndSeekSquare[];
  safeSquares: HideAndSeekSquare[];
};

type StartResponse = {
  round: ActiveSearchRound;
  token: string;
  serverReceivedAt: string;
  serverSentAt: string;
};
type FinishResponse = { result: SearchResult };

export type HideAndSeekCompletion = Pick<
  SearchResult,
  "personalBest" | "foundPercent" | "wrongCount" | "elapsedMs" | "completedAt"
>;

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
const BOARD_SQUARES = RANKS.flatMap((rank) => FILES.map((file) => `${file}${rank}` as HideAndSeekSquare));
const BOARD_SQUARE_INDEX = new Map(BOARD_SQUARES.map((square, index) => [square, index]));

export function hideAndSeekArrowLine(arrow: Pick<BoardArrow, "startSquare" | "endSquare">) {
  const center = (square: string) => {
    const file = FILES.indexOf(square[0] as (typeof FILES)[number]);
    const rank = Number(square[1]);
    return { x: (file + 0.5) * 12.5, y: (8 - rank + 0.5) * 12.5 };
  };
  const start = center(arrow.startSquare);
  const target = center(arrow.endSquare);
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const distance = Math.hypot(dx, dy) || 1;
  return {
    x1: start.x,
    y1: start.y,
    x2: target.x - (dx / distance) * 4,
    y2: target.y - (dy / distance) * 4
  };
}

const PIECE_NAMES: Record<HideAndSeekPieceCode, string> = {
  bK: "black king",
  bQ: "black queen",
  bR: "black rook",
  bB: "black bishop",
  bN: "black knight"
};

function formatDuration(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function isLightSquare(index: number) {
  const row = Math.floor(index / 8);
  const column = index % 8;
  return (row + column) % 2 === 0;
}

function errorMessage(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  return fallback;
}

function monotonicEpochNow() {
  return performance.timeOrigin + performance.now();
}

export function canMarkHideAndSeekBoard(phase: HideAndSeekSearchPhase) {
  return phase === "searching";
}

export function canScoreHideAndSeekBoard(input: {
  phase: HideAndSeekSearchPhase;
  token: string;
  selectedCount: number;
}) {
  return input.phase === "searching" && input.token.length > 0 && input.selectedCount > 0;
}

export function isTerminalHideAndSeekFinishFailure(status: number) {
  return status === 401;
}

export function hideAndSeekRevealDelay(startedAt: string, nowMs: number) {
  const startMs = Date.parse(startedAt);
  return Number.isFinite(startMs) ? Math.max(0, startMs - nowMs) : null;
}

export function hideAndSeekSynchronizedStartOffset(input: {
  startedAt: string;
  serverReceivedAt: string;
  serverSentAt: string;
  requestStartedAt: number;
  responseReceivedAt: number;
}) {
  const startedAt = Date.parse(input.startedAt);
  const serverReceivedAt = Date.parse(input.serverReceivedAt);
  const serverSentAt = Date.parse(input.serverSentAt);
  if (!Number.isFinite(startedAt)
    || !Number.isFinite(serverReceivedAt)
    || !Number.isFinite(serverSentAt)
    || !Number.isFinite(input.requestStartedAt)
    || !Number.isFinite(input.responseReceivedAt)
    || serverSentAt < serverReceivedAt
    || input.responseReceivedAt < input.requestStartedAt) return null;

  // NTP's four-timestamp offset removes both device-clock skew and the time
  // spent authenticating/generating the board on the server.
  const clockOffset = (
    (serverReceivedAt - input.requestStartedAt)
    + (serverSentAt - input.responseReceivedAt)
  ) / 2;
  const estimatedServerAtResponse = input.responseReceivedAt + clockOffset;
  return startedAt - estimatedServerAtResponse;
}

function BoardPiece({ piece, square }: { piece: HideAndSeekPieceCode; square: HideAndSeekSquare }) {
  const Piece = defaultPieces[piece];
  if (!Piece) return <span className="text-xs font-black text-slate-950">{piece.slice(1)}</span>;
  return (
    <span className="pointer-events-none grid h-[88%] w-[88%] place-items-center drop-shadow-[0_3px_2px_rgba(255,255,255,0.18)]" aria-hidden="true">
      <Piece square={square} svgStyle={{ width: "100%", height: "100%" }} />
    </span>
  );
}

function CoveredBoard() {
  return (
    <div
      className="relative aspect-square overflow-hidden rounded-xl border border-emerald-200/25 bg-slate-950 p-1 shadow-[0_0_48px_rgba(52,211,153,.14)] sm:p-2"
      role="img"
      aria-label="Covered chessboard. Press Start Search to reveal the pieces and begin the timer."
    >
      <div className="grid h-full grid-rows-8 overflow-hidden rounded-lg" aria-hidden="true">
        {RANKS.map((rank, row) => (
          <div key={rank} className="grid grid-cols-8">
            {FILES.map((file, column) => (
              <div
                key={`${file}${rank}`}
                className={`grid place-items-center text-[clamp(.85rem,3vw,2rem)] font-black ${isLightSquare(row * 8 + column) ? "bg-cyan-100/15 text-cyan-100/20" : "bg-cyan-800/25 text-cyan-100/15"}`}
              >
                ?
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-slate-950/42 p-6 text-center backdrop-blur-[2px]">
        <div className="rounded-2xl border border-emerald-200/25 bg-slate-950/90 px-5 py-4 shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Board hidden</p>
          <p className="mt-1 text-sm font-bold text-white">The clock starts when the pieces appear.</p>
        </div>
      </div>
    </div>
  );
}

function squareLabel({
  square,
  piece,
  marked,
  phase,
  correct,
  wrong,
  missed
}: {
  square: HideAndSeekSquare;
  piece?: HideAndSeekPieceCode;
  marked: boolean;
  phase: HideAndSeekSearchPhase;
  correct: boolean;
  wrong: boolean;
  missed: boolean;
}) {
  if (piece) return `${square}: ${PIECE_NAMES[piece]}, cannot be marked`;
  if (phase === "result") {
    if (correct) return `${square}: safe square found`;
    if (wrong) return `${square}: wrong guess, this square is seen`;
    if (missed) return `${square}: safe square missed`;
    return `${square}: seen square`;
  }
  return marked ? `${square}: marked as safe` : `${square}: empty, not marked`;
}

function SearchBoard({
  round,
  phase,
  selectedSquares,
  result,
  arrows,
  onToggle,
  onArrowsChange
}: {
  round: ActiveSearchRound;
  phase: HideAndSeekSearchPhase;
  selectedSquares: ReadonlySet<HideAndSeekSquare>;
  result: SearchResult | null;
  arrows: BoardArrow[];
  onToggle: (square: HideAndSeekSquare) => void;
  onArrowsChange: (arrows: BoardArrow[]) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewArrow, setPreviewArrow] = useState<BoardArrow | null>(null);
  const squareRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const drawingRef = useRef<{ startSquare: HideAndSeekSquare; color: string } | null>(null);
  const boardRef = useOutsideBoardAnnotationClear(() => onArrowsChange([]));
  const pieceBySquare = useMemo(
    () => new Map(round.pieces.map((placement) => [placement.square, placement.piece])),
    [round.pieces]
  );
  const correctSquares = useMemo(() => new Set(result?.correctSquares ?? []), [result?.correctSquares]);
  const wrongSquares = useMemo(() => new Set(result?.wrongSquares ?? []), [result?.wrongSquares]);
  const missedSquares = useMemo(() => new Set(result?.missedSquares ?? []), [result?.missedSquares]);

  useEffect(() => {
    if (!canMarkHideAndSeekBoard(phase)) return;
    const firstEmptyIndex = BOARD_SQUARES.findIndex((square) => !pieceBySquare.has(square));
    const nextIndex = firstEmptyIndex < 0 ? 0 : firstEmptyIndex;
    setActiveIndex(nextIndex);
    const frame = window.requestAnimationFrame(() => squareRefs.current[nextIndex]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [phase, pieceBySquare]);

  useEffect(() => {
    function cancelDrawing(event: MouseEvent) {
      if (event.button !== 2) return;
      drawingRef.current = null;
      setPreviewArrow(null);
    }
    window.addEventListener("mouseup", cancelDrawing);
    return () => window.removeEventListener("mouseup", cancelDrawing);
  }, []);

  function startArrow(square: HideAndSeekSquare, event: ReactMouseEvent<HTMLButtonElement>) {
    if (event.button !== 2) return;
    event.preventDefault();
    drawingRef.current = { startSquare: square, color: annotationColorForModifiers(event) };
    setPreviewArrow(null);
  }

  function previewArrowTo(square: HideAndSeekSquare) {
    const drawing = drawingRef.current;
    if (!drawing || drawing.startSquare === square) {
      setPreviewArrow(null);
      return;
    }
    setPreviewArrow({ ...drawing, endSquare: square });
  }

  function finishArrow(square: HideAndSeekSquare, event: ReactMouseEvent<HTMLButtonElement>) {
    if (event.button !== 2) return;
    event.preventDefault();
    const drawing = drawingRef.current;
    drawingRef.current = null;
    setPreviewArrow(null);
    if (!drawing || drawing.startSquare === square) return;
    onArrowsChange(toggleBoardArrow(arrows, { ...drawing, endSquare: square }));
  }

  const visibleArrows = [...arrows, ...(previewArrow ? [previewArrow] : [])];

  function moveFocus(index: number, key: string) {
    const row = Math.floor(index / 8);
    const column = index % 8;
    let nextIndex = index;
    if (key === "ArrowLeft") nextIndex = row * 8 + Math.max(0, column - 1);
    if (key === "ArrowRight") nextIndex = row * 8 + Math.min(7, column + 1);
    if (key === "ArrowUp") nextIndex = Math.max(0, index - 8);
    if (key === "ArrowDown") nextIndex = Math.min(63, index + 8);
    if (key === "Home") nextIndex = row * 8;
    if (key === "End") nextIndex = row * 8 + 7;
    if (nextIndex === index) return;
    setActiveIndex(nextIndex);
    squareRefs.current[nextIndex]?.focus();
  }

  function handleSquareKeyDown(event: KeyboardEvent<HTMLButtonElement>, square: HideAndSeekSquare, index: number) {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      moveFocus(index, event.key);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && canMarkHideAndSeekBoard(phase)) {
      event.preventDefault();
      onToggle(square);
    }
  }

  return (
    <div ref={boardRef} className="aspect-square w-full overflow-hidden rounded-xl border border-emerald-200/25 bg-slate-950 p-1 shadow-[0_0_48px_rgba(52,211,153,.16)] sm:p-2">
      <div className="relative grid h-full grid-rows-8 overflow-hidden rounded-lg" role="grid" aria-label="Hide and Seek chessboard">
        {RANKS.map((rank, row) => (
          <div key={rank} className="grid grid-cols-8" role="row">
            {FILES.map((file, column) => {
              const square = `${file}${rank}` as HideAndSeekSquare;
              const index = BOARD_SQUARE_INDEX.get(square) ?? row * 8 + column;
              const piece = pieceBySquare.get(square);
              const marked = selectedSquares.has(square);
              const correct = correctSquares.has(square);
              const wrong = wrongSquares.has(square);
              const missed = missedSquares.has(square);
              const canToggle = canMarkHideAndSeekBoard(phase) && !piece;
              const light = isLightSquare(index);
              const resultClass = correct
                ? "ring-inset ring-4 ring-emerald-300 bg-emerald-500/45"
                : wrong
                  ? "ring-inset ring-4 ring-rose-400 bg-rose-500/45"
                  : missed
                    ? "ring-inset ring-4 ring-amber-300 bg-amber-300/20"
                    : "";

              return (
                <button
                  key={square}
                  ref={(node) => { squareRefs.current[index] = node; }}
                  type="button"
                  role="gridcell"
                  aria-label={squareLabel({ square, piece, marked, phase, correct, wrong, missed })}
                  aria-selected={phase === "result" ? correct : marked}
                  aria-disabled={!canToggle}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => onToggle(square)}
                  onKeyDown={(event) => handleSquareKeyDown(event, square, index)}
                  onMouseDown={(event) => startArrow(square, event)}
                  onMouseEnter={() => previewArrowTo(square)}
                  onMouseUp={(event) => finishArrow(square, event)}
                  onContextMenu={(event) => event.preventDefault()}
                  className={`relative grid min-h-0 min-w-0 place-items-center overflow-hidden ring-0 transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-violet-300 ${light ? "bg-cyan-100" : "bg-cyan-700"} ${resultClass} ${canToggle ? "cursor-pointer hover:brightness-110 active:brightness-95" : "cursor-default"}`}
                >
                  {piece ? <BoardPiece piece={piece} square={square} /> : null}
                  {!piece && marked && phase !== "result" ? (
                    <span aria-hidden="true" className="text-[clamp(1rem,6vw,3.4rem)] leading-none text-amber-300 drop-shadow-[0_0_10px_rgba(253,224,71,.8)]">★</span>
                  ) : null}
                  {!piece && correct ? (
                    <span aria-hidden="true" className="text-[clamp(1rem,6vw,3.4rem)] leading-none text-emerald-100 drop-shadow-[0_0_10px_rgba(52,211,153,.9)]">★</span>
                  ) : null}
                  {!piece && wrong ? (
                    <span aria-hidden="true" className="text-[clamp(1rem,6vw,3.4rem)] leading-none text-rose-100 drop-shadow-[0_0_10px_rgba(251,113,133,.9)]">×</span>
                  ) : null}
                  {column === 0 ? <span aria-hidden="true" className="absolute left-1 top-0.5 text-[clamp(.45rem,1.4vw,.72rem)] font-black text-amber-900/70">{rank}</span> : null}
                  {row === 7 ? <span aria-hidden="true" className="absolute bottom-0.5 right-1 text-[clamp(.45rem,1.4vw,.72rem)] font-black text-amber-900/70">{file}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
        {visibleArrows.length ? (
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              {visibleArrows.map((arrow, index) => (
                <marker key={`marker-${index}`} id={`hide-and-seek-arrow-${index}`} markerWidth="4" markerHeight="4" refX="3.2" refY="2" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L4,2 L0,4 Z" fill={arrow.color} />
                </marker>
              ))}
            </defs>
            {visibleArrows.map((arrow, index) => {
              const line = hideAndSeekArrowLine(arrow);
              return <line key={`${arrow.startSquare}-${arrow.endSquare}-${arrow.color}-${index}`} {...line} stroke={arrow.color} strokeWidth="2.2" strokeLinecap="round" opacity="0.78" markerEnd={`url(#hide-and-seek-arrow-${index})`} />;
            })}
          </svg>
        ) : null}
      </div>
    </div>
  );
}

export function HideAndSeekTraining({
  onExit,
  initialBestScore = 0,
  onComplete
}: {
  onExit: () => void;
  initialBestScore?: number;
  onComplete?: (completion: HideAndSeekCompletion) => void;
}) {
  const [phase, setPhase] = useState<HideAndSeekSearchPhase>("ready");
  const [round, setRound] = useState<ActiveSearchRound | null>(null);
  const [token, setToken] = useState("");
  const [selectedSquares, setSelectedSquares] = useState<Set<HideAndSeekSquare>>(() => new Set());
  const [boardArrows, setBoardArrows] = useState<BoardArrow[]>([]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [personalBest, setPersonalBest] = useState(Math.max(0, initialBestScore));
  const [error, setError] = useState("");
  const [terminalError, setTerminalError] = useState("");
  const startedAtPerformanceRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const operationRef = useRef(0);
  const revealTimerRef = useRef<number | null>(null);
  const statusHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
  }, []);

  useEffect(() => {
    if (!canMarkHideAndSeekBoard(phase)) return;
    const updateElapsed = () => setElapsedMs(Math.max(0, performance.now() - startedAtPerformanceRef.current));
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "result" && phase !== "restart-required") return;
    const frame = window.requestAnimationFrame(() => statusHeadingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  async function startSearch() {
    requestRef.current?.abort();
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    const operation = ++operationRef.current;
    setPhase("preparing");
    setRound(null);
    setToken("");
    setSelectedSquares(new Set());
    setBoardArrows([]);
    setResult(null);
    setElapsedMs(0);
    setError("");
    setTerminalError("");

    try {
      const startRequestedAt = monotonicEpochNow();
      const response = await fetch("/api/student/hide-and-seek/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: controller.signal
      });
      const started = await response.json().catch(() => null) as StartResponse | { error?: string } | null;
      const startReceivedAt = monotonicEpochNow();
      if (!response.ok || !started || !("round" in started) || !("token" in started)) {
        throw new Error(errorMessage(started, "The board could not be prepared. Please try again."));
      }
      if (operation !== operationRef.current) return;
      const startOffset = hideAndSeekSynchronizedStartOffset({
        startedAt: started.round.startedAt,
        serverReceivedAt: started.serverReceivedAt,
        serverSentAt: started.serverSentAt,
        requestStartedAt: startRequestedAt,
        responseReceivedAt: startReceivedAt
      });
      if (startOffset === null) throw new Error("This board returned an invalid start time. Please try again.");
      const revealDelay = Math.max(0, startOffset);
      startedAtPerformanceRef.current = performance.now() + startOffset;
      const reveal = () => {
        revealTimerRef.current = null;
        if (controller.signal.aborted || operation !== operationRef.current) return;
        setRound(started.round);
        setToken(started.token);
        setElapsedMs(Math.max(0, performance.now() - startedAtPerformanceRef.current));
        setPhase("searching");
      };
      if (revealDelay > 0) revealTimerRef.current = window.setTimeout(reveal, revealDelay);
      else reveal();
    } catch (caught) {
      if (controller.signal.aborted || operation !== operationRef.current) return;
      setPhase("ready");
      setError(caught instanceof Error ? caught.message : "The board could not be prepared. Please try again.");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  async function finishSearch() {
    if (!round || !canScoreHideAndSeekBoard({ phase, token, selectedCount: selectedSquares.size })) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const operation = ++operationRef.current;
    setElapsedMs(Math.max(0, performance.now() - startedAtPerformanceRef.current));
    setPhase("finishing");
    setError("");

    try {
      const orderedSelections = BOARD_SQUARES.filter((square) => selectedSquares.has(square));
      const response = await fetch("/api/student/hide-and-seek/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, selectedSquares: orderedSelections }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null) as FinishResponse | { error?: string } | null;
      if (!response.ok || !payload || !("result" in payload)) {
        if (isTerminalHideAndSeekFinishFailure(response.status)) {
          const message = errorMessage(payload, "This search expired before it could be scored. Start a new search.");
          setToken("");
          setTerminalError(message);
          setPhase("restart-required");
          return;
        }
        throw new Error(errorMessage(payload, "Your search could not be scored. Please try again."));
      }
      if (operation !== operationRef.current) return;
      setResult(payload.result);
      setElapsedMs(payload.result.elapsedMs);
      const nextPersonalBest = Math.max(personalBest, payload.result.personalBest);
      setPersonalBest(nextPersonalBest);
      onComplete?.(payload.result);
      setPhase("result");
    } catch (caught) {
      if (controller.signal.aborted || operation !== operationRef.current) return;
      setPhase("searching");
      setError(caught instanceof Error ? caught.message : "Your search could not be scored. Please try again.");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  function toggleSquare(square: HideAndSeekSquare) {
    if (!canMarkHideAndSeekBoard(phase) || !round || round.pieces.some((placement) => placement.square === square)) return;
    setSelectedSquares((current) => {
      const next = new Set(current);
      if (next.has(square)) next.delete(square);
      else next.add(square);
      return next;
    });
  }

  const shownElapsedMs = result?.elapsedMs ?? elapsedMs;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-emerald-300/25">
        <div className="grid grid-cols-3 divide-x divide-white/10">
          {[
            ["Timer", formatDuration(shownElapsedMs)],
            ["Marked", selectedSquares.size],
            ["Best", personalBest]
          ].map(([label, value]) => (
            <div key={String(label)} className="p-3 text-center sm:p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
              <p className="mt-1 text-xl font-black text-white sm:text-2xl">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,640px)_minmax(300px,1fr)]">
        <div className="mx-auto w-full max-w-[640px]">
          {round ? (
            <SearchBoard
              round={round}
              phase={phase}
              selectedSquares={selectedSquares}
              result={result}
              arrows={boardArrows}
              onToggle={toggleSquare}
              onArrowsChange={setBoardArrows}
            />
          ) : <CoveredBoard />}
        </div>

        <aside className="space-y-4">
          <Card className="overflow-hidden border-emerald-300/25">
            <div className="border-b border-white/10 bg-gradient-to-r from-emerald-400/10 via-cyan-300/5 to-transparent p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Hide and Seek</p>
                <span className="rounded-full border border-amber-200/25 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">Accuracy first</span>
              </div>
              <h2
                ref={statusHeadingRef}
                tabIndex={phase === "result" || phase === "restart-required" ? -1 : undefined}
                className="mt-2 text-3xl font-black text-white outline-none"
              >
                {phase === "result"
                  ? "Search complete"
                  : phase === "restart-required"
                    ? "Start a fresh search"
                    : "Find every hiding place"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Mark every empty square that none of the black pieces can see. Sliding pieces cannot see through one another.
              </p>
            </div>

            <div className="p-5">
              {phase === "ready" || phase === "preparing" ? (
                <>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200">
                    The board stays covered until you are ready. When you start, tap safe squares to leave a star. The timer cannot be paused.
                  </div>
                  <Button type="button" onClick={() => void startSearch()} disabled={phase === "preparing"} className="mt-4 min-h-14 w-full text-base">
                    {phase === "preparing" ? "Scattering Pieces..." : error ? "Try Start Again" : "Start Search"}
                  </Button>
                </>
              ) : null}

              {phase === "searching" || phase === "finishing" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-cyan-200/20 bg-cyan-300/5 p-3">
                      <p className="text-xs font-black uppercase text-cyan-200">Time</p>
                      <p className="mt-1 text-2xl font-black text-white" aria-label={`Elapsed time ${formatDuration(elapsedMs)}`}>{formatDuration(elapsedMs)}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200/20 bg-amber-300/5 p-3">
                      <p className="text-xs font-black uppercase text-amber-200">Stars placed</p>
                      <p className="mt-1 text-2xl font-black text-white" aria-live="polite" aria-atomic="true">{selectedSquares.size}</p>
                    </div>
                  </div>
                  {phase === "searching" && !token ? (
                    <p className="mt-4 rounded-lg border border-cyan-200/25 bg-cyan-300/10 p-3 text-sm font-bold text-cyan-100" role="status">
                      Board revealed — you can start marking now. Stop &amp; Score will unlock as soon as the official timer is active.
                    </p>
                  ) : null}
                  <p className="mt-4 text-sm leading-6 text-slate-300">Click or tap to stamp a square. Right-drag to sketch private arrows; they do not affect your score. With a keyboard, use the arrow keys to move and Enter or Space to stamp.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button type="button" variant="ghost" onClick={() => setSelectedSquares(new Set())} disabled={phase === "finishing" || selectedSquares.size === 0}>Clear Marks</Button>
                    <Button type="button" onClick={() => void finishSearch()} disabled={!canScoreHideAndSeekBoard({ phase, token, selectedCount: selectedSquares.size })}>{phase === "finishing" ? "Scoring..." : token ? "Stop & Score" : "Activating..."}</Button>
                  </div>
                </>
              ) : null}

              {phase === "restart-required" ? (
                <div className="rounded-xl border border-rose-300/35 bg-rose-300/10 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-rose-200">Search ended</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-rose-100">{terminalError || "This search can no longer be scored. Start a new board to try again."}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Button type="button" onClick={() => void startSearch()}>Start New Search</Button>
                    <Button type="button" variant="ghost" onClick={onExit}>Back to Training</Button>
                  </div>
                </div>
              ) : null}

              {phase === "result" && result ? (
                <>
                  <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-center">
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-200">Final score</p>
                    <p className="mt-1 text-5xl font-black text-white">{result.score}</p>
                    <p className="mt-1 text-sm font-bold text-emerald-100">out of 1,000 points</p>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3"><dt className="text-slate-400">Safe squares found</dt><dd className="mt-1 text-xl font-black text-white">{result.correctCount}/{result.totalSafe}</dd></div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3"><dt className="text-slate-400">Found</dt><dd className="mt-1 text-xl font-black text-white">{result.foundPercent}%</dd></div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3"><dt className="text-slate-400">Wrong guesses</dt><dd className="mt-1 text-xl font-black text-white">{result.wrongCount}</dd></div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3"><dt className="text-slate-400">Time</dt><dd className="mt-1 text-xl font-black text-white">{formatDuration(result.elapsedMs)}</dd></div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold">
                    <span className="text-emerald-200">★ Found safely</span>
                    <span className="text-rose-200">× Wrong guess</span>
                    <span className="text-amber-200">□ Safe square missed</span>
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <Button type="button" onClick={() => void startSearch()}>New Search</Button>
                    <Button type="button" variant="ghost" onClick={onExit}>Back to Training</Button>
                  </div>
                </>
              ) : null}

              {error && phase !== "restart-required" ? <p className="mt-4 rounded-lg border border-rose-300/35 bg-rose-300/10 p-3 text-sm font-bold text-rose-100" role="alert">{error}</p> : null}
            </div>
          </Card>

          {phase !== "result" && phase !== "restart-required" ? <Button type="button" variant="ghost" className="w-full" onClick={onExit}>Back to Training Modes</Button> : null}
        </aside>
      </div>
    </div>
  );
}
