import type { CSSProperties } from "react";
import { defaultPieces } from "react-chessboard";

type PieceKind = "P" | "R" | "N" | "B" | "Q" | "K";
const outlines: Record<PieceKind, string> = {
  P: "M24 26 20 19 23 10 32 6 41 10 44 19 40 26 37 29 40 44 46 50 18 50 24 44 27 29Z",
  R: "M17 8 24 8 24 16 29 16 29 8 35 8 35 16 40 16 40 8 47 8 47 25 41 30 41 44 47 50 17 50 23 44 23 30 17 25Z",
  N: "M19 50 21 39 34 26 24 30 13 26 16 18 26 9 27 4 35 9 43 12 49 25 46 50Z",
  B: "M22 32 18 24 23 14 32 5 41 14 46 24 42 32 36 35 39 44 46 50 18 50 25 44 28 35Z",
  Q: "M20 42 13 16 24 26 32 12 40 26 51 16 44 42 41 46 47 50 17 50 23 46Z",
  K: "M28 6 36 6 36 12 42 12 42 19 36 19 36 24 45 23 49 30 42 40 40 46 46 50 18 50 24 46 22 40 15 30 19 23 28 24 28 19 22 19 22 12 28 12Z"
};

export function PaperPiece({ kind, black = false, svgStyle }: { kind: PieceKind; black?: boolean; svgStyle?: CSSProperties }) {
  const ink = black ? "#eadfcb" : "#514536";
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" style={svgStyle} aria-hidden="true" focusable="false" data-paper-piece={`${black ? "b" : "w"}${kind}`}>
      <path d="M15 56 50 56 54 60 18 60Z" fill="#30281f" opacity=".2" />
      <g stroke={ink} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <path d={outlines[kind]} fill={black ? "#3e3b37" : "#fff9ec"} />
        <path d={kind === "N" ? "M35 10 40 24 30 40 25 49 45 49 48 25 42 13Z" : "M32 29 37 35 39 44 45 49 32 49Z"} fill={black ? "#666057" : "#dfcfb4"} stroke="none" />
        <path d="M18 50 46 50 50 57 14 57Z" fill={black ? "#48443e" : "#fff9ec"} />
        <path d="M18 50 32 54 46 50M32 54v3" fill="none" opacity=".6" />
        {kind === "N" ? <><path d="m30 16 3 1-3 2Z" fill={ink} /><path d="m17 23 5 1M35 11l5 13-13 20" fill="none" opacity=".65" /></> : null}
        {kind === "B" ? <path d="m34 13-8 12" fill="none" strokeWidth="3" /> : null}
        {kind === "R" ? <path d="M18 25h28M24 31l8 5 8-5" fill="none" opacity=".6" /> : null}
        {kind === "Q" ? <><path d="M21 41h22M25 27l7 10 7-10" fill="none" opacity=".65" /><circle cx="13" cy="13" r="3" fill={black ? "#3e3b37" : "#fff9ec"} /><circle cx="32" cy="8" r="3" fill={black ? "#3e3b37" : "#fff9ec"} /><circle cx="51" cy="13" r="3" fill={black ? "#3e3b37" : "#fff9ec"} /></> : null}
        {kind === "K" ? <path d="m22 27 10 9 10-9M23 40h18" fill="none" opacity=".65" /> : null}
        {kind === "P" ? <path d="m24 12 8 5 8-5M32 17v9M26 29h12" fill="none" opacity=".55" /> : null}
      </g>
    </svg>
  );
}

// Stable renderer identities keep react-chessboard's moving pieces mounted.
export const paperPieces = Object.fromEntries(
  (["w", "b"] as const).flatMap((color) => (["P", "R", "N", "B", "Q", "K"] as const).map((kind) => [
    `${color}${kind}`, (props?: { svgStyle?: CSSProperties }) => <PaperPiece kind={kind} black={color === "b"} svgStyle={props?.svgStyle} />
  ]))
) as typeof defaultPieces;

export function PaperThemePreview({ large = false }: { large?: boolean }) {
  const pieces: Record<number, string> = { 1: "bR", 2: "bK", 5: "bP", 6: "bN", 9: "wB", 10: "wP", 13: "wQ", 14: "wN" };
  return (
    <div role="img" aria-label="Paper Chess Set: warm paper board with cream and charcoal folded-paper pieces" className={`grid aspect-square shrink-0 grid-cols-4 overflow-hidden rounded-lg border-4 border-[#766148] shadow-lg ${large ? "w-72 max-w-full" : "w-28 sm:w-32"}`}>
      {Array.from({ length: 16 }, (_, index) => {
        const Piece = paperPieces[pieces[index]];
        return <div key={index} className="aspect-square" style={{ backgroundColor: (Math.floor(index / 4) + index % 4) % 2 ? "#b49b7a" : "#f2eadb" }}>{Piece ? <Piece /> : null}</div>;
      })}
    </div>
  );
}
