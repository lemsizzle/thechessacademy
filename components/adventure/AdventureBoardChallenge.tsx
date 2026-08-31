"use client";

import { Chess, type PieceSymbol, type Square } from "chess.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { blackPiecesRemaining, findUnprotectedBlackCapture, findVisibleBlackAttack, hasUnprotectedBlackCapture } from "@/adventure/fundamentals";
import { findAdventureHintMove } from "@/adventure/hints";
import { hasPlayableStarTrailMove, keepWhiteToMove, starTrailRating } from "@/adventure/starTrail";
import type { AdventureChallenge, AdventurePuzzle, AdventurePuzzleRating } from "@/adventure/types";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { useChessSounds } from "@/chess/hooks/useChessSounds";
import { promotionOptions, pseudoLegalMovesFrom } from "@/chess/game/rules";
import { Button } from "@/components/Button";

type Props = {
  challenge: AdventureChallenge;
  onComplete: () => void;
  puzzleRatings?: Record<string, AdventurePuzzleRating>;
  onPuzzleRated?: (puzzleId: string, rating: AdventurePuzzleRating) => void;
  compact?: boolean;
};

type PuzzleResult = {
  stars: AdventurePuzzleRating["stars"];
  moves: number;
  par: number;
};

type PromotionChoice = "q" | "r" | "b" | "n";
type PracticeArrow = { startSquare: string; endSquare: string; color: string };
type BlackReplyPhase = "watch" | "moving" | "impact" | null;
type BlackReplyKind = "capture" | "save-king";
type ForcedBlackReply = { from: Square; to: Square; piece: PieceSymbol; captured?: PieceSymbol };

const pieceNames = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" } as const;
const BLACK_REPLY_WATCH_MS = 300;
const BLACK_REPLY_ANIMATION_MS = 700;
const BLACK_REPLY_IMPACT_HOLD_MS = 70;
const LINGERING_CHECK_ARROW_MS = 900;

function resultMatches(chess: Chess, expected: AdventurePuzzle["expectedResult"]) {
  if (!expected) return true;
  if (expected === "check") return chess.isCheck();
  if (expected === "checkmate") return chess.isCheckmate();
  return chess.isStalemate();
}

function openingFeedback(puzzle: AdventurePuzzle) {
  if (!puzzle.fundamental) return "Choose a piece, then collect the glowing practice star. You can also drag it.";
  if (puzzle.fundamental.goal === "capture-all") return "Choose a white piece and capture every black piece. Plan the route before you begin.";
  if (puzzle.fundamental.goal === "safe-move") return "Choose a move that leaves no white piece available for a free black capture.";
  if (puzzle.fundamental.goal === "escape-check") return "Luis is in check. Make any legal move that gets him safely out of it.";
  if (puzzle.fundamental.goal === "check") return "Find a legal move that puts the black king in check.";
  return "Find a legal move that checkmates the black king.";
}

export function AdventureBoardChallenge({ challenge, onComplete, puzzleRatings = {}, onPuzzleRated, compact = false }: Props) {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const activePuzzleIndex = Math.min(puzzleIndex, challenge.puzzles.length - 1);
  const puzzle = challenge.puzzles[activePuzzleIndex];
  const starTrail = puzzle.starTrail;
  const starSquares = starTrail?.starSquares ?? [];
  const parMoves = starTrail?.parMoves ?? puzzle.fundamental?.parMoves ?? null;
  const chessRef = useRef(new Chess(puzzle.fen));
  const [fen, setFen] = useState(puzzle.fen);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [remainingStarSquares, setRemainingStarSquares] = useState(starSquares);
  const [movesUsed, setMovesUsed] = useState(0);
  const [trailPieceSquares, setTrailPieceSquares] = useState(starTrail?.startSquares ?? []);
  const [fundamentalPieceSquares, setFundamentalPieceSquares] = useState(puzzle.movableSquares ?? []);
  const [showTrailHints, setShowTrailHints] = useState(true);
  const [feedback, setFeedback] = useState(() => openingFeedback(puzzle));
  const [won, setWon] = useState(false);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [completionResult, setCompletionResult] = useState<PuzzleResult | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; options: PromotionChoice[] } | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [isPuzzlePickerOpen, setIsPuzzlePickerOpen] = useState(false);
  const [practiceArrows, setPracticeArrows] = useState<PracticeArrow[]>([]);
  const [blackReplyPhase, setBlackReplyPhase] = useState<BlackReplyPhase>(null);
  const [blackReplyKind, setBlackReplyKind] = useState<BlackReplyKind | null>(null);
  const [pendingBlackReply, setPendingBlackReply] = useState<{ from: string; to: string } | null>(null);
  const [lingeringCheckArrow, setLingeringCheckArrow] = useState<PracticeArrow | null>(null);
  const [isCheckAttemptAnimating, setIsCheckAttemptAnimating] = useState(false);
  const blackReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { play: playSound, prepare: prepareSound } = useChessSounds();
  const isBlackReplyAnimating = blackReplyPhase !== null;

  function cancelBlackReplyAnimation() {
    if (blackReplyTimerRef.current) {
      clearTimeout(blackReplyTimerRef.current);
      blackReplyTimerRef.current = null;
    }
    setBlackReplyPhase(null);
    setBlackReplyKind(null);
    setPendingBlackReply(null);
    setLingeringCheckArrow(null);
    setIsCheckAttemptAnimating(false);
  }

  function queueBlackReplyFailure(chess: Chess, blackReply: ForcedBlackReply, kind: BlackReplyKind, message: string) {
    setBlackReplyKind(kind);
    setPendingBlackReply({ from: blackReply.from, to: blackReply.to });
    setBlackReplyPhase("watch");
    blackReplyTimerRef.current = setTimeout(() => {
      chess.remove(blackReply.from);
      chess.remove(blackReply.to);
      chess.put({ color: "b", type: blackReply.piece }, blackReply.to);
      chessRef.current = new Chess(chess.fen());
      setFen(chess.fen());
      setLastMove([blackReply.from, blackReply.to]);
      setFundamentalPieceSquares((squares) => squares.filter((square) => square !== blackReply.to));
      setBlackReplyPhase("moving");

      blackReplyTimerRef.current = setTimeout(() => {
        playSound(blackReply.captured ? "capture" : "move");
        setPendingBlackReply(null);
        setBlackReplyPhase("impact");

        blackReplyTimerRef.current = setTimeout(() => {
          blackReplyTimerRef.current = null;
          setBlackReplyPhase(null);
          setBlackReplyKind(null);
          failAttempt(message);
        }, BLACK_REPLY_IMPACT_HOLD_MS);
      }, BLACK_REPLY_ANIMATION_MS);
    }, BLACK_REPLY_WATCH_MS);
  }

  function queueLingeringCheckFailure(chess: Chess, from: Square, to: Square, kingSquare: Square, attacker: ForcedBlackReply) {
    const movingPiece = chess.get(from);
    if (!movingPiece) return;
    chess.remove(from);
    chess.remove(to);
    chess.put(movingPiece, to);
    const nextFen = keepWhiteToMove(chess.fen());
    chessRef.current = new Chess(nextFen);
    setFen(nextFen);
    setLastMove([from, to]);
    setMovesUsed((count) => count + 1);
    setFundamentalPieceSquares((squares) => [...squares.filter((square) => square !== from), to]);
    setLingeringCheckArrow({ startSquare: attacker.from, endSquare: kingSquare, color: "#fb7185" });
    setIsCheckAttemptAnimating(true);
    blackReplyTimerRef.current = setTimeout(() => {
      blackReplyTimerRef.current = null;
      setIsCheckAttemptAnimating(false);
      failAttempt("Luis is still in check!");
    }, LINGERING_CHECK_ARROW_MS);
  }

  useEffect(() => () => {
    if (blackReplyTimerRef.current) clearTimeout(blackReplyTimerRef.current);
  }, []);

  useEffect(() => {
    setPuzzleIndex(0);
    setIsPuzzlePickerOpen(false);
  }, [challenge.id]);

  useEffect(() => {
    cancelBlackReplyAnimation();
    chessRef.current = new Chess(puzzle.fen);
    setFen(puzzle.fen);
    setLastMove(null);
    setRemainingStarSquares(puzzle.starTrail?.starSquares ?? []);
    setMovesUsed(0);
    setTrailPieceSquares(puzzle.starTrail?.startSquares ?? []);
    setFundamentalPieceSquares(puzzle.movableSquares ?? []);
    setShowTrailHints(true);
    setFeedback(openingFeedback(puzzle));
    setWon(false);
    setHintLevel(0);
    setCompletionResult(null);
    setPendingPromotion(null);
    setFailureMessage(null);
    setPracticeArrows([]);
  }, [puzzle]);

  function resetAttempt(message: string) {
    cancelBlackReplyAnimation();
    chessRef.current = new Chess(puzzle.fen);
    setFen(puzzle.fen);
    setLastMove(null);
    setRemainingStarSquares(puzzle.starTrail?.starSquares ?? []);
    setMovesUsed(0);
    setTrailPieceSquares(puzzle.starTrail?.startSquares ?? []);
    setFundamentalPieceSquares(puzzle.movableSquares ?? []);
    setShowTrailHints(true);
    setFeedback(message);
    setWon(false);
    setHintLevel(0);
    setCompletionResult(null);
    setPendingPromotion(null);
    setFailureMessage(null);
    setPracticeArrows([]);
  }

  function failAttempt(message: string) {
    setFeedback(message);
    setFailureMessage(message);
  }

  function move(from: string, to: string, promotion?: PromotionChoice) {
    if (won || failureMessage || isBlackReplyAnimating || isCheckAttemptAnimating) return;
    const chess = chessRef.current;
    const movingPiece = chess.get(from as Parameters<typeof chess.get>[0]);
    if (movingPiece?.type === "p" && remainingStarSquares.includes(to) && from[0] === to[0]) {
      failAttempt("That star stands for an enemy piece. Pip cannot collect it by marching straight ahead — he needs a diagonal capture.");
      return;
    }
    let instructionalMove = null as ReturnType<typeof pseudoLegalMovesFrom>[number] | null;
    if (puzzle.fundamental?.goal === "escape-check" && movingPiece) {
      const isLegalMove = chess.moves({ square: from as Square, verbose: true }).some((candidate) => candidate.to === to);
      instructionalMove = isLegalMove ? null : (pseudoLegalMovesFrom(chess, from).find((candidate) => candidate.to === to) ?? null);
      if (instructionalMove) {
        const attemptedPosition = new Chess(chess.fen());
        attemptedPosition.remove(from as Square);
        attemptedPosition.remove(to as Square);
        attemptedPosition.put(movingPiece, to as Square);
        const kingSquare = attemptedPosition.board().flat()
          .find((piece) => piece?.color === "w" && piece.type === "k")?.square as Square | undefined;
        const attacker = kingSquare ? findVisibleBlackAttack(attemptedPosition, kingSquare, puzzle.opponentSquares) : null;
        if (attacker && kingSquare) {
          queueLingeringCheckFailure(chess, from as Square, to as Square, kingSquare, attacker);
          return;
        }
        chess.remove(from as Square);
        chess.remove(to as Square);
        chess.put(movingPiece, to as Square);
      }
    }
    const availablePromotions = promotionOptions(chess, from, to) as PromotionChoice[];
    if (!promotion && availablePromotions.length) {
      setPendingPromotion({ from, to, options: availablePromotions });
      setFeedback("Pip reached the far rank! Choose who he becomes. Queens are powerful, but every choice is legal.");
      return;
    }
    let played = instructionalMove;
    if (!played) {
      try {
        played = chess.move({ from, to, promotion });
      } catch {
        if (starTrail) {
          setFeedback("That move is not legal for this piece. Lem leaves the board exactly as it is.");
          return;
        }
        resetAttempt(puzzle.illegalMoveMessage ?? "That move is not legal here. Lem has put the pieces back where they were.");
        return;
      }
    }

    if (starTrail) {
      const nextFen = keepWhiteToMove(chess.fen());
      const collectedStar = remainingStarSquares.includes(played.to)
        && (played.piece !== "p" || Boolean(played.captured));
      const nextRemainingStarSquares = collectedStar
        ? remainingStarSquares.filter((square) => square !== played.to)
        : remainingStarSquares;
      const nextMovesUsed = movesUsed + 1;
      const nextTrailPieceSquares = [...trailPieceSquares.filter((square) => square !== played.from), played.to];

      chessRef.current = new Chess(nextFen);
      setFen(nextFen);
      setLastMove([played.from, played.to]);
      setRemainingStarSquares(nextRemainingStarSquares);
      setMovesUsed(nextMovesUsed);
      setTrailPieceSquares(nextTrailPieceSquares);
      setShowTrailHints(false);

      if (nextRemainingStarSquares.length) {
        if (!hasPlayableStarTrailMove(puzzle, nextFen, nextTrailPieceSquares, nextRemainingStarSquares)) {
          failAttempt("That route has left Pip with no legal way to collect the remaining stars. Lem has marked this as a practice detour, not a disaster.");
          return;
        }
        setFeedback(collectedStar
          ? `✦ Star collected! ${nextRemainingStarSquares.length} more to go. Find any legal route to the rest.`
          : "Good move. Keep exploring — a star is collected when your piece lands on it.");
        return;
      }

      const par = parMoves ?? nextMovesUsed;
      const stars = starTrailRating(nextMovesUsed, par);
      onPuzzleRated?.(puzzle.id, { bestMoves: nextMovesUsed, stars });
      setFeedback(`${puzzle.successMessage} Route rating: ${"★".repeat(stars)}${"☆".repeat(3 - stars)} in ${nextMovesUsed}/${par} moves.`);
      setCompletionResult({ stars, moves: nextMovesUsed, par });
      setWon(true);
      return;
    }

    if (puzzle.fundamental) {
      const nextMovesUsed = movesUsed + 1;
      const nextFen = keepWhiteToMove(chess.fen());
      const expected = puzzle.expectedMove;
      chessRef.current = new Chess(nextFen);
      setFen(nextFen);
      setLastMove([played.from, played.to]);
      setMovesUsed(nextMovesUsed);
      setFundamentalPieceSquares((squares) => [...squares.filter((square) => square !== played.from), played.to]);

      if (puzzle.fundamental.goal === "capture-all" || puzzle.fundamental.goal === "safe-move") {
        const blackCapture = findUnprotectedBlackCapture(chess, puzzle.opponentSquares);
        if (blackCapture) {
          prepareSound();
          queueBlackReplyFailure(chess, blackCapture, "capture", `Your ${pieceNames[blackCapture.captured ?? "p"]} was caught slippin'!`);
          return;
        }
      }

      if (expected && (played.from !== expected.from || played.to !== expected.to)) {
        failAttempt(`Not quite. ${puzzle.hint}`);
        return;
      }

      const completeFundamental = (message: string) => {
        const par = puzzle.fundamental?.parMoves ?? nextMovesUsed;
        const stars = starTrailRating(nextMovesUsed, par);
        onPuzzleRated?.(puzzle.id, { bestMoves: nextMovesUsed, stars });
        setFeedback(`${message} Puzzle rating: ${"★".repeat(stars)}${"☆".repeat(3 - stars)} in ${nextMovesUsed}/${par} moves.`);
        setCompletionResult({ stars, moves: nextMovesUsed, par });
        setWon(true);
      };

      if (puzzle.fundamental.goal === "capture-all") {
        const remaining = blackPiecesRemaining(chess);
        if (remaining) {
          setFeedback(`Captured! ${remaining} black ${remaining === 1 ? "piece remains" : "pieces remain"}. Keep every white piece safe.`);
          return;
        }
        completeFundamental(puzzle.successMessage);
        return;
      }

      if (puzzle.fundamental.goal === "safe-move") {
        if (hasUnprotectedBlackCapture(chess, puzzle.opponentSquares)) {
          failAttempt(`That leaves a teammate loose. ${puzzle.hint}`);
          return;
        }
        completeFundamental(puzzle.successMessage);
        return;
      }

      if (puzzle.fundamental.goal === "escape-check") {
        completeFundamental(puzzle.successMessage);
        return;
      }

      if (puzzle.fundamental.goal === "check" && chess.isCheck()) {
        completeFundamental(puzzle.successMessage);
        return;
      }

      if (puzzle.fundamental.goal === "checkmate" && chess.isCheckmate()) {
        completeFundamental(puzzle.successMessage);
        return;
      }

      if (puzzle.fundamental.goal === "checkmate" && chess.isCheck()) {
        const savingReply = chess.moves({ verbose: true })[0];
        if (savingReply) {
          prepareSound();
          queueBlackReplyFailure(chess, savingReply, "save-king", "The king can still be saved!");
          return;
        }
      }

      failAttempt(puzzle.fundamental.goal === "checkmate"
        ? "Attack the enemy king such that he cannot be saved. Checkmate!"
        : `Not quite. ${puzzle.hint}`);
      return;
    }

    const expected = puzzle.expectedMove;
    if (!expected || played.from !== expected.from || played.to !== expected.to || !resultMatches(chess, puzzle.expectedResult)) {
      setFen(chess.fen());
      setLastMove([played.from, played.to]);
      failAttempt(`Not quite. ${puzzle.hint}`);
      return;
    }

    setFen(chess.fen());
    setLastMove([played.from, played.to]);
    setFeedback(puzzle.successMessage);
    onPuzzleRated?.(puzzle.id, { bestMoves: 1, stars: 3 });
    setCompletionResult({ stars: 3, moves: 1, par: 1 });
    setWon(true);
  }

  function revealHint() {
    if (hintLevel === 0) {
      setShowTrailHints(false);
      setHintLevel(1);
      setFeedback("Hint: I highlighted the piece that needs to move.");
      return;
    }
    setHintLevel(2);
    setFeedback(`Hint: ${puzzle.hint}`);
  }

  function advance() {
    setCompletionResult(null);
    if (activePuzzleIndex < challenge.puzzles.length - 1) {
      setPuzzleIndex(activePuzzleIndex + 1);
      return;
    }
    onComplete();
  }

  function retryPuzzle() {
    resetAttempt(puzzle.fundamental ? openingFeedback(puzzle) : "Fresh attempt! Can you find an even sharper route?");
  }

  function choosePuzzle(index: number) {
    setPuzzleIndex(index);
    setIsPuzzlePickerOpen(false);
  }

  function choosePromotion(promotion: PromotionChoice) {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    move(from, to, promotion);
  }

  const displayStarSquares = starTrail ? remainingStarSquares : (puzzle.shinySquares ?? (puzzle.expectedMove ? [puzzle.expectedMove.to] : []));
  const savedRating = puzzleRatings[puzzle.id];
  const movableSquares = trailPieceSquares.length ? trailPieceSquares : (fundamentalPieceSquares.length ? fundamentalPieceSquares : undefined);
  const freeHintMove = useMemo(() => hintLevel > 0
    ? findAdventureHintMove(puzzle, fen, movableSquares ?? [], remainingStarSquares)
    : null, [fen, fundamentalPieceSquares, hintLevel, movableSquares, puzzle, remainingStarSquares, trailPieceSquares]);
  const hintArrows = showTrailHints ? (starTrail ? starTrail.hintArrows : puzzle.hintArrows) : undefined;
  const guideArrows = hintArrows
    ? hintArrows.map((arrow) => ({ startSquare: arrow.from, endSquare: arrow.to, color: arrow.color ?? "#facc15" }))
    : [];
  const blackReplyArrow = blackReplyPhase === "watch" && pendingBlackReply
    ? [{ startSquare: pendingBlackReply.from, endSquare: pendingBlackReply.to, color: "#fb7185" }]
    : [];
  const freeHintArrows = hintLevel >= 2 && freeHintMove
    ? [{ startSquare: freeHintMove.from, endSquare: freeHintMove.to, color: "#facc15" }]
    : [];
  const instructionalArrows = [...guideArrows, ...freeHintArrows];
  const boardArrows = [...instructionalArrows, ...practiceArrows, ...blackReplyArrow, ...(lingeringCheckArrow ? [lingeringCheckArrow] : [])];
  const hintCircles = hintLevel >= 1 && freeHintMove ? [{ square: freeHintMove.from, color: "#facc15" }] : [];
  const hiddenPieces = starTrail
    ? ["bK", ...(starTrail.piece === "king" ? [] : ["wK"]), ...(starTrail.piece === "pawn" ? ["bP", "bR", "bN", "bB", "bQ"] : [])]
    : (puzzle.hiddenPieces ?? []);

  return (
    <section className={`rounded-2xl border border-cyan-200/25 bg-slate-950/85 shadow-[0_0_40px_rgba(34,211,238,.12)] ${compact ? "p-4" : "p-4 sm:p-6"}`} aria-label={challenge.title}>
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">{challenge.chapterLabel}</p>
          <h2 className="mt-1 text-2xl font-black text-white">{challenge.title}</h2>
          <p className="mt-2 text-sm font-semibold text-amber-100"><span className="font-black text-cyan-200">Goal:</span> {puzzle.objective}</p>
        </div>
        <div className="flex items-center gap-2">
          {starTrail && <span className="w-fit rounded-full border border-amber-200/30 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">✦ {starSquares.length - remainingStarSquares.length}/{starSquares.length} stars</span>}
          {parMoves !== null && <span className="w-fit rounded-full border border-violet-200/25 bg-violet-300/10 px-3 py-1 text-xs font-black text-violet-100">Par {parMoves} · {movesUsed} moves</span>}
          <button type="button" className="w-fit rounded-full border border-cyan-200/30 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-50 transition hover:border-cyan-100/70 hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-200" onClick={() => setIsPuzzlePickerOpen((isOpen) => !isOpen)} aria-expanded={isPuzzlePickerOpen} aria-controls={`adventure-${challenge.id}-puzzle-picker`}>
            Puzzle {activePuzzleIndex + 1}/{challenge.puzzles.length} <span aria-hidden="true">{isPuzzlePickerOpen ? "▴" : "▾"}</span>
          </button>
          <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">Normal 2D board</span>
        </div>
      </div>

      {isPuzzlePickerOpen && <div id={`adventure-${challenge.id}-puzzle-picker`} className="mt-4 rounded-xl border border-cyan-200/25 bg-cyan-300/5 p-4" aria-label="Choose a practice puzzle">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-black text-cyan-50">Choose a puzzle</p>
          <p className="text-xs text-slate-300">Pick any board to practice or improve its rating.</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {challenge.puzzles.map((lessonPuzzle, index) => {
            const rating = puzzleRatings[lessonPuzzle.id];
            const isActive = index === activePuzzleIndex;
            return <button key={lessonPuzzle.id} type="button" className={`min-h-16 rounded-xl border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-200 ${isActive ? "border-amber-200/70 bg-amber-300/15 text-amber-50" : "border-white/10 bg-slate-950/45 text-slate-100 hover:border-cyan-200/45 hover:bg-cyan-300/10"}`} onClick={() => choosePuzzle(index)} aria-current={isActive ? "step" : undefined}>
              <span className="block text-xs font-black uppercase tracking-wider">Puzzle {index + 1}</span>
              <span className={`mt-1 block text-sm font-black ${rating ? "text-amber-200" : "text-slate-400"}`}>{rating ? `${"★".repeat(rating.stars)}${"☆".repeat(3 - rating.stars)}` : "Not tried"}</span>
            </button>;
          })}
        </div>
      </div>}

      <div className={`mt-5 grid gap-5 ${compact ? "lg:grid-cols-[minmax(0,1fr)_220px]" : "lg:grid-cols-[minmax(0,1fr)_260px]"}`}>
        <div className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-xl border border-cyan-100/20 bg-slate-900 p-1 sm:p-2">
          <AcademyChessboard fen={fen} orientation="white" humanColor="white" interactive={!won && !pendingPromotion && !failureMessage && !isBlackReplyAnimating && !isCheckAttemptAnimating} lastMove={lastMove} onMove={move} onIllegalMove={puzzle.illegalMoveMessage ? () => setFeedback(puzzle.illegalMoveMessage!) : undefined} arrows={boardArrows} circles={hintCircles} onBoardInteraction={() => { setShowTrailHints(false); setHintLevel(0); }} onArrowsChange={(arrows) => setPracticeArrows(arrows.filter((arrow) => !instructionalArrows.some((guide) => guide.startSquare === arrow.startSquare && guide.endSquare === arrow.endSquare && guide.color === arrow.color)))} animationDurationInMs={isBlackReplyAnimating ? BLACK_REPLY_ANIMATION_MS : undefined} allowDrawingArrows allowCheckIgnoringMoves={puzzle.fundamental?.goal === "escape-check"} shinySquares={displayStarSquares} activeShinySquares={displayStarSquares} movableSquares={movableSquares} keepMovedPieceSelected hiddenPieces={hiddenPieces} boardId={`adventure-${challenge.id}-${puzzle.id}`} />
          {blackReplyPhase && <div className="pointer-events-none absolute inset-x-4 top-4 z-10 rounded-full border border-rose-100/60 bg-rose-950/85 px-4 py-2 text-center text-sm font-black uppercase tracking-wider text-rose-50 shadow-[0_0_22px_rgba(251,113,133,.6)]">{blackReplyPhase === "watch" ? "Watch Black's reply…" : blackReplyPhase === "moving" ? (blackReplyKind === "save-king" ? "Black saves the king!" : "Black is capturing!") : (blackReplyKind === "save-king" ? "The king escaped!" : "Piece captured!")}</div>}
        </div>
        <aside className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-cyan-200">What this teaches</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{puzzle.concept}</p>
          </div>
          <div className={`rounded-xl border p-4 text-sm leading-6 ${won ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50" : "border-white/10 bg-white/5 text-slate-200"}`} aria-live="polite">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-amber-200/35 bg-amber-300/10 text-2xl shadow-[0_0_20px_rgba(250,204,21,.16)]" role="img" aria-label="Lem, the magical book">📖</span>
              <p>{feedback}</p>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Plan your route</p>
            <p className="mt-2 leading-6">Right-click and drag from one square to another to draw an arrow. Use it to trace your idea before moving.</p>
            {practiceArrows.length > 0 && <Button type="button" variant="ghost" className="mt-3 min-h-9 w-full text-xs" onClick={() => setPracticeArrows([])}>Clear my arrows</Button>}
          </div>
          {!won && <Button type="button" variant="secondary" className="w-full" onClick={revealHint} disabled={hintLevel === 2}>{hintLevel === 0 ? "Hint" : hintLevel === 1 ? "Show move" : "Move hint shown"}</Button>}
        </aside>
      </div>

      {completionResult && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="adventure-puzzle-result-title">
        <div className="w-full max-w-md rounded-3xl border border-amber-200/40 bg-gradient-to-br from-slate-900 via-violet-950 to-slate-950 p-6 text-center shadow-[0_0_80px_rgba(250,204,21,.28)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Puzzle complete</p>
          <h3 id="adventure-puzzle-result-title" className="mt-2 text-3xl font-black text-white">{completionResult.stars === 3 ? "Brilliant!" : "Nice work!"}</h3>
          <p className="mt-5 text-6xl leading-none tracking-[0.12em] text-amber-300 drop-shadow-[0_0_18px_rgba(250,204,21,.65)]" role="img" aria-label={`${completionResult.stars} out of 3 stars`}>{"★".repeat(completionResult.stars)}<span className="text-slate-600">{"☆".repeat(3 - completionResult.stars)}</span></p>
          <p className="mt-5 text-lg font-bold text-amber-50">{completionResult.moves} {completionResult.moves === 1 ? "move" : "moves"} <span className="text-slate-400">·</span> Par {completionResult.par}</p>
          {savedRating && <p className="mt-3 text-xs font-bold text-cyan-100">Best saved: {"★".repeat(savedRating.stars)}{"☆".repeat(3 - savedRating.stars)} · {savedRating.bestMoves} {savedRating.bestMoves === 1 ? "move" : "moves"}</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="secondary" className="w-full" onClick={retryPuzzle}>Try again</Button>
            <Button type="button" className="w-full" onClick={advance}>{activePuzzleIndex < challenge.puzzles.length - 1 ? "Next puzzle" : "Finish lesson"}</Button>
          </div>
        </div>
      </div>}

      {pendingPromotion && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="adventure-promotion-title">
        <div className="w-full max-w-md rounded-3xl border border-amber-200/40 bg-gradient-to-br from-slate-900 via-violet-950 to-slate-950 p-6 text-center shadow-[0_0_80px_rgba(250,204,21,.28)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Promotion</p>
          <h3 id="adventure-promotion-title" className="mt-2 text-3xl font-black text-white">Who should Pip become?</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">Choose a queen, rook, bishop, or knight. Lem insists this is Pip's big career decision.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {pendingPromotion.options.map((option) => <Button key={option} type="button" variant={option === "q" ? "primary" : "secondary"} className="min-h-20 text-lg" onClick={() => choosePromotion(option)}>{({ q: "♛ Queen", r: "♜ Rook", b: "♝ Bishop", n: "♞ Knight" } as Record<PromotionChoice, string>)[option]}</Button>)}
          </div>
        </div>
      </div>}

      {failureMessage && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="adventure-retry-title">
        <div className="w-full max-w-md rounded-3xl border border-rose-200/35 bg-gradient-to-br from-slate-900 via-rose-950/80 to-slate-950 p-6 text-center shadow-[0_0_80px_rgba(251,113,133,.2)] sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-rose-200">Oops!</p>
          <h3 id="adventure-retry-title" className="mt-4 text-2xl font-black leading-9 text-white">{failureMessage}</h3>
          <div className="mt-5 flex items-center justify-center gap-3 text-amber-100">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-amber-200/30 bg-amber-300/10 text-xl shadow-[0_0_18px_rgba(250,204,21,.18)]" role="img" aria-label="Lem, the magical book">📖</span>
            <p className="text-center text-sm font-bold leading-6">
              <span className="block">“Mistakes are what champions are made of,</span>
              <span className="block">if you learn from them.”</span>
            </p>
          </div>
          <Button type="button" className="mt-6 w-full" onClick={retryPuzzle}>Retry puzzle</Button>
        </div>
      </div>}
    </section>
  );
}
