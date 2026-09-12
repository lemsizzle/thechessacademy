import { useId, type CSSProperties } from "react";
import type { defaultPieces } from "react-chessboard";

type Kind = "P" | "R" | "N" | "B" | "Q" | "K";
const shapes: Record<Kind, string> = {
  P: "M24 27C16 16 23 10 32 10S48 16 40 27L37 31L39 43L44 48H20L25 43L27 31Z",
  R: "M15 10H23V17H28V10H36V17H41V10H49V26L42 30V42L46 48H18L22 42V30L15 26Z",
  N: "M18 48L21 37L31 28L23 32L12 27L19 19L23 7L31 13L39 6L41 16Q51 23 47 36L44 48Z",
  B: "M27 33Q17 29 21 21L32 5L43 21Q47 29 37 33L37 42L44 48H20L27 42Z",
  Q: "M19 39L12 17L23 24L25 10L32 20L39 10L41 24L52 17L45 39L40 43L45 48H19L24 43Z",
  K: "M29 3H35V9H40V15H35V20L49 28L43 33L40 43L45 48H19L24 43L21 33L15 28L29 20V15H24V9H29Z"
};

export function NarutoPiece({ kind, black = false, svgStyle }: { kind: Kind; black?: boolean; svgStyle?: CSSProperties }) {
  const id = useId().replace(/:/g, "");
  const gold = black ? "#ff6672" : "#ef9b22";
  const edge = black ? "#edb381" : "#442413";
  return <svg viewBox="0 0 64 64" width="100%" height="100%" style={svgStyle} aria-hidden="true" focusable="false" data-naruto-piece={`${black ? "b" : "w"}${kind}`}>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2=".7">
        <stop stopColor={black ? "#606076" : "#fffbea"} />
        <stop offset=".45" stopColor={black ? "#242033" : "#ffe7a1"} />
        <stop offset="1" stopColor={black ? "#10111d" : "#cd8930"} />
      </linearGradient>
    </defs>
    <ellipse cx="32" cy="58" rx="23" ry="3" fill="#000" opacity=".35" />
    <path d="M13 46Q7 34 13 23M51 46Q58 34 52 23" fill="none" stroke={gold} strokeWidth="2" opacity=".45" />
    <g stroke={edge} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
      <path d={shapes[kind]} fill={`url(#${id})`} />
      <path d="M22 47H42L47 51L50 57H14L17 51Z" fill={`url(#${id})`} />
      <path d="M18 52H46M17 56H47" stroke={gold} strokeWidth="2" />
      <path d="M25 45L28 35" stroke={black ? "#aba3c3" : "#fffaf0"} opacity=".8" />
      {kind === "P" && <><path d="M22 21H42L40 27H24Z" fill="#182337" /><path d="M27 23H37" stroke="#c6d5dc" strokeWidth="3" /><path d="M40 24L49 28L44 30" fill="#182337" /></>}
      {kind === "R" && <><path d="M15 25H49M22 29H42" stroke={gold} strokeWidth="3" /><path d="M27 44V35Q32 29 37 35V44" fill="#182337" /></>}
      {kind === "N" && <><path d="M22 13L25 23L31 16M37 12L35 21L40 19" fill={gold} /><path d="M17 27L26 25L23 29M33 23L39 21" stroke={gold} strokeWidth="2" /><path d="M39 30L42 38L37 35L40 43" fill="none" stroke={gold} /></>}
      {kind === "B" && <><path d="M36 13L27 28" stroke="#111b2c" strokeWidth="3" /><path d="M23 33H41" stroke={gold} strokeWidth="3" /><path d="M32 7V12" stroke="#fff3d0" /></>}
      {kind === "Q" && <><path d="M18 38H46" stroke={gold} strokeWidth="3" />{[12,25,39,52].map((x) => <circle key={x} cx={x} cy={x===12||x===52?15:8} r="2.5" fill={gold} />)}<path d="M32 25L37 30L32 35L27 30Z" fill={gold} /></>}
      {kind === "K" && <><path d="M15 28L32 19L49 28L43 33H21Z" fill={black ? "#b62442" : "#f8f0db"} /><path d="M32 20V32M21 33H43" stroke={gold} strokeWidth="2" /></>}
      {black ? <path d="M27 40C22 39 23 35 27 35C27 31 33 31 34 35C39 33 43 37 39 40C35 43 30 42 27 40Z" fill="#dc354b" stroke="#ffd3c9" strokeWidth=".7" /> :
        <path d="M34 35C28 32 25 38 29 40C34 43 38 37 34 35M28 40L25 42L25 38M35 35L38 32" fill="none" stroke="#76411b" strokeWidth="1.3" />}
    </g>
  </svg>;
}

// Stable, lightweight vector renderers for all twelve pieces.
export const narutoPieces = Object.fromEntries(
  (["w", "b"] as const).flatMap(color => (["P", "R", "N", "B", "Q", "K"] as const).map(kind => [
    `${color}${kind}`, (props?: { svgStyle?: CSSProperties }) => <NarutoPiece kind={kind} black={color === "b"} svgStyle={props?.svgStyle} />
  ]))
) as typeof defaultPieces;
