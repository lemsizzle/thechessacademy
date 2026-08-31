"use client";

import { Chess, type Square } from "chess.js";
import { Chessboard, defaultPieces, type ChessboardOptions } from "react-chessboard";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { annotationColorForModifiers, BOARD_ANNOTATION_COLORS } from "@/chess/components/boardAnnotations";
import { boardSquaresForOrientation, describeBoardSquare, nextBoardSquare, type BoardNavigationKey } from "@/chess/components/boardAccessibility";
import { BOARD_INTERACTION_OPTIONS, BOARD_MOTION_OPTIONS } from "@/chess/components/boardMotion";
import { chessJsColor } from "@/chess/game/colors";
import { boardDropAction, checkedKingSquare, legalMovesFrom, pseudoLegalMovesFrom } from "@/chess/game/rules";
import { useOutsideBoardAnnotationClear } from "@/chess/hooks/useOutsideBoardAnnotationClear";
import { premoveMovesFrom } from "@/chess/live/premove";
import type { ChessColor } from "@/chess/types";

type Props = {
  fen: string;
  orientation: ChessColor;
  humanColor: ChessColor;
  interactive: boolean;
  lastMove: [string, string] | null;
  onMove: (from: string, to: string) => void;
  /** Optional lesson feedback hook for a clicked or dragged illegal destination. */
  onIllegalMove?: (from: string, to: string) => void;
  arrows?: Array<{ startSquare: string; endSquare: string; color: string }>;
  circles?: Array<{ square: string; color: string }>;
  shinySquares?: string[];
  activeShinySquares?: string[];
  movableSquares?: string[];
  allowedDestinationSquares?: string[];
  /** Let check lessons demonstrate moves that obey piece movement but ignore the check. */
  allowCheckIgnoringMoves?: boolean;
  /** Keep a moved piece selected after click-to-move, for multi-move practice routes. */
  keepMovedPieceSelected?: boolean;
  /** Allow the human pieces to queue a move while the opponent's clock is running. */
  allowPremoves?: boolean;
  premove?: [string, string] | null;
  hiddenPieces?: string[];
  /** Called when a student starts interacting with the board. */
  onBoardInteraction?: () => void;
  animationDurationInMs?: number;
  allowDrawingArrows?: boolean;
  annotationMode?: "arrow" | "circle" | null;
  onAnnotationSquare?: (square: string) => void;
  onArrowsChange?: (arrows: Array<{ startSquare: string; endSquare: string; color: string }>) => void;
  onCircleToggle?: (square: string, color: string) => void;
  onClearAnnotations?: () => void;
  boardId?: string;
};

export function AcademyChessboard({ fen, orientation, humanColor, interactive, lastMove, onMove, onIllegalMove, arrows = [], circles = [], shinySquares = [], activeShinySquares = [], movableSquares, allowedDestinationSquares, allowCheckIgnoringMoves = false, keepMovedPieceSelected = false, allowPremoves = false, premove = null, hiddenPieces = [], onBoardInteraction, animationDurationInMs, allowDrawingArrows = false, annotationMode = null, onAnnotationSquare, onArrowsChange, onCircleToggle, onClearAnnotations, boardId = "academy-play-board" }: Props) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [keyboardSquare, setKeyboardSquare] = useState<Square>(() => boardSquaresForOrientation(orientation)[0]);
  const movedSelectionRef = useRef<string | null>(null);
  const rightGestureRef = useRef<{ startSquare: string; color: string } | null>(null);
  const keyboardSquareRefs = useRef(new Map<Square, HTMLButtonElement>());
  const boardRef = useOutsideBoardAnnotationClear(onClearAnnotations ? () => {
    rightGestureRef.current = null;
    onClearAnnotations();
  } : undefined);
  const chess = useMemo(() => new Chess(fen), [fen]);
  const visualSquares = useMemo(() => boardSquaresForOrientation(orientation), [orientation]);
  const checkSquare = useMemo(() => checkedKingSquare(chess), [chess]);
  const legalMoves = useMemo(() => {
    const selectedPiece = selectedSquare ? chess.get(selectedSquare as Square) : null;
    const isPremoveSelection = allowPremoves
      && selectedPiece?.color === chessJsColor(humanColor)
      && selectedPiece.color !== chess.turn();
    const moves = selectedSquare
      ? isPremoveSelection ? premoveMovesFrom(chess, selectedSquare) : legalMovesFrom(chess, selectedSquare)
      : [];
    if (allowCheckIgnoringMoves && selectedSquare) {
      const selectedPiece = chess.get(selectedSquare as Square);
      if (selectedPiece?.color === chessJsColor(humanColor)) {
        for (const candidate of pseudoLegalMovesFrom(chess, selectedSquare)) {
          if (!moves.some((move) => move.to === candidate.to)) {
            moves.push(candidate as (typeof moves)[number]);
          }
        }
      }
    }
    return allowedDestinationSquares ? moves.filter((move) => allowedDestinationSquares.includes(move.to)) : moves;
  }, [allowCheckIgnoringMoves, allowPremoves, allowedDestinationSquares, chess, humanColor, selectedSquare]);
  const hiddenPiecesKey = hiddenPieces.join("-");
  const customPieces = useMemo(() => {
    if (!hiddenPieces.length) return undefined;
    return { ...defaultPieces, ...Object.fromEntries(hiddenPieces.map((piece) => [piece, () => <span aria-hidden="true" className="block h-full w-full opacity-0" />])) };
  }, [hiddenPieces, hiddenPiecesKey]);

  useEffect(() => {
    const movedSquare = movedSelectionRef.current;
    movedSelectionRef.current = null;
    if (keepMovedPieceSelected && movedSquare) {
      const movedPiece = new Chess(fen).get(movedSquare as Square);
      if (movedPiece?.color === chessJsColor(humanColor)) {
        setSelectedSquare(movedSquare);
        return;
      }
    }
    setSelectedSquare(null);
  }, [fen, humanColor, keepMovedPieceSelected]);

  useEffect(() => {
    setKeyboardSquare(visualSquares[0]);
  }, [visualSquares]);

  function selectOrMove(square: string) {
    if (annotationMode && onAnnotationSquare) {
      onAnnotationSquare(square);
      return;
    }
    if (!interactive) return;
    onBoardInteraction?.();
    if (selectedSquare === square) {
      movedSelectionRef.current = null;
      setSelectedSquare(null);
      return;
    }
    const target = legalMoves.find((move) => move.to === square);
    if (selectedSquare && target) {
      if (keepMovedPieceSelected) {
        movedSelectionRef.current = square;
        setSelectedSquare(square);
      }
      onMove(selectedSquare, square);
      return;
    }
    if (selectedSquare && onIllegalMove) {
      onIllegalMove(selectedSquare, square);
      return;
    }
    if (movableSquares && !movableSquares.includes(square)) {
      setSelectedSquare(null);
      return;
    }
    const piece = chess.get(square as Square);
    if (piece?.color === chessJsColor(humanColor) && (piece.color === chess.turn() || allowPremoves)) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  }

  function handleBoardSquareKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, square: Square) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      selectOrMove(square);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setSelectedSquare(null);
      return;
    }
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const nextSquare = nextBoardSquare(visualSquares, square, event.key as BoardNavigationKey);
    setKeyboardSquare(nextSquare);
    window.requestAnimationFrame(() => keyboardSquareRefs.current.get(nextSquare)?.focus());
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (lastMove) {
      styles[lastMove[0]] = { backgroundColor: "rgba(250, 204, 21, .32)" };
      styles[lastMove[1]] = { backgroundColor: "rgba(250, 204, 21, .45)" };
    }
    if (checkSquare) {
      styles[checkSquare] = {
        ...styles[checkSquare],
        backgroundImage: "radial-gradient(circle, rgba(244,63,94,.9) 0 32%, rgba(190,18,60,.35) 62%, transparent 72%)",
        boxShadow: "inset 0 0 0 4px rgba(254,205,211,.9)"
      };
    }
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        boxShadow: "inset 0 0 0 5px rgba(34,211,238,.95)",
        backgroundColor: "rgba(34,211,238,.28)"
      };
    }
    for (const move of legalMoves) {
      styles[move.to] = move.captured
        ? {
            ...styles[move.to],
            backgroundImage: "radial-gradient(circle, transparent 0 54%, rgba(244,114,182,.78) 57% 70%, transparent 73%)"
          }
        : {
            ...styles[move.to],
            backgroundImage: "radial-gradient(circle, rgba(15,23,42,.6) 0 15%, transparent 18%)"
        };
    }
    if (premove) {
      styles[premove[0]] = {
        ...styles[premove[0]],
        boxShadow: "inset 0 0 0 5px rgba(192,132,252,.95)",
        backgroundColor: "rgba(168,85,247,.26)"
      };
      styles[premove[1]] = {
        ...styles[premove[1]],
        boxShadow: "inset 0 0 0 5px rgba(232,121,249,.95)",
        backgroundColor: "rgba(217,70,239,.26)"
      };
    }
    for (const square of shinySquares) {
      styles[square] = {
        ...styles[square],
        backgroundImage: "radial-gradient(circle, rgba(254,240,138,.98) 0 12%, rgba(250,204,21,.78) 15% 30%, rgba(251,191,36,.3) 34% 52%, transparent 56%)",
        boxShadow: "inset 0 0 0 3px rgba(254,240,138,.72), 0 0 16px rgba(250,204,21,.55)"
      };
    }
    for (const square of activeShinySquares) {
      styles[square] = {
        ...styles[square],
        backgroundImage: "radial-gradient(circle, #fff7b3 0 10%, #facc15 12% 28%, rgba(251,191,36,.55) 30% 48%, transparent 52%)",
        boxShadow: "inset 0 0 0 4px rgba(255,251,235,.95), 0 0 24px rgba(250,204,21,.9)"
      };
    }
    for (const circle of circles) {
      styles[circle.square] = {
        ...styles[circle.square],
        boxShadow: `inset 0 0 0 7px ${circle.color}`,
        borderRadius: "50%"
      };
    }
    return styles;
  }, [activeShinySquares, checkSquare, circles, lastMove, legalMoves, premove, selectedSquare, shinySquares]);

  const options: ChessboardOptions = {
    id: boardId,
    position: fen,
    pieces: customPieces,
    boardOrientation: orientation,
    showNotation: true,
    ...BOARD_MOTION_OPTIONS,
    animationDurationInMs: animationDurationInMs ?? BOARD_MOTION_OPTIONS.animationDurationInMs,
    ...BOARD_INTERACTION_OPTIONS,
    allowDragging: interactive && !annotationMode,
    squareStyles,
    allowDrawingArrows,
    arrows,
    arrowOptions: {
      color: BOARD_ANNOTATION_COLORS.primary,
      secondaryColor: BOARD_ANNOTATION_COLORS.danger,
      tertiaryColor: BOARD_ANNOTATION_COLORS.danger,
      arrowLengthReducerDenominator: 8,
      sameTargetArrowLengthReducerDenominator: 4,
      arrowWidthDenominator: 5,
      activeArrowWidthMultiplier: 0.9,
      opacity: 0.65,
      activeOpacity: 0.5,
      arrowStartOffset: 0
    },
    clearArrowsOnClick: false,
    clearArrowsOnPositionChange: false,
    onArrowsChange: ({ arrows: nextArrows }) => {
      if (!nextArrows.length) return;
      const gesture = rightGestureRef.current;
      const normalized = nextArrows.map((arrow) => gesture && arrow.startSquare === gesture.startSquare
        ? { ...arrow, color: gesture.color }
        : arrow);
      const merged = [...arrows];
      for (const arrow of normalized) {
        if (!merged.some((existing) => existing.startSquare === arrow.startSquare && existing.endSquare === arrow.endSquare)) {
          merged.push(arrow);
        }
      }
      rightGestureRef.current = null;
      onArrowsChange?.(merged);
    },
    lightSquareStyle: { backgroundColor: "#cffafe" },
    darkSquareStyle: { backgroundColor: "#0e7490" },
    boardStyle: {
      borderRadius: 10,
      touchAction: "none",
      boxShadow: "0 0 42px rgba(34,211,238,.2)"
    },
    canDragPiece: ({ piece, square }) => interactive
      && !annotationMode
      && piece.pieceType.startsWith(chessJsColor(humanColor))
      && (chess.turn() === chessJsColor(humanColor) || allowPremoves)
      && (!movableSquares || (square !== null && movableSquares.includes(square))),
    onSquareClick: ({ square }) => selectOrMove(square),
    onSquareMouseDown: ({ square }, event) => {
      if (event.button === 2) {
        rightGestureRef.current = { startSquare: square, color: annotationColorForModifiers(event) };
      }
    },
    onSquareMouseUp: ({ square }, event) => {
      const gesture = rightGestureRef.current;
      if (event.button !== 2 || !gesture || gesture.startSquare === square) return;
      if (arrows.some((arrow) => arrow.startSquare === gesture.startSquare && arrow.endSquare === square)) {
        onArrowsChange?.(arrows.filter((arrow) => !(arrow.startSquare === gesture.startSquare && arrow.endSquare === square)));
        rightGestureRef.current = null;
      }
    },
    onSquareRightClick: ({ square }) => {
      const color = rightGestureRef.current?.color ?? BOARD_ANNOTATION_COLORS.primary;
      rightGestureRef.current = null;
      onCircleToggle?.(square, color);
    },
    onPieceDrop: ({ sourceSquare, targetSquare }) => {
      if (!interactive || !targetSquare) return false;
      onBoardInteraction?.();
      if (movableSquares && !movableSquares.includes(sourceSquare)) return false;
      if (allowedDestinationSquares && !allowedDestinationSquares.includes(targetSquare)) return false;
      const sourcePiece = chess.get(sourceSquare as Square);
      const isPremoveAttempt = allowPremoves
        && sourcePiece?.color === chessJsColor(humanColor)
        && sourcePiece.color !== chess.turn();
      if (isPremoveAttempt) {
        if (!premoveMovesFrom(chess, sourceSquare).some((move) => move.to === targetSquare)) return false;
        onMove(sourceSquare, targetSquare);
        return true;
      }
      const action = boardDropAction(chess, sourceSquare, targetSquare);
      if (action === "illegal") {
        const isCheckIgnoringAttempt = allowCheckIgnoringMoves
          && pseudoLegalMovesFrom(chess, sourceSquare).some((candidate) => candidate.to === targetSquare);
        if (!isCheckIgnoringAttempt) {
          onIllegalMove?.(sourceSquare, targetSquare);
          return false;
        }
        onMove(sourceSquare, targetSquare);
        return true;
      }
      onMove(sourceSquare, targetSquare);
      return action === "move";
    }
  };

  const arrowKey = arrows.map((arrow) => `${arrow.startSquare}${arrow.endSquare}${arrow.color}`).sort().join("-");
  const instructionsId = `${boardId}-keyboard-instructions`;
  return <div ref={boardRef} className="relative h-full w-full">
    <div aria-hidden="true" inert className="h-full w-full"><Chessboard key={`${boardId}-${arrowKey}`} options={options} /></div>
    <p id={instructionsId} className="sr-only">Use the arrow keys to move between squares. Press Enter or Space to select a piece or destination. Press Escape to clear the selected square.</p>
    <div role="grid" aria-label={`Chessboard, ${orientation} perspective`} aria-describedby={instructionsId} aria-readonly={!interactive} className="pointer-events-none absolute inset-0 z-20 grid grid-rows-8">
      {Array.from({ length: 8 }, (_, rowIndex) => (
        <div key={rowIndex} role="row" className="grid grid-cols-8">
          {visualSquares.slice(rowIndex * 8, rowIndex * 8 + 8).map((square) => {
            const piece = chess.get(square) ?? null;
            const pieceCode = piece ? `${piece.color}${piece.type.toUpperCase()}` : null;
            const accessiblePiece = pieceCode && hiddenPieces.includes(pieceCode) ? null : piece;
            const legalMove = legalMoves.find((move) => move.to === square);
            const selectable = Boolean(annotationMode && onAnnotationSquare) || Boolean(interactive
              && piece?.color === chessJsColor(humanColor)
              && (piece.color === chess.turn() || allowPremoves)
              && (!movableSquares || movableSquares.includes(square)));
            const label = describeBoardSquare({
              square,
              piece: accessiblePiece,
              selected: selectedSquare === square,
              selectable,
              legalDestination: Boolean(legalMove),
              legalCapture: Boolean(legalMove?.captured),
              inCheck: checkSquare === square,
              lastMove: lastMove?.[0] === square ? "start" : lastMove?.[1] === square ? "end" : null
            });
            return <div key={square} role="gridcell" aria-selected={selectedSquare === square} className="relative">
              <button
                ref={(element) => {
                  if (element) keyboardSquareRefs.current.set(square, element);
                  else keyboardSquareRefs.current.delete(square);
                }}
                type="button"
                tabIndex={keyboardSquare === square ? 0 : -1}
                data-board-square={square}
                aria-label={label}
                aria-pressed={selectedSquare === square}
                aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End Enter Space Escape"
                onKeyDown={(event) => handleBoardSquareKeyDown(event, square)}
                className="pointer-events-none absolute inset-0 z-20 rounded-none bg-transparent focus-visible:outline focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-amber-300"
              />
            </div>;
          })}
        </div>
      ))}
    </div>
  </div>;
}
