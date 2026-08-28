"use client";

import { Chess, type Square } from "chess.js";
import { Chessboard, type ChessboardOptions } from "react-chessboard";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BOARD_INTERACTION_OPTIONS, BOARD_MOTION_OPTIONS } from "@/chess/components/boardMotion";
import { useOutsideBoardAnnotationClear } from "@/chess/hooks/useOutsideBoardAnnotationClear";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AutoAdvanceSwitch, PuzzleModeSetup, type PuzzleModeChoice } from "@/components/training/PuzzleModeSetup";
import { WoodpeckerCycleSummary } from "@/components/training/WoodpeckerCycleSummary";
import { requestWoodpeckerCycleVerification, type WoodpeckerCycleVerificationInput } from "@/lib/puzzle-training/cycleVerification";
import { legalDestinations, parseUciMove, premoveDestinations } from "@/lib/puzzle-training/engine";
import { calculatePuzzleAccuracy, calculateWoodpeckerCycleStats, formatSurvivalLives, nextWoodpeckerPuzzleTarget, nextWoodpeckerStep, PUZZLE_DIFFICULTY_OPTIONS, SURVIVAL_PUZZLE_LIMIT, survivalDifficultyForPuzzle, WOODPECKER_CYCLE_COUNT, WOODPECKER_SET_SIZE, type WoodpeckerCycleResult } from "@/lib/puzzle-training/modes";
import type { PuzzleTrainingOverview } from "@/lib/puzzle-training/overview";
import { emptyPremoveHandoff, takeReadyPremove, withPremoveReply, withPremoveReplyReady, withQueuedPremove, type QueuedPremove } from "@/lib/puzzle-training/premoveQueue";
import { parsePuzzleLevel, parsePuzzleTheme, puzzleThemeOptions, type PublicTrainingPuzzle, type PuzzleCompletionDetails, type PuzzleLevelSlug, type PuzzleMoveResult, type PuzzleThemeSlug } from "@/lib/puzzle-training/types";

const STARTING_LIVES = 3;
const OPPONENT_REPLY_DELAY_MS = 420;
const AUTO_ADVANCE_DELAY_MS = 140;
const WOODPECKER_AUTO_ADVANCE_DELAY_MS = 50;
const MOVE_REQUEST_TIMEOUT_MS = 12_000;
const PUZZLE_LOAD_TIMEOUT_MS = 12_000;
const AUTO_ADVANCE_STORAGE_KEY = "academy-puzzles-auto-advance";

const StarWarsTraining = dynamic(
  () => import("@/components/training/StarWarsTraining").then((module) => module.StarWarsTraining),
  { ssr: false, loading: () => <Card className="p-6 text-sm font-bold text-slate-300">Preparing the Star Wars board...</Card> }
);

type TrainerPhase = "select" | "loading" | "turn" | "reply" | "solved" | "cycle-summary" | "summary" | "error" | "star-wars";
type TrainingMode = "survival" | "woodpecker" | "daily";
type WoodpeckerCycleSaveState = "idle" | "saving" | "saved" | "error";
type PendingWoodpeckerCycleSave = WoodpeckerCycleVerificationInput;
type MoveSubmissionContext = { fen: string; token: string; isPremove: true };

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function PuzzleTimer({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  return formatTime(seconds);
}

function optimisticMoveFen(fen: string, from: string, to: string) {
  try {
    const chess = new Chess(fen);
    const piece = chess.get(from as Square);
    const promotes = piece?.type === "p" && (to.endsWith("1") || to.endsWith("8"));
    chess.move({ from, to, ...(promotes ? { promotion: "q" } : {}) });
    return chess.fen();
  } catch {
    return null;
  }
}

export function PuzzleSurvival({ initialOverview }: { initialOverview: PuzzleTrainingOverview }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTheme, setSelectedTheme] = useState<PuzzleThemeSlug>(() => parsePuzzleTheme(searchParams.get("theme")));
  const [selectedLevel, setSelectedLevel] = useState<PuzzleLevelSlug>(() => parsePuzzleLevel(searchParams.get("level")));
  const [setupMode, setSetupMode] = useState<PuzzleModeChoice>("survival");
  const [trainingMode, setTrainingMode] = useState<TrainingMode>("survival");
  const [woodpeckerSetSize, setWoodpeckerSetSize] = useState<number>(WOODPECKER_SET_SIZE);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [phase, setPhase] = useState<TrainerPhase>("select");
  const [puzzle, setPuzzle] = useState<PublicTrainingPuzzle | null>(null);
  const [positionFen, setPositionFen] = useState("");
  const [token, setToken] = useState("");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalSquares, setLegalSquares] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [correctMove, setCorrectMove] = useState<[string, string] | null>(null);
  const [incorrectSquare, setIncorrectSquare] = useState<string | null>(null);
  const [hintSource, setHintSource] = useState<string | null>(null);
  const [hintDestination, setHintDestination] = useState<string | null>(null);
  const [queuedPremove, setQueuedPremove] = useState<QueuedPremove | null>(null);
  const [hasBoardAnnotations, setHasBoardAnnotations] = useState(false);
  const [annotationResetKey, setAnnotationResetKey] = useState(0);
  const [message, setMessage] = useState("Choose a training theme to begin.");
  const [error, setError] = useState("");
  const [lives, setLives] = useState(STARTING_LIVES);
  const [completed, setCompleted] = useState(0);
  const [solved, setSolved] = useState(0);
  const [firstTrySolves, setFirstTrySolves] = useState(0);
  const [incorrectAttempts, setIncorrectAttempts] = useState(0);
  const [solveTimes, setSolveTimes] = useState<number[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [completion, setCompletion] = useState<PuzzleCompletionDetails | null>(null);
  const recentPuzzleIds = useRef<string[]>([]);
  const woodpeckerPuzzleIds = useRef<string[]>([]);
  const activeWoodpeckerSetSize = useRef(WOODPECKER_SET_SIZE);
  const woodpeckerCycleRef = useRef(1);
  const woodpeckerIndexRef = useRef(0);
  const woodpeckerCycleSecondsRef = useRef(0);
  const woodpeckerCycleMistakesRef = useRef(0);
  const woodpeckerCycleMistakePuzzleIdsRef = useRef<string[]>([]);
  const woodpeckerReviewPuzzleIdsRef = useRef<string[]>([]);
  const woodpeckerReviewIndexRef = useRef(0);
  const woodpeckerReviewingRef = useRef(false);
  const woodpeckerRunIdRef = useRef<string | null>(null);
  const woodpeckerCycleSessionIdsRef = useRef<string[]>([]);
  const pendingWoodpeckerCycleSaveRef = useRef<PendingWoodpeckerCycleSave | null>(null);
  const activeWoodpeckerCycleSaveOperationsRef = useRef(new Map<string, number>());
  const currentWoodpeckerCycleSaveOperationRef = useRef(0);
  const requestedPuzzleIdRef = useRef<string | null>(null);
  const prefetchedNextPuzzleRef = useRef<PublicTrainingPuzzle | null>(null);
  const [woodpeckerCycle, setWoodpeckerCycle] = useState(1);
  const [woodpeckerIndex, setWoodpeckerIndex] = useState(0);
  const [woodpeckerCycleSolved, setWoodpeckerCycleSolved] = useState(0);
  const [woodpeckerCycleIncorrectMoves, setWoodpeckerCycleIncorrectMoves] = useState(0);
  const [woodpeckerReviewIndex, setWoodpeckerReviewIndex] = useState(0);
  const [woodpeckerReviewing, setWoodpeckerReviewing] = useState(false);
  const [woodpeckerCycleResults, setWoodpeckerCycleResults] = useState<WoodpeckerCycleResult[]>([]);
  const [woodpeckerCycleSaveState, setWoodpeckerCycleSaveState] = useState<WoodpeckerCycleSaveState>("idle");
  const [woodpeckerCycleSaveError, setWoodpeckerCycleSaveError] = useState("");
  const [woodpeckerCycleSaveDelayed, setWoodpeckerCycleSaveDelayed] = useState(false);
  const [overview, setOverview] = useState(initialOverview);
  const sessionId = useRef(crypto.randomUUID());
  const moveLocked = useRef(false);
  const premoveHandoffRef = useRef(emptyPremoveHandoff());
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const sessionGenerationRef = useRef(0);
  const puzzleGenerationRef = useRef(0);
  const activePuzzleIdRef = useRef<string | null>(null);
  const moveRequestIdRef = useRef(0);
  const puzzleLoadRequestIdRef = useRef(0);
  const cycleStatsRequestIdRef = useRef(0);
  const activeMoveControllerRef = useRef<AbortController | null>(null);
  const activePuzzleLoadControllerRef = useRef<AbortController | null>(null);
  const puzzleTransitionLockedRef = useRef(false);
  const puzzleBoardRef = useOutsideBoardAnnotationClear(() => {
    if (!hasBoardAnnotations) return;
    setHasBoardAnnotations(false);
    setAnnotationResetKey((value) => value + 1);
  });

  useEffect(() => {
    mountedRef.current = true;
    setAutoAdvance(window.localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY) === "true");
    return () => {
      mountedRef.current = false;
      sessionGenerationRef.current += 1;
      puzzleGenerationRef.current += 1;
      moveRequestIdRef.current += 1;
      puzzleLoadRequestIdRef.current += 1;
      cycleStatsRequestIdRef.current += 1;
      currentWoodpeckerCycleSaveOperationRef.current = 0;
      activeMoveControllerRef.current?.abort();
      activePuzzleLoadControllerRef.current?.abort();
      activeMoveControllerRef.current = null;
      activePuzzleLoadControllerRef.current = null;
      if (replyTimer.current) clearTimeout(replyTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  function clearReplyTimer() {
    if (!replyTimer.current) return;
    clearTimeout(replyTimer.current);
    replyTimer.current = null;
  }

  function cancelScheduledAdvance() {
    if (!advanceTimer.current) return;
    clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
  }

  function abortActiveMoveRequest() {
    moveRequestIdRef.current += 1;
    activeMoveControllerRef.current?.abort();
    activeMoveControllerRef.current = null;
    moveLocked.current = false;
  }

  function abortActivePuzzleLoad() {
    puzzleLoadRequestIdRef.current += 1;
    activePuzzleLoadControllerRef.current?.abort();
    activePuzzleLoadControllerRef.current = null;
  }

  function invalidatePuzzleWork() {
    puzzleGenerationRef.current += 1;
    activePuzzleIdRef.current = null;
    abortActiveMoveRequest();
    abortActivePuzzleLoad();
    clearReplyTimer();
    cancelScheduledAdvance();
  }

  function beginNewSession() {
    sessionGenerationRef.current += 1;
    invalidatePuzzleWork();
    puzzleTransitionLockedRef.current = false;
    sessionId.current = crypto.randomUUID();
  }

  function claimPuzzleTransition(expectedPuzzleId?: string) {
    cancelScheduledAdvance();
    if (puzzleTransitionLockedRef.current) return false;
    if (expectedPuzzleId && activePuzzleIdRef.current !== expectedPuzzleId) return false;
    puzzleTransitionLockedRef.current = true;
    return true;
  }

  function schedulePuzzleAdvance(callback: () => void, delayMs: number) {
    cancelScheduledAdvance();
    const scheduledSessionGeneration = sessionGenerationRef.current;
    const scheduledPuzzleGeneration = puzzleGenerationRef.current;
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      if (!mountedRef.current
        || sessionGenerationRef.current !== scheduledSessionGeneration
        || puzzleGenerationRef.current !== scheduledPuzzleGeneration) return;
      callback();
    }, delayMs);
  }

  function updateAutoAdvance(enabled: boolean) {
    setAutoAdvance(enabled);
    window.localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, String(enabled));
    if (!enabled) cancelScheduledAdvance();
  }

  function updateQueuedPremove(nextPremove: QueuedPremove | null) {
    premoveHandoffRef.current = withQueuedPremove(premoveHandoffRef.current, nextPremove);
    setQueuedPremove(nextPremove);
  }

  function resetPremoveHandoff() {
    premoveHandoffRef.current = emptyPremoveHandoff();
    setQueuedPremove(null);
  }

  function cancelPremove(message = "Premove canceled.") {
    resetPremoveHandoff();
    setSelectedSquare(null);
    setLegalSquares([]);
    if (phase === "reply" || (phase === "turn" && moveLocked.current)) setMessage(message);
  }

  function chooseTheme(theme: PuzzleThemeSlug) {
    setSelectedTheme(theme);
    router.replace(`/student/training?theme=${theme}&level=${selectedLevel}`, { scroll: false });
  }

  function chooseLevel(level: PuzzleLevelSlug) {
    setSelectedLevel(level);
    router.replace(`/student/training?theme=${selectedTheme}&level=${level}`, { scroll: false });
  }

  function clearBoardMarks() {
    setSelectedSquare(null);
    setLegalSquares([]);
    setLastMove(null);
    setCorrectMove(null);
    setIncorrectSquare(null);
    setHintSource(null);
    setHintDestination(null);
    resetPremoveHandoff();
  }

  function showPuzzle(nextPuzzle: PublicTrainingPuzzle, mode = trainingMode) {
    invalidatePuzzleWork();
    puzzleTransitionLockedRef.current = true;
    setError("");
    setCompletion(null);
    clearBoardMarks();
    setPuzzle(nextPuzzle);
    setPositionFen(nextPuzzle.displayFen);
    setToken(nextPuzzle.token);
    if (mode === "woodpecker" && woodpeckerCycleRef.current === 1 && woodpeckerPuzzleIds.current.length < activeWoodpeckerSetSize.current) {
      const nextIndex = woodpeckerPuzzleIds.current.length;
      woodpeckerPuzzleIds.current = [...woodpeckerPuzzleIds.current, nextPuzzle.id];
      woodpeckerIndexRef.current = nextIndex;
      setWoodpeckerIndex(nextIndex);
    }
    recentPuzzleIds.current = [...recentPuzzleIds.current, nextPuzzle.id].slice(-20);
    activePuzzleIdRef.current = nextPuzzle.id;
    setMessage(nextPuzzle.prompt || "Your turn. Find the best move.");
    setPhase("turn");
    moveLocked.current = false;
    puzzleTransitionLockedRef.current = false;
  }

  async function loadPuzzle(mode = trainingMode, requestedPuzzleId?: string, survivalPuzzleNumber = completed + 1) {
    invalidatePuzzleWork();
    puzzleTransitionLockedRef.current = true;
    prefetchedNextPuzzleRef.current = null;
    setTrainingMode(mode);
    requestedPuzzleIdRef.current = requestedPuzzleId ?? null;
    setPhase("loading");
    setError("");
    setMessage("Preparing the next position...");
    setCompletion(null);
    clearBoardMarks();
    const requestedLevel = mode === "survival" ? survivalDifficultyForPuzzle(survivalPuzzleNumber).level : selectedLevel;
    const loadSessionId = sessionId.current;
    const loadSessionGeneration = sessionGenerationRef.current;
    const loadRequestId = ++puzzleLoadRequestIdRef.current;
    const loadController = new AbortController();
    activePuzzleLoadControllerRef.current = loadController;
    let loadTimedOut = false;
    const loadTimeout = window.setTimeout(() => {
      loadTimedOut = true;
      loadController.abort();
    }, PUZZLE_LOAD_TIMEOUT_MS);
    const isCurrentLoad = () => mountedRef.current
      && loadRequestId === puzzleLoadRequestIdRef.current
      && loadSessionGeneration === sessionGenerationRef.current
      && activePuzzleLoadControllerRef.current === loadController;
    const query = new URLSearchParams({ theme: selectedTheme, level: requestedLevel, sessionId: loadSessionId });
    query.set("mode", mode);
    if (mode === "woodpecker" && !woodpeckerReviewingRef.current && woodpeckerRunIdRef.current) {
      query.set("woodpeckerRunId", woodpeckerRunIdRef.current);
      query.set("woodpeckerCycleNumber", String(woodpeckerCycleRef.current));
    }
    if (mode === "daily") query.set("daily", "1");
    if (requestedPuzzleId) query.set("puzzleId", requestedPuzzleId);
    const excludedPuzzleIds = mode === "woodpecker" && woodpeckerCycleRef.current === 1
      ? woodpeckerPuzzleIds.current
      : recentPuzzleIds.current.slice(-10);
    if (!requestedPuzzleId && excludedPuzzleIds.length) query.set("exclude", excludedPuzzleIds.join(","));

    try {
      const response = await fetch(`/api/student/puzzle-training/puzzle?${query}`, {
        cache: "no-store",
        signal: loadController.signal
      });
      const data = await response.json() as { puzzle?: PublicTrainingPuzzle; error?: string };
      if (!isCurrentLoad()) return;
      if (!response.ok || !data.puzzle) throw new Error(data.error ?? "Puzzle could not be loaded.");
      activePuzzleLoadControllerRef.current = null;
      showPuzzle(data.puzzle, mode);
    } catch (loadError) {
      if (!isCurrentLoad()) return;
      setError(loadTimedOut
        ? "The next puzzle took too long to load. Try again."
        : loadError instanceof Error ? loadError.message : "Puzzle could not be loaded.");
      setMessage("The board recovered safely. Try loading the puzzle again.");
      setPhase("error");
      moveLocked.current = false;
      puzzleTransitionLockedRef.current = false;
    } finally {
      clearTimeout(loadTimeout);
      if (activePuzzleLoadControllerRef.current === loadController) {
        activePuzzleLoadControllerRef.current = null;
      }
    }
  }

  function resetTrainingStats() {
    setLives(STARTING_LIVES);
    setCompleted(0);
    setSolved(0);
    setFirstTrySolves(0);
    setIncorrectAttempts(0);
    setSolveTimes([]);
    setCurrentStreak(0);
    setBestStreak(0);
  }

  function resetWoodpeckerProgress() {
    prefetchedNextPuzzleRef.current = null;
    woodpeckerPuzzleIds.current = [];
    woodpeckerCycleRef.current = 1;
    woodpeckerIndexRef.current = 0;
    woodpeckerCycleSecondsRef.current = 0;
    woodpeckerCycleMistakesRef.current = 0;
    woodpeckerCycleMistakePuzzleIdsRef.current = [];
    woodpeckerReviewPuzzleIdsRef.current = [];
    woodpeckerReviewIndexRef.current = 0;
    woodpeckerReviewingRef.current = false;
    woodpeckerRunIdRef.current = null;
    woodpeckerCycleSessionIdsRef.current = [];
    pendingWoodpeckerCycleSaveRef.current = null;
    currentWoodpeckerCycleSaveOperationRef.current = 0;
    setWoodpeckerCycle(1);
    setWoodpeckerIndex(0);
    setWoodpeckerCycleSolved(0);
    setWoodpeckerCycleIncorrectMoves(0);
    setWoodpeckerReviewIndex(0);
    setWoodpeckerReviewing(false);
    setWoodpeckerCycleResults([]);
    setWoodpeckerCycleSaveState("idle");
    setWoodpeckerCycleSaveError("");
    setWoodpeckerCycleSaveDelayed(false);
  }

  function startSurvival() {
    setTrainingMode("survival");
    beginNewSession();
    recentPuzzleIds.current = [];
    resetWoodpeckerProgress();
    resetTrainingStats();
    void loadPuzzle("survival", undefined, 1);
  }

  function startWoodpecker() {
    setTrainingMode("woodpecker");
    activeWoodpeckerSetSize.current = woodpeckerSetSize;
    beginNewSession();
    recentPuzzleIds.current = [];
    resetWoodpeckerProgress();
    woodpeckerRunIdRef.current = crypto.randomUUID();
    resetTrainingStats();
    void loadPuzzle("woodpecker");
  }

  function startDailyPuzzle() {
    beginNewSession();
    recentPuzzleIds.current = [];
    setTrainingMode("daily");
    resetWoodpeckerProgress();
    resetTrainingStats();
    void loadPuzzle("daily");
  }

  function startStarWars() {
    invalidatePuzzleWork();
    puzzleTransitionLockedRef.current = false;
    setPhase("star-wars");
  }

  async function saveWoodpeckerCycleOverview(input: PendingWoodpeckerCycleSave, operationId: number) {
    const statsSessionGeneration = sessionGenerationRef.current;
    const inputKey = woodpeckerCycleSaveKey(input);
    const ownsSaveUi = () => mountedRef.current
      && currentWoodpeckerCycleSaveOperationRef.current === operationId
      && pendingWoodpeckerCycleSaveRef.current !== null
      && woodpeckerCycleSaveKey(pendingWoodpeckerCycleSaveRef.current) === inputKey;
    const stats = await requestWoodpeckerCycleVerification(input, {
      onSlow: () => {
        if (ownsSaveUi()) setWoodpeckerCycleSaveDelayed(true);
      }
    });
    if (mountedRef.current && statsSessionGeneration === sessionGenerationRef.current) {
      setOverview((current) => ({ ...current, latestWoodpeckerCycle: stats }));
    }
    return stats;
  }

  async function persistWoodpeckerCycleOverview(input: PendingWoodpeckerCycleSave) {
    const inputKey = woodpeckerCycleSaveKey(input);
    const existingOperationId = activeWoodpeckerCycleSaveOperationsRef.current.get(inputKey);
    if (existingOperationId !== undefined) {
      currentWoodpeckerCycleSaveOperationRef.current = existingOperationId;
      pendingWoodpeckerCycleSaveRef.current = input;
      setWoodpeckerCycleSaveState("saving");
      setWoodpeckerCycleSaveError("");
      return;
    }

    const operationId = ++cycleStatsRequestIdRef.current;
    activeWoodpeckerCycleSaveOperationsRef.current.set(inputKey, operationId);
    currentWoodpeckerCycleSaveOperationRef.current = operationId;
    pendingWoodpeckerCycleSaveRef.current = input;
    setWoodpeckerCycleSaveState("saving");
    setWoodpeckerCycleSaveError("");
    setWoodpeckerCycleSaveDelayed(false);
    const ownsSaveUi = () => mountedRef.current
      && currentWoodpeckerCycleSaveOperationRef.current === operationId
      && pendingWoodpeckerCycleSaveRef.current !== null
      && woodpeckerCycleSaveKey(pendingWoodpeckerCycleSaveRef.current) === inputKey;
    try {
      await saveWoodpeckerCycleOverview(input, operationId);
      if (!ownsSaveUi()) return;
      setWoodpeckerCycleSaveState("saved");
    } catch (statsError) {
      if (!ownsSaveUi()) return;
      setWoodpeckerCycleSaveState("error");
      setWoodpeckerCycleSaveError(statsError instanceof Error ? statsError.message : "Cycle stats could not be saved.");
    } finally {
      if (activeWoodpeckerCycleSaveOperationsRef.current.get(inputKey) === operationId) {
        activeWoodpeckerCycleSaveOperationsRef.current.delete(inputKey);
      }
      if (ownsSaveUi()) setWoodpeckerCycleSaveDelayed(false);
    }
  }

  function retryWoodpeckerCycleSave() {
    const pendingSave = pendingWoodpeckerCycleSaveRef.current;
    if (!pendingSave || activeWoodpeckerCycleSaveOperationsRef.current.has(woodpeckerCycleSaveKey(pendingSave))) return;
    void persistWoodpeckerCycleOverview(pendingSave);
  }

  function returnToPuzzleSetup() {
    invalidatePuzzleWork();
    puzzleTransitionLockedRef.current = false;
    prefetchedNextPuzzleRef.current = null;
    if (trainingMode === "survival" && solved > 0) {
      setOverview((current) => ({
        ...current,
        survival: {
          allTimeScore: Math.max(current.survival.allTimeScore, solved),
          monthScore: Math.max(current.survival.monthScore, solved),
          weekScore: Math.max(current.survival.weekScore, solved)
        }
      }));
    }
    setPhase("select");
  }

  function returnFromWoodpeckerCycleSummary() {
    invalidatePuzzleWork();
    puzzleTransitionLockedRef.current = false;
    prefetchedNextPuzzleRef.current = null;
    setCompletion(null);
    setPhase("select");
  }

  function showPrefetchedWoodpeckerPuzzleOrLoad(requestedPuzzleId?: string) {
    const prefetchedPuzzle = prefetchedNextPuzzleRef.current;
    if (prefetchedPuzzle && (!requestedPuzzleId || prefetchedPuzzle.id === requestedPuzzleId)) {
      prefetchedNextPuzzleRef.current = null;
      if (autoAdvance) {
        setTrainingMode("woodpecker");
        requestedPuzzleIdRef.current = requestedPuzzleId ?? null;
        showPuzzle(prefetchedPuzzle, "woodpecker");
      } else {
        // Refresh the signed start token so time spent on the solved screen is not
        // counted against a manually-started puzzle. The puzzle row is already cached.
        void loadPuzzle("woodpecker", prefetchedPuzzle.id);
      }
      return;
    }

    prefetchedNextPuzzleRef.current = null;
    void loadPuzzle("woodpecker", requestedPuzzleId);
  }

  function advanceTrainingPuzzle(expectedPuzzleId = puzzle?.id) {
    if (!claimPuzzleTransition(expectedPuzzleId)) return;
    if (trainingMode !== "woodpecker") {
      void loadPuzzle(trainingMode);
      return;
    }

    if (woodpeckerReviewingRef.current) {
      const nextReviewIndex = woodpeckerReviewIndexRef.current + 1;
      if (nextReviewIndex >= woodpeckerReviewPuzzleIdsRef.current.length) {
        woodpeckerReviewingRef.current = false;
        setWoodpeckerReviewing(false);
        setWoodpeckerCycleResults((results) => results.map((result) => result.cycle === woodpeckerCycleRef.current ? { ...result, reviewed: true } : result));
        setCompletion(null);
        setPhase("cycle-summary");
        puzzleTransitionLockedRef.current = false;
        return;
      }
      woodpeckerReviewIndexRef.current = nextReviewIndex;
      setWoodpeckerReviewIndex(nextReviewIndex);
      showPrefetchedWoodpeckerPuzzleOrLoad(woodpeckerReviewPuzzleIdsRef.current[nextReviewIndex]);
      return;
    }

    if (woodpeckerCycleRef.current === 1 && woodpeckerPuzzleIds.current.length < activeWoodpeckerSetSize.current) {
      showPrefetchedWoodpeckerPuzzleOrLoad();
      return;
    }

    const nextStep = nextWoodpeckerStep(
      woodpeckerCycleRef.current,
      woodpeckerIndexRef.current,
      woodpeckerPuzzleIds.current.length
    );
    if (nextStep.finished || nextStep.cycle !== woodpeckerCycleRef.current) {
      setPhase("cycle-summary");
      puzzleTransitionLockedRef.current = false;
      return;
    }

    woodpeckerIndexRef.current = nextStep.puzzleIndex;
    setWoodpeckerIndex(nextStep.puzzleIndex);
    showPrefetchedWoodpeckerPuzzleOrLoad(woodpeckerPuzzleIds.current[nextStep.puzzleIndex]);
  }

  function reviewWoodpeckerMistakes() {
    const result = woodpeckerCycleResults.find((cycleResult) => cycleResult.cycle === woodpeckerCycleRef.current);
    if (!result?.mistakePuzzleIds.length) return;
    woodpeckerReviewPuzzleIdsRef.current = result.mistakePuzzleIds;
    woodpeckerReviewIndexRef.current = 0;
    woodpeckerReviewingRef.current = true;
    setWoodpeckerReviewIndex(0);
    setWoodpeckerReviewing(true);
    beginNewSession();
    void loadPuzzle("woodpecker", result.mistakePuzzleIds[0]);
  }

  function continueWoodpeckerTraining() {
    const nextStep = nextWoodpeckerStep(
      woodpeckerCycleRef.current,
      woodpeckerPuzzleIds.current.length - 1,
      woodpeckerPuzzleIds.current.length
    );
    if (nextStep.finished) {
      setPhase("summary");
      puzzleTransitionLockedRef.current = false;
      return;
    }

    woodpeckerCycleRef.current = nextStep.cycle;
    woodpeckerIndexRef.current = nextStep.puzzleIndex;
    woodpeckerCycleSecondsRef.current = 0;
    woodpeckerCycleMistakesRef.current = 0;
    woodpeckerCycleMistakePuzzleIdsRef.current = [];
    woodpeckerReviewPuzzleIdsRef.current = [];
    woodpeckerReviewIndexRef.current = 0;
    woodpeckerReviewingRef.current = false;
    setWoodpeckerCycle(nextStep.cycle);
    setWoodpeckerIndex(nextStep.puzzleIndex);
    setWoodpeckerCycleSolved(0);
    setWoodpeckerCycleIncorrectMoves(0);
    setWoodpeckerReviewIndex(0);
    setWoodpeckerReviewing(false);
    pendingWoodpeckerCycleSaveRef.current = null;
    currentWoodpeckerCycleSaveOperationRef.current = 0;
    setWoodpeckerCycleSaveState("idle");
    setWoodpeckerCycleSaveError("");
    setWoodpeckerCycleSaveDelayed(false);
    beginNewSession();
    void loadPuzzle("woodpecker", woodpeckerPuzzleIds.current[nextStep.puzzleIndex]);
  }

  async function finishFailedAttempt(failedToken: string) {
    try {
      await fetch("/api/student/puzzle-training/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: failedToken })
      });
    } finally {
      setPhase("summary");
      setMessage("The survival run is complete.");
    }
  }

  async function exitTraining() {
    const returnToCycleSummary = woodpeckerReviewingRef.current;
    if (!token || phase !== "turn") {
      setPhase(returnToCycleSummary ? "cycle-summary" : "summary");
      return;
    }
    abortActiveMoveRequest();
    clearReplyTimer();
    cancelScheduledAdvance();
    moveLocked.current = true;
    setMessage("Saving this training attempt...");
    try {
      const response = await fetch("/api/student/puzzle-training/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? "Attempt could not be saved.");
      }
      if (returnToCycleSummary) {
        woodpeckerReviewingRef.current = false;
        setWoodpeckerReviewing(false);
        setCompletion(null);
        setPhase("cycle-summary");
      } else {
        setPhase("summary");
      }
    } catch (exitError) {
      setError(exitError instanceof Error ? exitError.message : "Attempt could not be saved.");
      setMessage("The attempt was not saved. Try again or continue training.");
      moveLocked.current = false;
    }
  }

  function executeReadyPremove() {
    const result = takeReadyPremove(premoveHandoffRef.current);
    if (!result.execution) return false;

    premoveHandoffRef.current = result.state;
    setQueuedPremove(null);
    setSelectedSquare(null);
    setLegalSquares([]);
    const { premove, reply } = result.execution;
    if (!legalDestinations(reply.fen, premove.from).includes(premove.to)) {
      setMessage("That premove is no longer legal. Choose another move.");
      return true;
    }

    setMessage(`Premove played: ${premove.from} to ${premove.to}.`);
    void submitMove(premove.from, premove.to, { fen: reply.fen, token: reply.token, isPremove: true });
    return true;
  }

  async function submitMove(from: string, to: string, context?: MoveSubmissionContext) {
    if (!puzzle || (!context?.isPremove && phase !== "turn") || moveLocked.current) return false;
    const submittedPuzzleId = puzzle.id;
    const submittedFen = context?.fen ?? positionFen;
    const submittedToken = context?.token ?? token;
    const destinations = legalDestinations(submittedFen, from);
    if (!destinations.includes(to)) {
      setSelectedSquare(null);
      setLegalSquares([]);
      return false;
    }

    moveLocked.current = true;
    clearReplyTimer();
    resetPremoveHandoff();
    setError("");
    setHintSource(null);
    setHintDestination(null);
    const previousFen = submittedFen;
    const optimisticFen = optimisticMoveFen(previousFen, from, to);
    if (!optimisticFen) {
      moveLocked.current = false;
      return false;
    }
    const studentColor = puzzle.orientation === "white" ? "w" : "b";
    if (trainingMode === "woodpecker") {
      setSelectedSquare(to);
      setLegalSquares(premoveDestinations(optimisticFen, to, studentColor));
    } else {
      setSelectedSquare(null);
      setLegalSquares([]);
    }
    setIncorrectSquare(null);
    setCorrectMove(null);
    setLastMove([from, to]);
    setPositionFen(optimisticFen);
    setMessage("Move sent. You can queue your next move now.");
    activeMoveControllerRef.current?.abort();
    const moveRequestId = ++moveRequestIdRef.current;
    const moveSessionGeneration = sessionGenerationRef.current;
    const movePuzzleGeneration = puzzleGenerationRef.current;
    const moveRequestController = new AbortController();
    activeMoveControllerRef.current = moveRequestController;
    let moveTimedOut = false;
    const moveRequestTimeout = window.setTimeout(() => {
      moveTimedOut = true;
      moveRequestController.abort();
    }, MOVE_REQUEST_TIMEOUT_MS);
    const isCurrentMoveRequest = () => mountedRef.current
      && moveRequestId === moveRequestIdRef.current
      && moveSessionGeneration === sessionGenerationRef.current
      && movePuzzleGeneration === puzzleGenerationRef.current
      && activePuzzleIdRef.current === submittedPuzzleId
      && activeMoveControllerRef.current === moveRequestController;
    try {
      const woodpeckerTarget = trainingMode === "woodpecker"
        ? nextWoodpeckerPuzzleTarget({
          cycle: woodpeckerCycleRef.current,
          puzzleIndex: woodpeckerIndexRef.current,
          puzzleIds: woodpeckerPuzzleIds.current,
          setSize: activeWoodpeckerSetSize.current,
          reviewing: woodpeckerReviewingRef.current,
          reviewPuzzleIds: woodpeckerReviewPuzzleIdsRef.current,
          reviewIndex: woodpeckerReviewIndexRef.current
        })
        : null;
      const requestSurvivalPuzzle = autoAdvance && trainingMode === "survival" && completed + 1 < SURVIVAL_PUZZLE_LIMIT;
      const response = await fetch("/api/student/puzzle-training/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: moveRequestController.signal,
        body: JSON.stringify({
          token: submittedToken,
          move: { from, to },
          requestNextPuzzle: requestSurvivalPuzzle || Boolean(woodpeckerTarget),
          nextPuzzleId: woodpeckerTarget?.kind === "exact" ? woodpeckerTarget.puzzleId : undefined,
          nextLevel: trainingMode === "survival" ? survivalDifficultyForPuzzle(completed + 2).level : selectedLevel,
          excludePuzzleIds: woodpeckerTarget?.kind === "random" ? woodpeckerPuzzleIds.current : recentPuzzleIds.current
        })
      });
      const result = await response.json() as PuzzleMoveResult & { error?: string };
      if (!isCurrentMoveRequest()) return false;
      if (!response.ok) throw new Error(result.error ?? "Move could not be checked.");
      setToken(result.token);
      if (result.completed) prefetchedNextPuzzleRef.current = result.nextPuzzle ?? null;

      if (!result.accepted) {
        resetPremoveHandoff();
        setSelectedSquare(null);
        setLegalSquares([]);
        if (!woodpeckerReviewingRef.current) {
          setIncorrectAttempts((value) => value + 1);
          if (trainingMode === "woodpecker") setWoodpeckerCycleIncorrectMoves((value) => value + 1);
          setCurrentStreak(0);
        }
        setPositionFen(result.positionFen);
        setLastMove(null);
        setIncorrectSquare(to);
        if (trainingMode === "woodpecker") {
          setMessage(woodpeckerReviewingRef.current
            ? "Not quite. Resetting this review puzzle so you can try it again."
            : "Incorrect destination. Resetting the position so you can try again.");
          window.setTimeout(() => setIncorrectSquare(null), 700);
          moveLocked.current = false;
          return false;
        }

        const remainingLives = lives - 1;
        setLives(remainingLives);
        setMessage(`Incorrect destination. ${formatSurvivalLives(remainingLives, STARTING_LIVES)}`);
        window.setTimeout(() => setIncorrectSquare(null), 700);
        if (remainingLives <= 0) {
          void finishFailedAttempt(result.token);
        } else {
          moveLocked.current = false;
        }
        return false;
      }

      setCorrectMove([from, to]);
      if (result.studentFen) setPositionFen(result.studentFen);
      setMessage(result.message);

      if (result.completed && result.completion) {
        resetPremoveHandoff();
        setSelectedSquare(null);
        setLegalSquares([]);
        if (woodpeckerReviewingRef.current) {
          setCompletion(result.completion);
          setPhase("solved");
          setMessage("Review puzzle solved.");
          moveLocked.current = false;
          if (autoAdvance) {
            setMessage("Review puzzle solved. Loading the next mistake...");
            schedulePuzzleAdvance(
              () => advanceTrainingPuzzle(submittedPuzzleId),
              WOODPECKER_AUTO_ADVANCE_DELAY_MS
            );
          }
          return true;
        }

        const nextCompleted = completed + 1;
        const nextSolved = solved + 1;
        const nextStreak = currentStreak + 1;
        setCompleted(nextCompleted);
        setSolved(nextSolved);
        setCurrentStreak(nextStreak);
        setBestStreak((value) => Math.max(value, nextStreak));
        setSolveTimes((values) => [...values, result.completion!.elapsedSeconds]);
        if (result.completion.mistakes === 0 && result.completion.hintsUsed === 0) setFirstTrySolves((value) => value + 1);
        setCompletion(result.completion);
        const woodpeckerCycleFinished = trainingMode === "woodpecker"
          && woodpeckerIndexRef.current >= woodpeckerPuzzleIds.current.length - 1
          && woodpeckerPuzzleIds.current.length >= activeWoodpeckerSetSize.current;
        if (trainingMode === "woodpecker") {
          setWoodpeckerCycleSolved((value) => value + 1);
          woodpeckerCycleSecondsRef.current += result.completion.elapsedSeconds;
          woodpeckerCycleMistakesRef.current += result.completion.mistakes;
          if (result.completion.mistakes > 0 && !woodpeckerCycleMistakePuzzleIdsRef.current.includes(puzzle.id)) {
            woodpeckerCycleMistakePuzzleIdsRef.current = [...woodpeckerCycleMistakePuzzleIdsRef.current, puzzle.id];
          }
          if (woodpeckerCycleFinished) {
            const cycleStats = calculateWoodpeckerCycleStats(
              activeWoodpeckerSetSize.current,
              woodpeckerCycleMistakesRef.current,
              woodpeckerCycleSecondsRef.current
            );
            const cycleResult: WoodpeckerCycleResult = {
              cycle: woodpeckerCycleRef.current,
              puzzlesSolved: activeWoodpeckerSetSize.current,
              incorrectMoves: woodpeckerCycleMistakesRef.current,
              elapsedSeconds: woodpeckerCycleSecondsRef.current,
              mistakePuzzleIds: woodpeckerCycleMistakePuzzleIdsRef.current,
              reviewed: false,
              ...cycleStats
            };
            setWoodpeckerCycleResults((results) => [
              ...results.filter((savedResult) => savedResult.cycle !== cycleResult.cycle),
              cycleResult
            ].sort((left, right) => left.cycle - right.cycle));
            setPhase("cycle-summary");
            setMessage(`Cycle ${woodpeckerCycleRef.current} complete.`);
            moveLocked.current = false;
            puzzleTransitionLockedRef.current = false;
            const completedCycleSessionId = sessionId.current;
            const completedCycleNumber = woodpeckerCycleRef.current;
            const completedRunId = woodpeckerRunIdRef.current;
            if (!completedRunId) {
              setWoodpeckerCycleSaveState("error");
              setWoodpeckerCycleSaveError("This Woodpecker run is missing its verification ID. Start a new set.");
              return true;
            }
            const completedCycleSessionIds = [...woodpeckerCycleSessionIdsRef.current];
            completedCycleSessionIds[completedCycleNumber - 1] = completedCycleSessionId;
            woodpeckerCycleSessionIdsRef.current = completedCycleSessionIds;
            void persistWoodpeckerCycleOverview({
              sessionId: completedCycleSessionId,
              setSize: activeWoodpeckerSetSize.current,
              runId: completedRunId,
              cycleNumber: completedCycleNumber,
              cycleSessionIds: completedCycleSessionIds.slice(0, completedCycleNumber)
            });
            return true;
          }
        }
        const sessionFinished = trainingMode === "daily"
          || (trainingMode === "survival" && nextCompleted >= SURVIVAL_PUZZLE_LIMIT)
          || (trainingMode === "woodpecker" && woodpeckerCycleRef.current >= WOODPECKER_CYCLE_COUNT && woodpeckerCycleFinished);
        setPhase(sessionFinished ? "summary" : "solved");
        moveLocked.current = false;
        if (!sessionFinished && autoAdvance) {
          setMessage("Correct! Loading the next puzzle...");
          schedulePuzzleAdvance(() => {
            if (trainingMode === "survival" && result.nextPuzzle) {
              if (!claimPuzzleTransition(submittedPuzzleId)) return;
              showPuzzle(result.nextPuzzle, "survival");
            } else {
              advanceTrainingPuzzle(submittedPuzzleId);
            }
          }, trainingMode === "woodpecker" ? WOODPECKER_AUTO_ADVANCE_DELAY_MS : AUTO_ADVANCE_DELAY_MS);
        }
        return true;
      }

      const replyContext = { fen: result.positionFen, token: result.token };
      premoveHandoffRef.current = withPremoveReply(premoveHandoffRef.current, replyContext);
      setPositionFen(result.positionFen);
      if (trainingMode === "woodpecker" && new Chess(result.positionFen).get(to as Square)?.color === studentColor) {
        setSelectedSquare(to);
        setLegalSquares(legalDestinations(result.positionFen, to));
      } else {
        setSelectedSquare(null);
        setLegalSquares([]);
      }
      if (result.opponentMove) {
        const reply = parseUciMove(result.opponentMove);
        setLastMove([reply.from, reply.to]);
      }
      setCorrectMove(null);

      if (trainingMode === "woodpecker") {
        premoveHandoffRef.current = withPremoveReplyReady(premoveHandoffRef.current);
        setPhase("turn");
        moveLocked.current = false;
        if (!executeReadyPremove()) setMessage("Your turn. Continue the solution.");
        return true;
      }

      setPhase("reply");
      setMessage(premoveHandoffRef.current.queued
        ? "Opponent replied. Your premove is ready."
        : "Opponent replied. Queue your next move while the pieces settle.");
      const replySessionGeneration = sessionGenerationRef.current;
      const replyPuzzleGeneration = puzzleGenerationRef.current;
      replyTimer.current = setTimeout(() => {
        replyTimer.current = null;
        if (!mountedRef.current
          || sessionGenerationRef.current !== replySessionGeneration
          || puzzleGenerationRef.current !== replyPuzzleGeneration
          || activePuzzleIdRef.current !== submittedPuzzleId) return;
        premoveHandoffRef.current = withPremoveReplyReady(premoveHandoffRef.current);
        setPhase("turn");
        moveLocked.current = false;
        if (!executeReadyPremove()) setMessage("Your turn. Continue the solution.");
      }, OPPONENT_REPLY_DELAY_MS);
      return true;
    } catch (moveError) {
      if (!isCurrentMoveRequest()) return false;
      resetPremoveHandoff();
      setSelectedSquare(null);
      setLegalSquares([]);
      setPositionFen(previousFen);
      setLastMove(null);
      setCorrectMove(null);
      setError(moveTimedOut
        ? "The move check took too long. Your position was restored."
        : moveError instanceof Error ? moveError.message : "Move could not be checked.");
      setMessage(moveTimedOut ? "Connection recovered. Play the move again." : "The move was not submitted. Try again.");
      moveLocked.current = false;
      return false;
    } finally {
      clearTimeout(moveRequestTimeout);
      if (activeMoveControllerRef.current === moveRequestController) {
        activeMoveControllerRef.current = null;
      }
    }
  }

  function availablePremoveDestinations(source: string, studentColor: "w" | "b") {
    return phase === "reply"
      ? legalDestinations(positionFen, source)
      : premoveDestinations(positionFen, source, studentColor);
  }

  function queuePremove(from: string, to: string, studentColor: "w" | "b") {
    if (!availablePremoveDestinations(from, studentColor).includes(to)) {
      setSelectedSquare(null);
      setLegalSquares([]);
      return false;
    }
    updateQueuedPremove({ from, to });
    setSelectedSquare(null);
    setLegalSquares([]);
    setMessage(`Premove queued: ${from} to ${to}. It will play after the reply.`);
    executeReadyPremove();
    return true;
  }

  function handleSquareClick(square: string) {
    if (!puzzle) return;
    const isPremoveWindow = phase === "reply" || (phase === "turn" && moveLocked.current);
    if (phase !== "turn" && !isPremoveWindow) return;
    const chess = new Chess(positionFen);
    const piece = chess.get(square as Square);
    const studentColor = puzzle.orientation === "white" ? "w" : "b";

    if (selectedSquare && legalSquares.includes(square)) {
      if (isPremoveWindow) {
        queuePremove(selectedSquare, square, studentColor);
      } else {
        void submitMove(selectedSquare, square);
      }
      return;
    }

    if (piece?.color === studentColor) {
      setSelectedSquare(square);
      setLegalSquares(isPremoveWindow
        ? availablePremoveDestinations(square, studentColor)
        : legalDestinations(positionFen, square));
      return;
    }

    setSelectedSquare(null);
    setLegalSquares([]);
  }

  async function requestHint() {
    if (!token || phase !== "turn" || moveLocked.current) return;
    const hintSessionGeneration = sessionGenerationRef.current;
    const hintPuzzleGeneration = puzzleGenerationRef.current;
    const hintPuzzleId = activePuzzleIdRef.current;
    const isCurrentHintRequest = () => mountedRef.current
      && sessionGenerationRef.current === hintSessionGeneration
      && puzzleGenerationRef.current === hintPuzzleGeneration
      && activePuzzleIdRef.current === hintPuzzleId;
    try {
      const response = await fetch("/api/student/puzzle-training/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await response.json() as { token?: string; hint?: { source: string; destination?: string }; error?: string };
      if (!isCurrentHintRequest()) return;
      if (!response.ok || !data.token || !data.hint) throw new Error(data.error ?? "Hint is unavailable.");
      setToken(data.token);
      setHintSource(data.hint.source);
      setHintDestination(data.hint.destination ?? null);
      setMessage(data.hint.destination ? "Hint: this is the destination square." : "Hint: this is the piece to move.");
    } catch (hintError) {
      if (!isCurrentHintRequest()) return;
      setError(hintError instanceof Error ? hintError.message : "Hint is unavailable.");
    }
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (selectedSquare) styles[selectedSquare] = { boxShadow: "inset 0 0 0 4px #fbbf24" };
    for (const square of legalSquares) styles[square] = { background: "radial-gradient(circle, rgba(253,230,138,.9) 0 18%, transparent 20%)" };
    for (const square of lastMove ?? []) styles[square] = { ...styles[square], boxShadow: "inset 0 0 0 4px rgba(103,232,249,.85)" };
    for (const square of correctMove ?? []) styles[square] = { ...styles[square], boxShadow: "inset 0 0 0 5px #facc15" };
    if (queuedPremove) {
      styles[queuedPremove.from] = { ...styles[queuedPremove.from], boxShadow: "inset 0 0 0 5px #c084fc", backgroundColor: "rgba(168,85,247,.22)" };
      styles[queuedPremove.to] = { ...styles[queuedPremove.to], boxShadow: "inset 0 0 0 5px #e879f9", backgroundColor: "rgba(232,121,249,.24)" };
    }
    if (incorrectSquare) styles[incorrectSquare] = { background: "repeating-linear-gradient(45deg, rgba(244,114,182,.75) 0 8px, rgba(30,41,59,.75) 8px 16px)", boxShadow: "inset 0 0 0 5px #f8fafc" };
    if (hintSource) styles[hintSource] = { ...styles[hintSource], boxShadow: "inset 0 0 0 5px #c084fc" };
    if (hintDestination) styles[hintDestination] = { ...styles[hintDestination], boxShadow: "inset 0 0 0 5px #f0abfc" };
    return styles;
  }, [correctMove, hintDestination, hintSource, incorrectSquare, lastMove, legalSquares, queuedPremove, selectedSquare]);

  const boardOptions: ChessboardOptions = {
    id: "academy-puzzle-board",
    position: positionFen || undefined,
    boardOrientation: puzzle?.orientation ?? "white",
    showNotation: true,
    ...BOARD_MOTION_OPTIONS,
    ...BOARD_INTERACTION_OPTIONS,
    animationDurationInMs: trainingMode === "woodpecker" ? 0 : BOARD_MOTION_OPTIONS.animationDurationInMs,
    showAnimations: trainingMode !== "woodpecker",
    allowDragging: phase === "turn" || phase === "reply",
    squareStyles,
    arrows: queuedPremove ? [{ startSquare: queuedPremove.from, endSquare: queuedPremove.to, color: "#c084fc" }] : [],
    onArrowsChange: ({ arrows }) => setHasBoardAnnotations(arrows.length > 0),
    clearArrowsOnClick: false,
    clearArrowsOnPositionChange: false,
    lightSquareStyle: { backgroundColor: "#cffafe" },
    darkSquareStyle: { backgroundColor: "#0e7490" },
    boardStyle: { borderRadius: 8, touchAction: "none", boxShadow: "0 0 36px rgba(34,211,238,.22)" },
    canDragPiece: ({ piece }) => (phase === "turn" || phase === "reply") && piece.pieceType.startsWith(puzzle?.orientation === "black" ? "b" : "w"),
    onSquareClick: ({ square }) => handleSquareClick(square),
    onPieceDrop: ({ sourceSquare, targetSquare }) => {
      if (!targetSquare || !puzzle) return false;
      const studentColor = puzzle.orientation === "white" ? "w" : "b";
      const isPremoveWindow = phase === "reply" || (phase === "turn" && moveLocked.current);
      const destinations = isPremoveWindow
        ? availablePremoveDestinations(sourceSquare, studentColor)
        : legalDestinations(positionFen, sourceSquare);
      if (!destinations.includes(targetSquare)) return false;
      if (isPremoveWindow) {
        queuePremove(sourceSquare, targetSquare, studentColor);
        return false;
      }
      void submitMove(sourceSquare, targetSquare);
      return true;
    }
  };

  const averageTime = solveTimes.length ? Math.round(solveTimes.reduce((sum, value) => sum + value, 0) / solveTimes.length) : 0;
  const selectedThemeOption = puzzleThemeOptions.find((theme) => theme.id === selectedTheme);
  const selectedThemeName = selectedThemeOption?.name ?? "Mixed tactics";
  const selectedLevelName = PUZZLE_DIFFICULTY_OPTIONS.find((level) => level.id === selectedLevel)?.name ?? "Any difficulty";
  const visibleSurvivalPuzzleNumber = phase === "solved" ? Math.max(1, completed) : completed + 1;
  const survivalDifficulty = survivalDifficultyForPuzzle(visibleSurvivalPuzzleNumber);
  const activeDifficultyName = trainingMode === "survival" ? survivalDifficulty.name : selectedLevelName;
  const summaryEyebrow = trainingMode === "daily" ? "Daily Challenge Complete" : trainingMode === "woodpecker" ? "Woodpecker Set Complete" : "Survival Run Complete";
  const summaryTitle = trainingMode === "daily" ? "Puzzle of the Day" : trainingMode === "woodpecker" ? "Woodpecker Training Report" : "Academy Training Report";
  const currentWoodpeckerCycleResult = woodpeckerCycleResults.find((result) => result.cycle === woodpeckerCycle);
  const primaryProgress = trainingMode === "daily"
    ? "Daily"
    : trainingMode === "woodpecker"
      ? woodpeckerReviewing
        ? `Review ${Math.min(woodpeckerReviewIndex + 1, woodpeckerReviewPuzzleIdsRef.current.length)}/${woodpeckerReviewPuzzleIdsRef.current.length}`
        : `${Math.min(woodpeckerIndex + 1, activeWoodpeckerSetSize.current)}/${activeWoodpeckerSetSize.current}`
      : `${Math.min(visibleSurvivalPuzzleNumber, SURVIVAL_PUZZLE_LIMIT)}/${SURVIVAL_PUZZLE_LIMIT}`;
  const secondaryMetric: [string, ReactNode] = trainingMode === "woodpecker"
    ? ["Cycle", `${woodpeckerCycle}/${WOODPECKER_CYCLE_COUNT}`]
    : ["Lives", <span key="survival-lives" role="img" aria-label={`${lives} of ${STARTING_LIVES} lives remaining`}>{formatSurvivalLives(lives, STARTING_LIVES)}</span>];
  const activeAccuracy = trainingMode === "woodpecker"
    ? calculatePuzzleAccuracy(woodpeckerCycleSolved, woodpeckerCycleIncorrectMoves)
    : calculatePuzzleAccuracy(solved, incorrectAttempts);

  if (phase === "select") {
    return (
      <PuzzleModeSetup
        selectedMode={setupMode}
        onModeChange={setSetupMode}
        selectedTheme={selectedTheme}
        onThemeChange={chooseTheme}
        selectedLevel={selectedLevel}
        onLevelChange={chooseLevel}
        woodpeckerSetSize={woodpeckerSetSize}
        onWoodpeckerSetSizeChange={setWoodpeckerSetSize}
        autoAdvance={autoAdvance}
        onAutoAdvanceChange={updateAutoAdvance}
        onStart={setupMode === "survival" ? startSurvival : setupMode === "woodpecker" ? startWoodpecker : startStarWars}
        onDailyPuzzle={startDailyPuzzle}
        overview={overview}
      />
    );
  }

  if (phase === "star-wars") {
    return <StarWarsTraining onExit={() => setPhase("select")} />;
  }

  if (phase === "summary") {
    return (
      <Card className="p-6">
        <p className="text-xs font-black uppercase text-amber-200">{summaryEyebrow}</p>
        <h2 className="mt-2 text-3xl font-black text-white">{summaryTitle}</h2>
        {completion?.dailyReward && <div className={`mt-5 rounded-lg border p-4 ${completion.dailyReward.awarded ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-cyan-200/30 bg-cyan-300/10 text-cyan-100"}`}><p className="font-black">{completion.dailyReward.awarded ? `Reward claimed: +${completion.dailyReward.xpAwarded} XP and +${completion.dailyReward.coinsAwarded} Academy Coins` : "Today’s reward was already claimed. Nice practice replay!"}</p></div>}
        {trainingMode === "woodpecker"
          && woodpeckerCycleResults.some((result) => result.cycle >= WOODPECKER_CYCLE_COUNT)
          && woodpeckerCycleSaveState !== "saved" && (
          <div className={`mt-5 rounded-lg border p-4 ${woodpeckerCycleSaveState === "error" ? "border-rose-300/40 bg-rose-300/10 text-rose-100" : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"}`} aria-live="polite">
            <p className="font-black">{woodpeckerCycleSaveState === "error"
              ? "Quest verification still needs another try."
              : woodpeckerCycleSaveDelayed
                ? "Verification is taking a little longer."
                : "Verifying Conquer the Woodpecker..."}</p>
            {woodpeckerCycleSaveState !== "error" && woodpeckerCycleSaveDelayed && (
              <p className="mt-1 text-sm text-slate-300">Your completed set is still being saved. You do not need to retry.</p>
            )}
            {woodpeckerCycleSaveState === "error" && (
              <>
                <p className="mt-1 text-sm text-slate-300">{woodpeckerCycleSaveError || "The completed set could not be verified."}</p>
                <Button type="button" variant="secondary" onClick={retryWoodpeckerCycleSave} className="mt-3">Retry Verification</Button>
              </>
            )}
          </div>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[['Solved', solved], ['First try', firstTrySolves], ['Mistakes', incorrectAttempts], ['Accuracy', `${calculatePuzzleAccuracy(solved, incorrectAttempts)}%`], ['Average', formatTime(averageTime)], ['Best streak', bestStreak]].map(([label, value]) => (
            <div key={String(label)} className="rounded-md border border-white/10 bg-white/5 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p></div>
          ))}
        </div>
        {trainingMode === "woodpecker" && woodpeckerCycleResults.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-xs font-black uppercase tracking-wide text-cyan-100">Cycle history</p>
            {woodpeckerCycleResults.map((result) => (
              <div key={result.cycle} className="grid gap-2 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm sm:grid-cols-[auto_repeat(3,minmax(0,1fr))] sm:items-center sm:gap-3">
                <span className="font-black text-white">Cycle {result.cycle}</span>
                <span className="text-slate-300"><strong className="text-white">{result.puzzlesPerMinute.toFixed(1)}</strong> puzzles/min</span>
                <span className="text-slate-300"><strong className="text-white">{result.accuracy}%</strong> accuracy</span>
                <span className="text-slate-300"><strong className="text-white">{result.mistakePuzzleIds.length}</strong> mistake puzzles</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3"><Button type="button" onClick={trainingMode === "daily" ? startDailyPuzzle : trainingMode === "woodpecker" ? startWoodpecker : startSurvival}>{trainingMode === "daily" ? "Play Again" : "Train Again"}</Button><Button type="button" variant="ghost" onClick={returnToPuzzleSetup}>Back to Puzzles</Button></div>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-white/10 sm:grid-cols-6">
          {[["Puzzle", primaryProgress], secondaryMetric, ['Timer', <PuzzleTimer key={`${sessionId.current}:${puzzle?.id ?? "loading"}`} running={phase === "turn" || phase === "reply"} />], ['Accuracy', `${activeAccuracy}%`], ['Streak', currentStreak], ['Best', bestStreak]].map(([label, value]) => (
            <div key={String(label)} className="p-3 text-center"><p className="text-[10px] font-black uppercase text-slate-500 sm:text-xs">{label}</p><p className="mt-1 text-lg font-black text-white sm:text-2xl">{value}</p></div>
          ))}
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,640px)_minmax(280px,1fr)]">
        <div ref={puzzleBoardRef} className="mx-auto w-full max-w-[640px] overflow-hidden rounded-lg border border-cyan-200/20 bg-slate-950/70">
          {positionFen ? <Chessboard key={`academy-puzzle-board-${puzzle?.id ?? "loading"}-${annotationResetKey}`} options={boardOptions} /> : <div className="flex aspect-square items-center justify-center text-sm text-slate-400">Preparing board...</div>}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><span className="rounded border border-cyan-200/30 bg-cyan-300/10 px-2 py-1 text-xs font-black uppercase text-cyan-100">{trainingMode === "daily" ? "Puzzle of the Day" : selectedThemeName}</span>{trainingMode !== "daily" && <span className="rounded border border-amber-200/30 bg-amber-300/10 px-2 py-1 text-xs font-black uppercase text-amber-100">{activeDifficultyName}</span>}{woodpeckerReviewing && <span className="rounded border border-fuchsia-200/30 bg-fuchsia-300/10 px-2 py-1 text-xs font-black uppercase text-fuchsia-100">Mistake review</span>}</div><span className="text-xs font-bold text-slate-400">{puzzle ? `${puzzle.sideToMove} to move` : "Loading"}</span></div>
            {puzzle?.daily && <div className={`mt-4 rounded-md border p-3 text-sm font-bold ${puzzle.daily.rewardClaimed ? "border-cyan-200/25 bg-cyan-300/5 text-cyan-100" : "border-amber-200/35 bg-amber-300/10 text-amber-100"}`}>{puzzle.daily.rewardClaimed ? "Reward already claimed today — replay for practice." : `Available reward: +${puzzle.daily.xp} XP and +${puzzle.daily.coins} Academy Coins`}</div>}
            {trainingMode !== "daily" && <div className="mt-4"><AutoAdvanceSwitch checked={autoAdvance} onChange={updateAutoAdvance} compact /></div>}
            <h2 className="mt-4 text-2xl font-black text-white">{phase === "reply" || (phase === "turn" && moveLocked.current) ? "Queue your next move" : phase === "solved" ? "Puzzle complete" : puzzle?.prompt || "Find the best move"}</h2>
            <div className={`mt-4 rounded-md border p-3 text-sm font-bold ${phase === "solved" ? "border-amber-300/50 bg-amber-300/10 text-amber-100" : error ? "border-fuchsia-300/50 bg-fuchsia-300/10 text-fuchsia-100" : "border-white/10 bg-white/5 text-slate-200"}`} aria-live="polite">{error || message}</div>
            {queuedPremove && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-fuchsia-300/40 bg-fuchsia-300/10 p-3">
                <p className="text-sm font-black text-fuchsia-100">Premove: {queuedPremove.from} → {queuedPremove.to}</p>
                <Button type="button" variant="ghost" onClick={() => cancelPremove()}>Cancel</Button>
              </div>
            )}
            {phase === "turn" && <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => void requestHint()}>Hint</Button><Button type="button" variant="ghost" onClick={() => void exitTraining()}>{woodpeckerReviewing ? "Return to Cycle Results" : "Exit Training"}</Button></div>}
            {phase === "solved" && <Button type="button" onClick={() => advanceTrainingPuzzle(puzzle?.id)} className="mt-4">{woodpeckerReviewing ? woodpeckerReviewIndex + 1 >= woodpeckerReviewPuzzleIdsRef.current.length ? "Finish Review" : "Next Mistake" : "Next Puzzle"}</Button>}
            {phase === "error" && <div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={() => void loadPuzzle(trainingMode, requestedPuzzleIdRef.current ?? undefined)}>Try Again</Button><Button type="button" variant="ghost" onClick={() => setPhase("select")}>Choose Theme</Button></div>}
          </Card>

          {completion && (
            <Card className="p-5">
              <p className="text-xs font-black uppercase text-amber-200">Solved Details</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Themes</dt><dd className="font-bold text-white">{completion.themes.join(", ")}</dd></div><div><dt className="text-slate-500">Rating</dt><dd className="font-bold text-white">{completion.rating ?? "Unrated"}</dd></div><div><dt className="text-slate-500">Mistakes</dt><dd className="font-bold text-white">{completion.mistakes}</dd></div><div><dt className="text-slate-500">Solve time</dt><dd className="font-bold text-white">{formatTime(completion.elapsedSeconds)}</dd></div></dl>
              {completion.gameUrl && <a href={completion.gameUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4">View original Lichess game</a>}
            </Card>
          )}

          <p className="text-xs text-slate-500">{puzzle?.sourceKind === "study" ? "Teacher-authored Chess Academy position." : "Puzzle data from the Lichess open database."}</p>
        </div>
      </div>
      </div>

      {phase === "cycle-summary" && currentWoodpeckerCycleResult && (
        <WoodpeckerCycleSummary
          result={currentWoodpeckerCycleResult}
          saveState={woodpeckerCycleSaveState}
          saveError={woodpeckerCycleSaveError}
          saveDelayed={woodpeckerCycleSaveDelayed}
          onReviewMistakes={reviewWoodpeckerMistakes}
          onRetrySave={retryWoodpeckerCycleSave}
          onContinue={continueWoodpeckerTraining}
          onReturnToTraining={returnFromWoodpeckerCycleSummary}
        />
      )}
    </>
  );
}

function woodpeckerCycleSaveKey(input: PendingWoodpeckerCycleSave) {
  return `${input.runId}:${input.cycleNumber}:${input.sessionId}`;
}
