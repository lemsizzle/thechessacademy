"use client";

import { Chess, type Square } from "chess.js";
import { Chessboard, type ChessboardOptions } from "react-chessboard";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { legalDestinations, parseUciMove } from "@/lib/puzzle-training/engine";
import { parsePuzzleTheme, type PublicTrainingPuzzle, type PuzzleCompletionDetails, type PuzzleMoveResult, type PuzzleThemeSlug } from "@/lib/puzzle-training/types";

const SESSION_LENGTH = 10;
const STARTING_LIVES = 3;

const themes: Array<{ id: PuzzleThemeSlug; name: string; description: string }> = [
  { id: "mixed", name: "Mixed", description: "A shuffled selection of every academy tactic." },
  { id: "fork", name: "Forks", description: "One piece attacks two or more targets at once." },
  { id: "pin", name: "Pins", description: "A piece cannot safely move because something more valuable is behind it." },
  { id: "skewer", name: "Skewers", description: "A valuable piece must move, exposing another piece behind it." },
  { id: "mateIn1", name: "Mate in 1", description: "Find the move that checkmates immediately." }
];

type TrainerPhase = "select" | "loading" | "turn" | "reply" | "solved" | "summary" | "error";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function percentage(solved: number, mistakes: number) {
  const total = solved + mistakes;
  return total ? Math.round((solved / total) * 100) : 100;
}

export function PuzzleSurvival() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTheme, setSelectedTheme] = useState<PuzzleThemeSlug>(() => parsePuzzleTheme(searchParams.get("theme")));
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
  const [elapsed, setElapsed] = useState(0);
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
  const sessionId = useRef(crypto.randomUUID());
  const moveLocked = useRef(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phase !== "turn" && phase !== "reply") return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => () => {
    if (replyTimer.current) clearTimeout(replyTimer.current);
  }, []);

  function chooseTheme(theme: PuzzleThemeSlug) {
    setSelectedTheme(theme);
    router.replace(`/student/training?theme=${theme}`, { scroll: false });
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

  async function loadPuzzle() {
    setPhase("loading");
    setError("");
    setMessage("Preparing the next position...");
    setElapsed(0);
    setCompletion(null);
    clearBoardMarks();
    moveLocked.current = false;
    const query = new URLSearchParams({ theme: selectedTheme, sessionId: sessionId.current });
    if (recentPuzzleIds.current.length) query.set("exclude", recentPuzzleIds.current.slice(-10).join(","));

    try {
      const response = await fetch(`/api/student/puzzle-training/puzzle?${query}`, { cache: "no-store" });
      const data = await response.json() as { puzzle?: PublicTrainingPuzzle; error?: string };
      if (!response.ok || !data.puzzle) throw new Error(data.error ?? "Puzzle could not be loaded.");
      setPuzzle(data.puzzle);
      setPositionFen(data.puzzle.displayFen);
      setToken(data.puzzle.token);
      recentPuzzleIds.current = [...recentPuzzleIds.current, data.puzzle.id].slice(-20);
      setMessage("Your turn. Find the best move.");
      setPhase("turn");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Puzzle could not be loaded.");
      setPhase("error");
    }
  }

  function startSession() {
    sessionId.current = crypto.randomUUID();
    recentPuzzleIds.current = [];
    setLives(STARTING_LIVES);
    setCompleted(0);
    setSolved(0);
    setFirstTrySolves(0);
    setIncorrectAttempts(0);
    setSolveTimes([]);
    setCurrentStreak(0);
    setBestStreak(0);
    void loadPuzzle();
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
    setSelectedSquare(null);
    setLegalSquares([]);
    setIncorrectSquare(null);
    try {
      const response = await fetch("/api/student/puzzle-training/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, move: { from, to } })
      });
      const result = await response.json() as PuzzleMoveResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Move could not be checked.");
      setToken(result.token);

      if (!result.accepted) {
        const remainingLives = lives - 1;
        setIncorrectAttempts((value) => value + 1);
        setCurrentStreak(0);
        setLives(remainingLives);
        setIncorrectSquare(to);
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
      setLastMove([from, to]);
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
        setPhase(nextCompleted >= SESSION_LENGTH ? "summary" : "solved");
        moveLocked.current = false;
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
      }, 500);
      return true;
    } catch (moveError) {
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
    animationDurationInMs: 350,
    showAnimations: true,
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
      if (targetSquare) void submitMove(sourceSquare, targetSquare);
      return false;
    }
  };

  const averageTime = solveTimes.length ? Math.round(solveTimes.reduce((sum, value) => sum + value, 0) / solveTimes.length) : 0;
  const selectedThemeName = themes.find((theme) => theme.id === selectedTheme)?.name ?? "Mixed";

  if (phase === "select") {
    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" role="radiogroup" aria-label="Puzzle theme">
          {themes.map((theme) => (
            <button key={theme.id} type="button" role="radio" aria-checked={selectedTheme === theme.id} onClick={() => chooseTheme(theme.id)} className={`min-h-32 rounded-lg border p-4 text-left transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${selectedTheme === theme.id ? "border-amber-300 bg-amber-300/12 shadow-gold" : "border-white/10 bg-slate-950/58 hover:border-cyan-200/40 hover:bg-cyan-300/5"}`}>
              <span className="text-base font-black text-white">{theme.name}</span>
              <span className="mt-2 block text-sm leading-5 text-slate-400">{theme.description}</span>
            </button>
          ))}
        </div>
        <Card className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-black uppercase text-cyan-100">Survival Session</p>
            <p className="mt-1 text-sm text-slate-300">Solve up to {SESSION_LENGTH} puzzles. Three incorrect moves end the run.</p>
          </div>
          <Button type="button" onClick={startSession}>Start {selectedThemeName}</Button>
        </Card>
        <p className="text-xs text-slate-500">Puzzle data from the Lichess open database.</p>
      </div>
    );
  }

  if (phase === "summary") {
    return (
      <Card className="p-6">
        <p className="text-xs font-black uppercase text-amber-200">Session Complete</p>
        <h2 className="mt-2 text-3xl font-black text-white">Academy Training Report</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[['Solved', solved], ['First try', firstTrySolves], ['Mistakes', incorrectAttempts], ['Accuracy', `${percentage(solved, incorrectAttempts)}%`], ['Average', formatTime(averageTime)], ['Best streak', bestStreak]].map(([label, value]) => (
            <div key={String(label)} className="rounded-md border border-white/10 bg-white/5 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p></div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3"><Button type="button" onClick={startSession}>Train Again</Button><Button type="button" variant="ghost" onClick={() => setPhase("select")}>Choose Theme</Button></div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-white/10 sm:grid-cols-6">
          {[['Puzzle', `${Math.min(completed + 1, SESSION_LENGTH)}/${SESSION_LENGTH}`], ['Lives', `${lives}/${STARTING_LIVES}`], ['Timer', formatTime(elapsed)], ['Accuracy', `${percentage(solved, incorrectAttempts)}%`], ['Streak', currentStreak], ['Best', bestStreak]].map(([label, value]) => (
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
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded border border-cyan-200/30 bg-cyan-300/10 px-2 py-1 text-xs font-black uppercase text-cyan-100">{selectedThemeName}</span><span className="text-xs font-bold text-slate-400">{puzzle ? `${puzzle.sideToMove} to move` : "Loading"}</span></div>
            <h2 className="mt-4 text-2xl font-black text-white">{phase === "reply" ? "Opponent reply" : phase === "solved" ? "Puzzle complete" : "Find the best move"}</h2>
            <div className={`mt-4 rounded-md border p-3 text-sm font-bold ${phase === "solved" ? "border-amber-300/50 bg-amber-300/10 text-amber-100" : error ? "border-fuchsia-300/50 bg-fuchsia-300/10 text-fuchsia-100" : "border-white/10 bg-white/5 text-slate-200"}`} aria-live="polite">{error || message}</div>
            {phase === "turn" && <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => void requestHint()}>Hint</Button><Button type="button" variant="ghost" onClick={() => void exitTraining()}>Exit Training</Button></div>}
            {phase === "solved" && <Button type="button" onClick={() => void loadPuzzle()} className="mt-4">Next Puzzle</Button>}
            {phase === "error" && <div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={() => void loadPuzzle()}>Try Again</Button><Button type="button" variant="ghost" onClick={() => setPhase("select")}>Choose Theme</Button></div>}
          </Card>

          {completion && (
            <Card className="p-5">
              <p className="text-xs font-black uppercase text-amber-200">Solved Details</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Themes</dt><dd className="font-bold text-white">{completion.themes.join(", ")}</dd></div><div><dt className="text-slate-500">Rating</dt><dd className="font-bold text-white">{completion.rating ?? "Unrated"}</dd></div><div><dt className="text-slate-500">Mistakes</dt><dd className="font-bold text-white">{completion.mistakes}</dd></div><div><dt className="text-slate-500">Solve time</dt><dd className="font-bold text-white">{formatTime(completion.elapsedSeconds)}</dd></div></dl>
              {completion.gameUrl && <a href={completion.gameUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4">View original Lichess game</a>}
            </Card>
          )}

          <p className="text-xs text-slate-500">Puzzle data from the Lichess open database.</p>
        </div>
      </div>
    </div>
  );
}
