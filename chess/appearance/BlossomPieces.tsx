import type { CSSProperties } from "react";
import type { defaultPieces } from "react-chessboard";

type PieceKind = "P" | "R" | "N" | "B" | "Q" | "K";
// Rounded, recognisable chess silhouettes with small ribbon and jewel accents.
const silhouettes: Record<PieceKind, string> = {
  P: "M25 28C17 22 21 9 32 9S47 22 39 28L36 31C36 38 38 44 43 48H21C26 44 28 38 28 31Z",
  R: "M17 10H24V17H29V10H35V17H40V10H47V25L41 29V42L45 48H19L23 42V29L17 25Z",
  N: "M20 48L22 39L33 28L25 32Q22 34 18 31L12 26L18 17L26 12L29 5L35 11Q48 12 49 26L46 48Z",
  B: "M26 33Q14 28 23 17L32 7L41 17Q50 28 38 33L36 36L39 44L44 48H20L25 44L28 36Z",
  Q: "M20 40L14 17L24 26L32 12L40 26L50 17L44 40L40 44L45 48H19L24 44Z",
  K: "M29 5H35V11H41V17H35V24Q46 18 49 28Q50 34 42 40L40 44L45 48H19L24 44L22 40Q14 34 15 28Q18 18 29 24V17H23V11H29Z"
};

export function BlossomPiece({ kind, black = false, svgStyle }: { kind: PieceKind; black?: boolean; svgStyle?: CSSProperties }) {
  const outline = black ? "#291a45" : "#813b68";
  const body = black ? "#614077" : "#fff9fd";
  const accent = black ? "#efa8d4" : "#d967a3";
  const shine = black ? "#b98bd0" : "#ffffff";
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" style={svgStyle} aria-hidden="true" focusable="false" data-blossom-piece={`${black ? "b" : "w"}${kind}`}>
      <ellipse cx="33" cy="58" rx="21" ry="3" fill="#482345" opacity=".16" />
      <g stroke={outline} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={silhouettes[kind]} fill={body} />
        <path d="M22 48H42Q46 48 47 52L49 56H15L17 52Q18 48 22 48Z" fill={body} />
        <path d="M19 52H45" stroke={accent} strokeWidth="2.5" />
        <path d={kind === "N" ? "M37 16Q43 20 42 31L38 42" : "M34 35L37 43"} stroke={shine} strokeWidth="3" opacity=".65" />
        {kind === "N" ? <><circle cx="29" cy="20" r="1.8" fill={outline} stroke="none" /><path d="M16 26L21 27M36 13Q42 19 40 26" fill="none" /></> : null}
        {kind === "B" ? <path d="M35 15L28 25" strokeWidth="3" /> : null}
        {kind === "R" ? <><path d="M18 25H46M24 30H40" fill="none" /><path d="M30 36Q32 33 34 36V42H30Z" fill={accent} stroke="none" /></> : null}
        {kind === "Q" ? <><path d="M22 40H42" stroke={accent} strokeWidth="3" />{[14, 32, 50].map((x) => <circle key={x} cx={x} cy={x === 32 ? 9 : 14} r="3" fill={accent} />)}<path d="M32 28L36 32L32 36L28 32Z" fill={accent} strokeWidth="1" /></> : null}
        {kind === "K" ? <><path d="M23 40H41" stroke={accent} strokeWidth="3" /><path d="M32 29L35 32L32 35L29 32Z" fill={accent} strokeWidth="1" /></> : null}
        {kind === "P" || kind === "B" || kind === "N" ? <g transform={`translate(${kind === "N" ? "38 38" : "32 32"})`} fill={accent} strokeWidth="1"><path d="M0 0Q-9-8-8 0Q-9 8 0 2Q9 8 8 0Q9-8 0 0Z" /><circle cx="0" cy="1" r="2" fill={shine} /></g> : null}
      </g>
    </svg>
  );
}

// Stable module-level renderers avoid remounting pieces during moves or theme changes.
export const blossomPieces = Object.fromEntries(
  (["w", "b"] as const).flatMap((color) => (["P", "R", "N", "B", "Q", "K"] as const).map((kind) => [
    `${color}${kind}`, (props?: { svgStyle?: CSSProperties }) => <BlossomPiece kind={kind} black={color === "b"} svgStyle={props?.svgStyle} />
  ]))
) as typeof defaultPieces;
