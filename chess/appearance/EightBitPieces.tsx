import type { CSSProperties } from "react";
import type { defaultPieces } from "react-chessboard";

type PieceKind = "P" | "R" | "N" | "B" | "Q" | "K";
// Integer-only silhouettes on a 16-pixel grid: real stepped edges at every size.
const shapes: Record<PieceKind, string> = {
  P: "M6 3H10V4H11V7H10V8H9V11H11V12H5V11H7V8H6V7H5V4H6Z",
  R: "M3 3H5V5H7V3H9V5H11V3H13V7H12V8H10V11H11V12H5V11H6V8H4V7H3Z",
  N: "M6 2H8V3H10V4H11V6H12V12H4V10H5V9H6V8H7V7H5V8H3V7H2V5H3V4H5V3H6Z",
  B: "M7 2H9V3H10V4H11V7H10V8H9V10H10V11H11V12H5V11H6V10H7V8H6V7H5V4H6V3H7Z",
  Q: "M2 3H4V5H5V6H6V4H7V2H9V4H10V6H11V5H12V3H14V6H13V8H12V10H10V11H11V12H5V11H6V10H4V8H3V6H2Z",
  K: "M7 1H9V3H11V5H9V6H11V7H12V9H11V10H10V11H11V12H5V11H6V10H5V9H4V7H5V6H7V5H5V3H7Z"
};

export function EightBitPiece({ kind, black = false, svgStyle }: { kind: PieceKind; black?: boolean; svgStyle?: CSSProperties }) {
  const body = black ? "#7c4ac9" : "#fff1ae";
  const light = black ? "#cba4ff" : "#ffffff";
  const shade = black ? "#432570" : "#d5a447";
  return <svg viewBox="0 0 16 16" width="100%" height="100%" style={svgStyle} shapeRendering="crispEdges" aria-hidden="true" focusable="false" data-eight-bit-piece={`${black ? "b" : "w"}${kind}`}>
    <path d="M3 14H14V15H3Z" fill="#10152e" opacity=".3" />
    <g stroke="#17152d" strokeWidth="1" strokeLinejoin="miter">
      <path d={shapes[kind]} fill={body} />
      <path d="M4 12H12V13H13V14H3V13H4Z" fill={body} />
    </g>
    <path d="M4 13H12V14H4Z" fill={shade} />
    <path d="M5 12H11V13H5Z" fill={light} />
    <path d={kind === "N" ? "M9 5H10V7H11V11H10V7H9Z" : "M8 9H9V11H8Z"} fill={shade} />
    {kind === "N" ? <path d="M6 4H7V5H6Z" fill="#17152d" /> : null}
    {kind === "B" ? <path d="M8 3H9V4H8V5H7V6H6V5H7V4H8Z" fill="#17152d" /> : null}
    {kind === "R" ? <path d="M4 6H12V7H4Z" fill={shade} /> : null}
    {kind === "K" || kind === "Q" ? <path d="M7 7H9V9H7Z" fill={black ? "#68f0da" : "#f16e89"} /> : null}
    {kind === "P" ? <path d="M6 4H9V5H6V6H5V5H6Z" fill={light} /> : null}
  </svg>;
}

export const eightBitPieces = Object.fromEntries(
  (["w", "b"] as const).flatMap((color) => (["P", "R", "N", "B", "Q", "K"] as const).map((kind) => [
    `${color}${kind}`, (props?: { svgStyle?: CSSProperties }) => <EightBitPiece kind={kind} black={color === "b"} svgStyle={props?.svgStyle} />
  ]))
) as typeof defaultPieces;
