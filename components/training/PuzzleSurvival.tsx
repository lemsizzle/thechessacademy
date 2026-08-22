"use client";

import { Chess, type Square } from "chess.js";
import { Chessboard, type ChessboardOptions } from "react-chessboard";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BOARD_MOTION_OPTIONS } from "@/chess/components/boardMotion";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AutoAdvanceSwitch, PuzzleModeSetup, type PuzzleModeChoice } from "@/components/training/PuzzleModeSetup";
import { legalDestinations, parseUciMove } from "@/lib/puzzle-training/engine";
import { nextWoodpeckerStep, PUZZLE_DIFFICULTY_OPTIONS, SURVIVAL_PUZZLE_LIMIT, survivalDifficultyForPuzzle, WOODPECKER_ROUND_COUNT, WOODPECKER_SET_SIZE } from "@/lib/puzzle-training/modes";
import { parsePuzzleLevel, parsePuzzleTheme, puzzleThemeOptions, type PublicTrainingPuzzle, type PuzzleCompletionDetails, type PuzzleLevelSlug, type PuzzleMoveResult, type PuzzleThemeSlug } from "@/lib/puzzle-training/types";

const STARTING_LIVES = 3;
const OPPONENT_REPLY_DELAY_MS = 40;
const AUTO_ADVANCE_DELAY_MS = 140;
const AUTO_ADVANCE_STORAGE_KEY = "academy-puzzles-auto-advance";

type TrainerPhase = "select" | "loading" | "turn" | "reply" | "solved" | "summary" | "error";
type TrainingMode = "survival" | "woodpecker" | "daily";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function percentage(solved: number, mistakes: number) {
  const total = solved + mistakes;
  return total ? Math.round((solved / total) * 100) : 100;
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

export function PuzzleSurvival() {
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
  const woodpeckerRoundRef = useRef(1);
  const woodpeckerIndexRef = useRef(0);
  const requestedPuzzleIdRef = useRef<string | null>(null);
  const [woodpeckerRound, setWoodpeckerRound] = useState(1);
  const [woodpeckerIndex, setWoodpeckerIndex] = useState(0);
  const sessionId = useRef(crypto.randomUUID());
  const moveLocked = useRef(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAutoAdvance(window.localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY) === "true");
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  function updateAutoAdvance(enabled: boolean) {
    setAutoAdvance(enabled);
    window.localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, String(enabled));
    if (!enabled && advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
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
  }

  function showPuzzle(nextPuzzle: PublicTrainingPuzzle, mode = trainingMode) {
    setError("");
    setCompletion(null);
    clearBoardMarks();
    setPuzzle(nextPuzzle);
    setPositionFen(nextPuzzle.displayFen);
    setToken(nextPuzzle.token);
    if (mode === "woodpecker" && woodpeckerRoundRef.current === 1 && woodpeckerPuzzleIds.current.length < activeWoodpeckerSetSize.current) {
      const nextIndex = woodpeckerPuzzleIds.current.length;
      woodpeckerPuzzleIds.current = [...woodpeckerPuzzleIds.current, nextPuzzle.id];
      woodpeckerIndexRef.current = nextIndex;
      setWoodpeckerIndex(nextIndex);
    }
    recentPuzzleIds.current = [...recentPuzzleIds.current, nextPuzzle.id].slice(-20);
    setMessage(nextPuzzle.prompt || "Your turn. Find the best move.");
    setPhase("turn");
    moveLocked.current = false;
  }

  async function loadPuzzle(mode = trainingMode, requestedPuzzleId?: string, survivalPuzzleNumber = completed + 1) {
    setTrainingMode(mode);
    requestedPuzzleIdRef.current = requestedPuzzleId ?? null;
    setPhase("loading");
    setError("");
    setMessage("Preparing the next position...");
    setCompletion(null);
    clearBoardMarks();
    moveLocked.current = false;
    const requestedLevel = mode === "survival" ? survivalDifficultyForPuzzle(survivalPuzzleNumber).level : selectedLevel;
    const query = new URLSearchParams({ theme: selectedTheme, level: requestedLevel, sessionId: sessionId.current });
    if (mode === "daily") query.set("daily", "1");
    if (requestedPuzzleId) query.set("puzzleId", requestedPuzzleId);
    const excludedPuzzleIds = mode === "woodpecker" && woodpeckerRoundRef.current === 1
      ? woodpeckerPuzzleIds.current
      : recentPuzzleIds.current.slice(-10);
    if (!requestedPuzzleId && excludedPuzzleIds.length) query.set("exclude", excludedPuzzleIds.join(","));

    try {
      const response = await fetch(`/api/student/puzzle-training/puzzle?${query}`, { cache: "no-store" });
      const data = await response.json() as { puzzle?: PublicTrainingPuzzle; error?: string };
      if (!response.ok || !data.puzzle) throw new Error(data.error ?? "Puzzle could not be loaded.");
      showPuzzle(data.puzzle, mode);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Puzzle could not be loaded.");
      setPhase("error");
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
    woodpeckerPuzzleIds.current = [];
    woodpeckerRoundRef.current = 1;
    woodpeckerIndexRef.current = 0;
    setWoodpeckerRound(1);
    setWoodpeckerIndex(0);
  }

  function startSurvival() {
    setTrainingMode("survival");
    sessionId.current = crypto.randomUUID();
    recentPuzzleIds.current = [];
    resetWoodpeckerProgress();
    resetTrainingStats();
    void loadPuzzle("survival", undefined, 1);
  }

  function startWoodpecker() {
    setTrainingMode("woodpecker");
    activeWoodpeckerSetSize.current = woodpeckerSetSize;
    sessionId.current = crypto.randomUUID();
    recentPuzzleIds.current = [];
    resetWoodpeckerProgress();
    resetTrainingStats();
    void loadPuzzle("woodpecker");
  }

  function startDailyPuzzle() {
    sessionId.current = crypto.randomUUID();
    recentPuzzleIds.current = [];
    setTrainingMode("daily");
    resetWoodpeckerProgress();
    resetTrainingStats();
    void loadPuzzle("daily");
  }

  function advanceTrainingPuzzle() {
    if (trainingMode !== "woodpecker") {
      void loadPuzzle(trainingMode);
      return;
    }

    if (woodpeckerRoundRef.current === 1 && woodpeckerPuzzleIds.current.length < activeWoodpeckerSetSize.current) {
      void loadPuzzle("woodpecker");
      return;
    }

    const nextStep = nextWoodpeckerStep(
      woodpeckerRoundRef.current,
      woodpeckerIndexRef.current,
      woodpeckerPuzzleIds.current.length
    );
    if (nextStep.finished) {
      setPhase("summary");
      return;
    }

    if (nextStep.round !== woodpeckerRoundRef.current) {
      sessionId.current = crypto.randomUUID();
    }
    woodpeckerRoundRef.current = nextStep.round;
    woodpeckerIndexRef.current = nextStep.puzzleIndex;
    setWoodpeckerRound(nextStep.round);
    setWoodpeckerIndex(nextStep.puzzleIndex);
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
    if (!token || phase !== "turn") {
      setPhase("summary");
      return;
    }
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
      setPhase("summary");
    } catch (exitError) {
      setError(exitError instanceof Error ? exitError.message : "Attempt could not be saved.");
      setMessage("The attempt was not saved. Try again or continue training.");
      moveLocked.current = false;
    }
  }

  async function submitMove(from: string, to: string) {
    if (!puzzle || phase !== "turn" || moveLocked.current) return false;
    const destinations = legalDestinations(positionFen, from);
    if (!destinations.includes(to)) {
      setSelectedSquare(null);
      setLegalSquares([]);
      return false;
    }

    moveLocked.current = true;
    const previousFen = positionFen;
    const optimisticFen = optimisticMoveFen(previousFen, from, to);
    if (!optimisticFen) {
      moveLocked.current = false;
      return false;
    }
    setSelectedSquare(null);
    setLegalSquares([]);
    setIncorrectSquare(null);
    setCorrectMove(null);
    setLastMove([from, to]);
    setPositionFen(optimisticFen);
    setMessage("Checking move...");
    try {
      const response = await fetch("/api/student/puzzle-training/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          move: { from, to },
          requestNextPuzzle: autoAdvance && trainingMode === "survival" && completed + 1 < SURVIVAL_PUZZLE_LIMIT,
          nextLevel: trainingMode === "survival" ? survivalDifficultyForPuzzle(completed + 2).level : selectedLevel,
          excludePuzzleIds: recentPuzzleIds.current
        })
      });
      const result = await response.json() as PuzzleMoveResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Move could not be checked.");
      setToken(result.token);

      if (!result.accepted) {
        setIncorrectAttempts((value) => value + 1);
        setCurrentStreak(0);
        setPositionFen(result.positionFen);
        setLastMove(null);
        setIncorrectSquare(to);
        if (trainingMode === "woodpecker") {
          setMessage("Incorrect destination. Resetting the position so you can try again.");
          window.setTimeout(() => setIncorrectSquare(null), 700);
          moveLocked.current = false;
          return false;
        }

        const remainingLives = lives - 1;
        setLives(remainingLives);
        setMessage(`Incorrect destination. ${Math.max(remainingLives, 0)} ${remainingLives === 1 ? "chance" : "chances"} left.`);
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
        const sessionFinished = trainingMode === "daily"
          || (trainingMode === "survival" && nextCompleted >= SURVIVAL_PUZZLE_LIMIT)
          || (trainingMode === "woodpecker"
            && woodpeckerRoundRef.current >= WOODPECKER_ROUND_COUNT
            && woodpeckerIndexRef.current >= woodpeckerPuzzleIds.current.length - 1
            && woodpeckerPuzzleIds.current.length >= activeWoodpeckerSetSize.current);
        setPhase(sessionFinished ? "summary" : "solved");
        moveLocked.current = false;
        if (!sessionFinished && autoAdvance) {
          setMessage("Correct! Loading the next puzzle...");
          advanceTimer.current = setTimeout(() => {
            advanceTimer.current = null;
            if (trainingMode === "survival" && result.nextPuzzle) {
              showPuzzle(result.nextPuzzle, "survival");
            } else {
              advanceTrainingPuzzle();
            }
          }, AUTO_ADVANCE_DELAY_MS);
        }
        return true;
      }

      setPhase("reply");
      replyTimer.current = setTimeout(() => {
        setPositionFen(result.positionFen);
        if (result.opponentMove) {
          const reply = parseUciMove(result.opponentMove);
          setLastMove([reply.from, reply.to]);
        }
        setCorrectMove(null);
        setMessage("Your turn. Continue the solution.");
        setPhase("turn");
        moveLocked.current = false;
      }, OPPONENT_REPLY_DELAY_MS);
      return true;
    } catch (moveError) {
      setPositionFen(previousFen);
      setLastMove(null);
      setCorrectMove(null);
      setError(moveError instanceof Error ? moveError.message : "Move could not be checked.");
      setMessage("The move was not submitted. Try again.");
      moveLocked.current = false;
      return false;
    }
  }

  function handleSquareClick(square: string) {
    if (!puzzle || phase !== "turn" || moveLocked.current) return;
    const chess = new Chess(positionFen);
    const piece = chess.get(square as Square);
    const studentColor = puzzle.orientation === "white" ? "w" : "b";

    if (selectedSquare && legalSquares.includes(square)) {
      void submitMove(selectedSquare, square);
      return;
    }

    if (piece?.color === studentColor) {
      setSelectedSquare(square);
      setLegalSquares(legalDestinations(positionFen, square));
      return;
    }

    setSelectedSquare(null);
    setLegalSquares([]);
  }

  async function requestHint() {
    if (!token || phase !== "turn" || moveLocked.current) return;
    try {
      const response = await fetch("/api/student/puzzle-training/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await response.json() as { token?: string; hint?: { source: string; destination?: string }; error?: string };
      if (!response.ok || !data.token || !data.hint) throw new Error(data.error ?? "Hint is unavailable.");
      setToken(data.token);
      setHintSource(data.hint.source);
      setHintDestination(data.hint.destination ?? null);
      setMessage(data.hint.destination ? "Hint: this is the destination square." : "Hint: this is the piece to move.");
    } catch (hintError) {
      setError(hintError instanceof Error ? hintError.message : "Hint is unavailable.");
    }
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (selectedSquare) styles[selectedSquare] = { boxShadow: "inset 0 0 0 4px #fbbf24" };
    for (const square of legalSquares) styles[square] = { background: "radial-gradient(circle, rgba(253,230,138,.9) 0 18%, transparent 20%)" };
    for (const square of lastMove ?? []) styles[square] = { ...styles[square], boxShadow: "inset 0 0 0 4px rgba(103,232,249,.85)" };
    for (const square of correctMove ?? []) styles[square] = { ...styles[square], boxShadow: "inset 0 0 0 5px #facc15" };
    if (incorrectSquare) styles[incorrectSquare] = { background: "repeating-linear-gradient(45deg, rgba(244,114,182,.75) 0 8px, rgba(30,41,59,.75) 8px 16px)", boxShadow: "inset 0 0 0 5px #f8fafc" };
    if (hintSource) styles[hintSource] = { ...styles[hintSource], boxShadow: "inset 0 0 0 5px #c084fc" };
    if (hintDestination) styles[hintDestination] = { ...styles[hintDestination], boxShadow: "inset 0 0 0 5px #f0abfc" };
    return styles;
  }, [correctMove, hintDestination, hintSource, incorrectSquare, lastMove, legalSquares, selectedSquare]);

  const boardOptions: ChessboardOptions = {
    id: "academy-puzzle-board",
    position: positionFen || undefined,
    boardOrientation: puzzle?.orientation ?? "white",
    showNotation: true,
    ...BOARD_MOTION_OPTIONS,
    allowDragging: phase === "turn",
    allowDragOffBoard: false,
    allowAutoScroll: false,
    dragActivationDistance: 4,
    squareStyles,
    lightSquareStyle: { backgroundColor: "#cffafe" },
    darkSquareStyle: { backgroundColor: "#0e7490" },
    boardStyle: { borderRadius: 8, touchAction: "none", boxShadow: "0 0 36px rgba(34,211,238,.22)" },
    canDragPiece: ({ piece }) => phase === "turn" && !moveLocked.current && piece.pieceType.startsWith(puzzle?.orientation === "black" ? "b" : "w"),
    onSquareClick: ({ square }) => handleSquareClick(square),
    onPieceDrop: ({ sourceSquare, targetSquare }) => {
      if (!targetSquare || !legalDestinations(positionFen, sourceSquare).includes(targetSquare)) return false;
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
  const primaryProgress = trainingMode === "daily"
    ? "Daily"
    : trainingMode === "woodpecker"
      ? `${Math.min(woodpeckerIndex + 1, activeWoodpeckerSetSize.current)}/${activeWoodpeckerSetSize.current}`
      : `${Math.min(visibleSurvivalPuzzleNumber, SURVIVAL_PUZZLE_LIMIT)}/${SURVIVAL_PUZZLE_LIMIT}`;
  const secondaryMetric: [string, string] = trainingMode === "woodpecker"
    ? ["Round", `${woodpeckerRound}/${WOODPECKER_ROUND_COUNT}`]
    : ["Lives", `${lives}/${STARTING_LIVES}`];

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
        onStart={setupMode === "survival" ? startSurvival : startWoodpecker}
        onDailyPuzzle={startDailyPuzzle}
      />
    );
  }

  if (phase === "summary") {
    return (
      <Card className="p-6">
        <p className="text-xs font-black uppercase text-amber-200">{summaryEyebrow}</p>
        <h2 className="mt-2 text-3xl font-black text-white">{summaryTitle}</h2>
        {completion?.dailyReward && <div className={`mt-5 rounded-lg border p-4 ${completion.dailyReward.awarded ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-cyan-200/30 bg-cyan-300/10 text-cyan-100"}`}><p className="font-black">{completion.dailyReward.awarded ? `Reward claimed: +${completion.dailyReward.xpAwarded} XP and +${completion.dailyReward.coinsAwarded} Academy Coins` : "Today’s reward was already claimed. Nice practice replay!"}</p></div>}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[['Solved', solved], ['First try', firstTrySolves], ['Mistakes', incorrectAttempts], ['Accuracy', `${percentage(solved, incorrectAttempts)}%`], ['Average', formatTime(averageTime)], ['Best streak', bestStreak]].map(([label, value]) => (
            <div key={String(label)} className="rounded-md border border-white/10 bg-white/5 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p></div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3"><Button type="button" onClick={trainingMode === "daily" ? startDailyPuzzle : trainingMode === "woodpecker" ? startWoodpecker : startSurvival}>{trainingMode === "daily" ? "Play Again" : "Train Again"}</Button><Button type="button" variant="ghost" onClick={() => setPhase("select")}>Back to Puzzles</Button></div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-white/10 sm:grid-cols-6">
          {[["Puzzle", primaryProgress], secondaryMetric, ['Timer', <PuzzleTimer key={`${sessionId.current}:${puzzle?.id ?? "loading"}`} running={phase === "turn" || phase === "reply"} />], ['Accuracy', `${percentage(solved, incorrectAttempts)}%`], ['Streak', currentStreak], ['Best', bestStreak]].map(([label, value]) => (
            <div key={String(label)} className="p-3 text-center"><p className="text-[10px] font-black uppercase text-slate-500 sm:text-xs">{label}</p><p className="mt-1 text-lg font-black text-white sm:text-2xl">{value}</p></div>
          ))}
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,640px)_minmax(280px,1fr)]">
        <div className="mx-auto w-full max-w-[640px] overflow-hidden rounded-lg border border-cyan-200/20 bg-slate-950/70">
          {positionFen ? <Chessboard options={boardOptions} /> : <div className="flex aspect-square items-center justify-center text-sm text-slate-400">Preparing board...</div>}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><span className="rounded border border-cyan-200/30 bg-cyan-300/10 px-2 py-1 text-xs font-black uppercase text-cyan-100">{trainingMode === "daily" ? "Puzzle of the Day" : selectedThemeName}</span>{trainingMode !== "daily" && <span className="rounded border border-amber-200/30 bg-amber-300/10 px-2 py-1 text-xs font-black uppercase text-amber-100">{activeDifficultyName}</span>}</div><span className="text-xs font-bold text-slate-400">{puzzle ? `${puzzle.sideToMove} to move` : "Loading"}</span></div>
            {puzzle?.daily && <div className={`mt-4 rounded-md border p-3 text-sm font-bold ${puzzle.daily.rewardClaimed ? "border-cyan-200/25 bg-cyan-300/5 text-cyan-100" : "border-amber-200/35 bg-amber-300/10 text-amber-100"}`}>{puzzle.daily.rewardClaimed ? "Reward already claimed today — replay for practice." : `Available reward: +${puzzle.daily.xp} XP and +${puzzle.daily.coins} Academy Coins`}</div>}
            {trainingMode !== "daily" && <div className="mt-4"><AutoAdvanceSwitch checked={autoAdvance} onChange={updateAutoAdvance} compact /></div>}
            <h2 className="mt-4 text-2xl font-black text-white">{phase === "reply" ? "Opponent reply" : phase === "solved" ? "Puzzle complete" : puzzle?.prompt || "Find the best move"}</h2>
            <div className={`mt-4 rounded-md border p-3 text-sm font-bold ${phase === "solved" ? "border-amber-300/50 bg-amber-300/10 text-amber-100" : error ? "border-fuchsia-300/50 bg-fuchsia-300/10 text-fuchsia-100" : "border-white/10 bg-white/5 text-slate-200"}`} aria-live="polite">{error || message}</div>
            {phase === "turn" && <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => void requestHint()}>Hint</Button><Button type="button" variant="ghost" onClick={() => void exitTraining()}>Exit Training</Button></div>}
            {phase === "solved" && <Button type="button" onClick={advanceTrainingPuzzle} className="mt-4">Next Puzzle</Button>}
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
  );
}
