"use client";

import { Chessboard, type ChessboardOptions } from "react-chessboard";
import { useRef, useState } from "react";
import { annotationColorForModifiers, BOARD_ANNOTATION_COLORS, toggleBoardCircle, type BoardCircle } from "./boardAnnotations";
import { useOutsideBoardAnnotationClear } from "@/chess/hooks/useOutsideBoardAnnotationClear";
import styles from "./ResponsiveChessboard.module.css";
import { castlingDropTarget } from "@/chess/game/castlingInput";

/** Keep squares, pieces and annotations in one coordinate space on every screen. */
export function ResponsiveChessboard({ options }: { options: ChessboardOptions }) {
  // Boards with controlled annotations keep their existing handler. All other
  // boards get circles independently of whether arrow drawing is enabled.
  const [annotations, setAnnotations] = useState({ position: options.position, id: options.id, circles: [] as BoardCircle[] });
  const gesture = useRef<{ square: string; color: string } | null>(null);
  if (annotations.position !== options.position || annotations.id !== options.id) {
    setAnnotations({ position: options.position, id: options.id, circles: [] });
  }
  const clearCircles = () => {
    gesture.current = null;
    setAnnotations(current => current.circles.length ? { ...current, circles: [] } : current);
  };
  const boardRef = useOutsideBoardAnnotationClear(options.onSquareRightClick ? undefined : clearCircles);
  return (
    <div ref={boardRef} className={styles.frame}>
      <Chessboard options={{
        ...options,
        onPieceDrop: options.onPieceDrop ? drop => options.onPieceDrop!({
          ...drop,
          targetSquare: drop.targetSquare ? castlingDropTarget(options.position, drop.sourceSquare, drop.targetSquare) : drop.targetSquare
        }) : undefined,
        onSquareMouseDown: (square, event) => {
          if (event.button === 0) clearCircles();
          if (event.button === 2) gesture.current = { square: square.square, color: annotationColorForModifiers(event) };
          options.onSquareMouseDown?.(square, event);
        },
        onSquareRightClick: square => {
          if (options.onSquareRightClick) {
            options.onSquareRightClick(square);
          } else if (!gesture.current || gesture.current.square === square.square) {
            const color = gesture.current?.color ?? BOARD_ANNOTATION_COLORS.primary;
            setAnnotations(current => ({ ...current, circles: toggleBoardCircle(current.circles, { square: square.square, color }) }));
          }
          gesture.current = null;
        },
        onSquareClick: square => {
          clearCircles();
          options.onSquareClick?.(square);
        },
        boardStyle: {
          ...options.boardStyle,
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
          gridTemplateRows: "repeat(8, minmax(0, 1fr))"
        }
      }} />
      {!options.onSquareRightClick && annotations.circles.length > 0 ? (
        <svg className={styles.circles} viewBox="0 0 8 8" aria-hidden="true">
          {annotations.circles.map(({ square, color }) => {
            const file = square.charCodeAt(0) - 97;
            const rank = Number(square[1]) - 1;
            const flipped = options.boardOrientation === "black";
            return <circle key={square} cx={(flipped ? 7 - file : file) + 0.5} cy={(flipped ? rank : 7 - rank) + 0.5} r={0.41} fill="none" stroke={color} strokeWidth={0.075} />;
          })}
        </svg>
      ) : null}
    </div>
  );
}
