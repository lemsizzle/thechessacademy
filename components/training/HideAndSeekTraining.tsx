"use client";

import { defaultPieces } from "react-chessboard";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type {
  HideAndSeekMode,
  HideAndSeekPieceCode,
  HideAndSeekPiecePlacement,
  HideAndSeekSquare
} from "@/lib/puzzle-training/hideAndSeek";

export type HideAndSeekSearchPhase = "ready" | "preparing" | "searching" | "finishing" | "restart-required" | "result";

type ActiveSearchRound = {
  id: string;
  pieces: HideAndSeekPiecePlacement[];
  mode: HideAndSeekMode;
  timeLimitMs: number | null;
  startedAt: string;
  expiresAt: string;
};

type SearchResult = {
  mode: HideAndSeekMode;
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

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
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
  mode?: HideAndSeekMode;
}) {
  return input.phase === "searching"
    && input.token.length > 0
    && (input.mode === "time_trial" || input.selectedCount > 0);
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
  interactive,
  selectedSquares,
  result,
  onToggle
}: {
  round: ActiveSearchRound;
  phase: HideAndSeekSearchPhase;
  interactive: boolean;
  selectedSquares: ReadonlySet<HideAndSeekSquare>;
  result: SearchResult | null;
  onToggle: (square: HideAndSeekSquare) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const squareRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pieceBySquare = useMemo(
    () => new Map(round.pieces.map((placement) => [placement.square, placement.piece])),
    [round.pieces]
  );
  const correctSquares = useMemo(() => new Set(result?.correctSquares ?? []), [result?.correctSquares]);
  const wrongSquares = useMemo(() => new Set(result?.wrongSquares ?? []), [result?.wrongSquares]);
  const missedSquares = useMemo(() => new Set(result?.missedSquares ?? []), [result?.missedSquares]);

  useEffect(() => {
    if (!interactive) return;
    const firstEmptyIndex = BOARD_SQUARES.findIndex((square) => !pieceBySquare.has(square));
    const nextIndex = firstEmptyIndex < 0 ? 0 : firstEmptyIndex;
    setActiveIndex(nextIndex);
    const frame = window.requestAnimationFrame(() => squareRefs.current[nextIndex]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [interactive, pieceBySquare]);

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
    if ((event.key === "Enter" || event.key === " ") && interactive) {
      event.preventDefault();
      onToggle(square);
    }
  }

  return (
    <div className="aspect-square w-full overflow-hidden rounded-xl border border-emerald-200/25 bg-slate-950 p-1 shadow-[0_0_48px_rgba(52,211,153,.16)] sm:p-2">
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
              const canToggle = interactive && !piece;
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
  const [searchMode, setSearchMode] = useState<HideAndSeekMode>("classic");
  const [round, setRound] = useState<ActiveSearchRound | null>(null);
  const [token, setToken] = useState("");
  const [selectedSquares, setSelectedSquares] = useState<Set<HideAndSeekSquare>>(() => new Set());
  const [result, setResult] = useState<SearchResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [personalBest, setPersonalBest] = useState(Math.max(0, initialBestScore));
  const [error, setError] = useState("");
  const [terminalError, setTerminalError] = useState("");
  const startedAtPerformanceRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const operationRef = useRef(0);
  const revealTimerRef = useRef<number | null>(null);
  const autoSubmitRequestedRef = useRef(false);
  const statusHeadingRef = useRef<HTMLHeadingElement>(null);
  const activeMode = round?.mode ?? result?.mode ?? searchMode;
  const timeLimitMs = round?.timeLimitMs ?? (activeMode === "time_trial" ? 60_000 : null);
  const timeTrialExpired = timeLimitMs !== null && elapsedMs >= timeLimitMs;

  useEffect(() => () => {
    requestRef.current?.abort();
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
  }, []);

  useEffect(() => {
    if (!canMarkHideAndSeekBoard(phase)) return;
    const updateElapsed = () => setElapsedMs(Math.max(0, performance.now() - startedAtPerformanceRef.current));
    updateElapsed();
    const interval = window.setInterval(updateElapsed, round?.mode === "time_trial" ? 200 : 1_000);
    return () => window.clearInterval(interval);
  }, [phase, round?.mode]);

  useEffect(() => {
    if (phase !== "searching"
      || round?.mode !== "time_trial"
      || !round.timeLimitMs
      || elapsedMs < round.timeLimitMs
      || autoSubmitRequestedRef.current) return;
    autoSubmitRequestedRef.current = true;
    void finishSearch();
  }, [elapsedMs, phase, round?.mode, round?.timeLimitMs]);

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
    setResult(null);
    setElapsedMs(0);
    setError("");
    setTerminalError("");
    autoSubmitRequestedRef.current = false;

    try {
      const startRequestedAt = monotonicEpochNow();
      const response = await fetch("/api/student/hide-and-seek/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: searchMode }),
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
    if (!round || !canScoreHideAndSeekBoard({
      phase,
      token,
      selectedCount: selectedSquares.size,
      mode: round.mode
    })) return;
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
    if (!canMarkHideAndSeekBoard(phase)
      || timeTrialExpired
      || !round
      || round.pieces.some((placement) => placement.square === square)) return;
    setSelectedSquares((current) => {
      const next = new Set(current);
      if (next.has(square)) next.delete(square);
      else next.add(square);
      return next;
    });
  }

  function changeMode() {
    requestRef.current?.abort();
    operationRef.current += 1;
    setPhase("ready");
    setRound(null);
    setToken("");
    setSelectedSquares(new Set());
    setResult(null);
    setElapsedMs(0);
    setError("");
    setTerminalError("");
    autoSubmitRequestedRef.current = false;
  }

  const shownElapsedMs = result?.elapsedMs ?? elapsedMs;
  const shownTime = activeMode === "time_trial" && timeLimitMs !== null
    ? formatCountdown(Math.max(0, timeLimitMs - shownElapsedMs))
    : formatDuration(shownElapsedMs);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-emerald-300/25">
        <div className="grid grid-cols-3 divide-x divide-white/10">
          {[
            [activeMode === "time_trial" ? "Time left" : "Timer", shownTime],
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
              interactive={canMarkHideAndSeekBoard(phase) && !timeTrialExpired}
              selectedSquares={selectedSquares}
              result={result}
              onToggle={toggleSquare}
            />
          ) : <CoveredBoard />}
        </div>

        <aside className="space-y-4">
          <Card className="overflow-hidden border-emerald-300/25">
            <div className="border-b border-white/10 bg-gradient-to-r from-emerald-400/10 via-cyan-300/5 to-transparent p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Hide and Seek</p>
                <span className="rounded-full border border-amber-200/25 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">40% speed · 60% accuracy</span>
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
                  <fieldset disabled={phase === "preparing"}>
                    <legend className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">Choose a mode</legend>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {([
                        ["classic", "Classic", "Open-ended", "Search carefully, then stop the clock when you are ready."],
                        ["time_trial", "Time Trial", "60 seconds", "Race the countdown. Your board scores automatically at zero."]
                      ] as const).map(([mode, name, label, description]) => {
                        const selected = searchMode === mode;
                        return (
                          <label
                            key={mode}
                            className={`cursor-pointer rounded-lg border p-4 transition focus-within:ring-2 focus-within:ring-cyan-200 ${selected ? "border-emerald-200/60 bg-emerald-300/12" : "border-white/10 bg-white/[0.035] hover:border-white/25"}`}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="hide-and-seek-mode"
                                value={mode}
                                checked={selected}
                                onChange={() => setSearchMode(mode)}
                                className="accent-emerald-300"
                              />
                              <span className="font-black text-white">{name}</span>
                            </span>
                            <span className="mt-2 block text-xs font-black uppercase tracking-wide text-amber-100">{label}</span>
                            <span className="mt-1 block text-sm leading-5 text-slate-400">{description}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200">
                    The board stays covered until you are ready. When you start, tap safe squares to leave a star. Speed can contribute up to 40% of the score.
                  </div>
                  <Button type="button" onClick={() => void startSearch()} disabled={phase === "preparing"} className="mt-4 min-h-14 w-full text-base">
                    {phase === "preparing"
                      ? "Scattering Pieces..."
                      : error
                        ? "Try Start Again"
                        : searchMode === "time_trial"
                          ? "Start 60-Second Trial"
                          : "Start Classic Search"}
                  </Button>
                </>
              ) : null}

              {phase === "searching" || phase === "finishing" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-cyan-200/20 bg-cyan-300/5 p-3">
                      <p className="text-xs font-black uppercase text-cyan-200">{activeMode === "time_trial" ? "Time left" : "Time"}</p>
                      <p className="mt-1 text-2xl font-black text-white" aria-live={activeMode === "time_trial" ? "off" : undefined} aria-label={activeMode === "time_trial" ? `Time remaining ${shownTime}` : `Elapsed time ${shownTime}`}>{shownTime}</p>
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
                  {activeMode === "time_trial" && timeTrialExpired ? (
                    <p className="mt-4 rounded-lg border border-amber-200/25 bg-amber-300/10 p-3 text-sm font-bold text-amber-100" role="status">Time’s up — saving your score.</p>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-slate-300">Click or tap to stamp a square. With a keyboard, use the arrow keys to move and Enter or Space to stamp.</p>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button type="button" variant="ghost" onClick={() => setSelectedSquares(new Set())} disabled={phase === "finishing" || timeTrialExpired || selectedSquares.size === 0}>Clear Marks</Button>
                    <Button type="button" onClick={() => void finishSearch()} disabled={!canScoreHideAndSeekBoard({ phase, token, selectedCount: selectedSquares.size, mode: round?.mode })}>{phase === "finishing" ? "Scoring..." : error && timeTrialExpired ? "Retry Score" : token ? activeMode === "time_trial" ? "Finish Now" : "Stop & Score" : "Activating..."}</Button>
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
                    <p className="text-xs font-black uppercase tracking-widest text-cyan-100">{result.mode === "time_trial" ? "60-second Time Trial" : "Classic search"}</p>
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
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <Button type="button" onClick={() => void startSearch()}>Play Again</Button>
                    <Button type="button" variant="secondary" onClick={changeMode}>Change Mode</Button>
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
