"use client";

import { Chess, type Square } from "chess.js";
import { Chessboard, type ChessboardOptions } from "react-chessboard";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { annotationColorForModifiers, BOARD_ANNOTATION_COLORS } from "@/chess/components/boardAnnotations";
import { BOARD_INTERACTION_OPTIONS, BOARD_MOTION_OPTIONS } from "@/chess/components/boardMotion";
import { chessJsColor } from "@/chess/game/colors";
import { boardDropAction, checkedKingSquare, legalMovesFrom } from "@/chess/game/rules";
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
  arrows?: Array<{ startSquare: string; endSquare: string; color: string }>;
  circles?: Array<{ square: string; color: string }>;
  /** Allow the human pieces to queue a move while the opponent's clock is running. */
  allowPremoves?: boolean;
  premove?: [string, string] | null;
  allowDrawingArrows?: boolean;
  annotationMode?: "arrow" | "circle" | null;
  onAnnotationSquare?: (square: string) => void;
  onArrowsChange?: (arrows: Array<{ startSquare: string; endSquare: string; color: string }>) => void;
  onCircleToggle?: (square: string, color: string) => void;
  onClearAnnotations?: () => void;
  boardId?: string;
};

export function AcademyChessboard({ fen, orientation, humanColor, interactive, lastMove, onMove, arrows = [], circles = [], allowPremoves = false, premove = null, allowDrawingArrows = false, annotationMode = null, onAnnotationSquare, onArrowsChange, onCircleToggle, onClearAnnotations, boardId = "academy-play-board" }: Props) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const rightGestureRef = useRef<{ startSquare: string; color: string } | null>(null);
  const boardRef = useOutsideBoardAnnotationClear(onClearAnnotations ? () => {
    rightGestureRef.current = null;
    onClearAnnotations();
  } : undefined);
  const chess = useMemo(() => new Chess(fen), [fen]);
  const legalMoves = useMemo(() => {
    if (!selectedSquare) return [];
    const selectedPiece = chess.get(selectedSquare as Square);
    const isPremoveSelection = allowPremoves
      && selectedPiece?.color === chessJsColor(humanColor)
      && selectedPiece.color !== chess.turn();
    return isPremoveSelection
      ? premoveMovesFrom(chess, selectedSquare)
      : legalMovesFrom(chess, selectedSquare);
  }, [allowPremoves, chess, humanColor, selectedSquare]);

  useEffect(() => {
    setSelectedSquare(null);
  }, [fen]);

  function selectOrMove(square: string) {
    if (annotationMode && onAnnotationSquare) {
      onAnnotationSquare(square);
      return;
    }
    if (!interactive) return;
    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }
    const target = legalMoves.find((move) => move.to === square);
    if (selectedSquare && target) {
      onMove(selectedSquare, square);
      return;
    }
    const piece = chess.get(square as Square);
    if (piece?.color === chessJsColor(humanColor) && (piece.color === chess.turn() || allowPremoves)) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (lastMove) {
      styles[lastMove[0]] = { backgroundColor: "rgba(250, 204, 21, .32)" };
      styles[lastMove[1]] = { backgroundColor: "rgba(250, 204, 21, .45)" };
    }
    const checkSquare = checkedKingSquare(chess);
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
    for (const circle of circles) {
      styles[circle.square] = {
        ...styles[circle.square],
        boxShadow: `inset 0 0 0 7px ${circle.color}`,
        borderRadius: "50%"
      };
    }
    return styles;
  }, [chess, circles, lastMove, legalMoves, premove, selectedSquare]);

  const options: ChessboardOptions = {
    id: boardId,
    position: fen,
    boardOrientation: orientation,
    showNotation: true,
    ...BOARD_MOTION_OPTIONS,
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
    canDragPiece: ({ piece }) => interactive
      && !annotationMode
      && piece.pieceType.startsWith(chessJsColor(humanColor))
      && (chess.turn() === chessJsColor(humanColor) || allowPremoves),
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
      if (action === "illegal") return false;
      onMove(sourceSquare, targetSquare);
      return action === "move";
    }
  };

  const arrowKey = arrows.map((arrow) => `${arrow.startSquare}${arrow.endSquare}${arrow.color}`).sort().join("-");
  return <div ref={boardRef} className="h-full w-full"><Chessboard key={`${boardId}-${arrowKey}`} options={options} /></div>;
}
