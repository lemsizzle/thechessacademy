"use client";

import { Chessboard, type ChessboardOptions } from "react-chessboard";
import styles from "./ResponsiveChessboard.module.css";

/** Keep squares, pieces and annotations in one coordinate space on every screen. */
export function ResponsiveChessboard({ options }: { options: ChessboardOptions }) {
  return (
    <div className={styles.frame}>
      <Chessboard options={{
        ...options,
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
    </div>
  );
}
