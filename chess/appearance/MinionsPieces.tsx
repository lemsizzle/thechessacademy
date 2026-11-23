import type { CSSProperties } from "react";
import type { defaultPieces } from "react-chessboard";

type PieceKind = "P" | "R" | "N" | "B" | "Q" | "K";

// Shared 64px canvas: compact pawns, tall mitres, horse profiles and distinct crowns.
export function MinionsPiece({ kind, black = false, svgStyle }: { kind: PieceKind; black?: boolean; svgStyle?: CSSProperties }) {
  const skin = black ? "#9970db" : "#ffdc42";
  const shade = black ? "#604297" : "#e9aa26";
  const light = black ? "#cbb1f5" : "#fff395";
  const denim = black ? "#282c48" : "#287ec2";
  const edge = black ? "#d9c8f6" : "#fff5c2";
  const ink = "#202438";
  const gold = "#f4bc47";
  const pawn = kind === "P";
  const knight = kind === "N";
  const eyeY = pawn ? 31 : 30;
  return <svg viewBox="0 0 64 64" width="100%" height="100%" style={svgStyle} aria-hidden="true" focusable="false" data-minions-piece={`${black ? "b" : "w"}${kind}`}>
    <ellipse cx="32" cy="58" rx="24" ry="4" fill="#131627" opacity=".28" />
    <g stroke={ink} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
      {/* Light and dark plinths preserve team identity even at small sizes. */}
      <path d="M15 51Q32 47 49 51L54 57Q32 64 10 57Z" fill={black ? "#353047" : "#fff2cf"} stroke={edge} strokeWidth="2" />
      <path d="M15 54Q32 59 49 54" fill="none" stroke={black ? "#a989d5" : "#d3a652"} />
      {knight ? <g data-silhouette="goggled-horse-knight">
        <path d="M23 51L26 38L18 35L13 37L6 31L9 25L19 20L23 9L29 15L37 13Q48 22 49 50Z" fill={skin} />
        <path d="M34 14Q46 23 49 50H38L36 35L39 28Z" fill={shade} stroke="none" />
        <path d="M29 15L37 11L44 16L48 23L43 22L49 30L43 29L49 38L42 36L43 47H36L35 29Z" fill={denim} />
        <path d="M10 27L19 23L24 29L17 34" fill="none" stroke={denim} strokeWidth="3" />
        <path d="M18 23L35 21" stroke={ink} strokeWidth="4" />
        <circle cx="27" cy="23" r="7" fill="#c6d1dc" />
        <circle cx="27" cy="23" r="4.6" fill="#fffdf1" stroke="none" />
        <circle cx="25.5" cy="23" r="2.2" fill="#74502c" stroke="none" />
        <circle cx="25" cy="23" r="1.1" fill={ink} stroke="none" />
        <path d="M8 31L11 32M23 12L25 18" fill="none" />
        <path d="M23 46Q34 50 46 46V52H22Z" fill={denim} />
      </g> : <>
        {/* The pawn is deliberately short and round, without a crown or hair spikes. */}
        <g data-silhouette={pawn ? "round-goggle-pawn" : kind === "R" ? "castle-rook" : kind === "B" ? "split-mitre-bishop" : kind === "Q" ? "five-point-crown" : "cross-crown"}>
          <path d={pawn ? "M21 44V30A11 11 0 0 1 22 25Q32 14 42 25L43 30V44Z" : "M19 44V28Q19 16 32 16Q45 16 45 28V44Z"} fill={skin} />
          <path d={pawn ? "M37 23Q43 28 43 35V45H37Z" : "M38 19Q45 23 45 32V46H38Z"} fill={shade} stroke="none" />
          <path d={pawn ? "M23 28Q23 23 29 22" : "M22 25Q22 20 29 19"} stroke={light} strokeWidth="2.5" fill="none" />
          <path d={pawn ? "M21 38L27 41H37L43 38V47Q32 53 21 47Z" : "M19 36L26 40H38L45 36V47Q32 54 19 47Z"} fill={denim} />
          <path d="M25 38V44H39V38M28 46H36V49H28Z" fill="none" stroke={black ? "#70789a" : "#89cbeb"} strokeWidth="1" />
          <path d="M22 49V52H29V49M35 49V52H42V49" fill={ink} />
          <path d={pawn ? "M21 31H43" : "M19 30H45"} strokeWidth="5" />
          {pawn ? <>
            <circle cx="32" cy={eyeY} r="7.5" fill="#b8c6d3" />
            <circle cx="32" cy={eyeY} r="5.2" fill="#fffef0" stroke="none" />
            <circle cx="33" cy={eyeY} r="2.7" fill="#8b5831" stroke="none" />
            <circle cx="33" cy={eyeY} r="1.5" fill={ink} stroke="none" />
            <circle cx="32.2" cy={eyeY - 1} r=".8" fill="#fff" stroke="none" />
          </> : [26,38].map((x) => <g key={x}>
            <circle cx={x} cy={eyeY} r="6.4" fill="#b8c6d3" />
            <circle cx={x} cy={eyeY} r="4.4" fill="#fffef0" stroke="none" />
            <circle cx={x + .5} cy={eyeY} r="2.4" fill="#8b5831" stroke="none" />
            <circle cx={x + .5} cy={eyeY} r="1.3" fill={ink} stroke="none" />
            <circle cx={x} cy={eyeY - 1} r=".7" fill="#fff" stroke="none" />
          </g>)}
          <path d={black ? "M28 39L31 37L35 39" : "M28 38Q32 42 36 38"} fill="none" strokeWidth="1.3" />
          {kind === "R" ? <>
            <path d="M16 10H23V17H28V10H36V17H41V10H48V24H16Z" fill={black ? "#78718b" : "#fff1c5"} />
            <path d="M18 21H46" stroke={gold} strokeWidth="2" />
            <path d="M24 11V16M37 11V16" stroke="#fff" opacity=".4" />
          </> : null}
          {kind === "B" ? <>
            <path d="M32 4Q45 12 43 19L38 23H26L21 19Q19 12 32 4Z" fill={black ? "#68518c" : "#fff1c5"} />
            <path d="M37 9L29 18" stroke={ink} strokeWidth="3" />
            <path d="M22 22H42" stroke={gold} strokeWidth="3" />
          </> : null}
          {kind === "Q" ? <>
            <path d="M17 12L24 18L25 8L30 16L32 4L35 16L40 8L40 18L47 12L43 24H21Z" fill={gold} />
            <path d="M23 21H41" stroke={light} strokeWidth="2" />
            <path d="M29 21L32 18L35 21L32 24Z" fill={black ? "#d4a4ff" : "#2588d0"} strokeWidth=".7" />
          </> : null}
          {kind === "K" ? <>
            <path d="M29 2H35V7H40V12H35V17H29V12H24V7H29Z" fill={gold} />
            <path d="M19 17Q32 12 45 17L42 24H22Z" fill={black ? "#675580" : "#fff1c5"} />
            <path d="M22 21H42" stroke={gold} strokeWidth="3" />
            <circle cx="32" cy="21" r="2" fill={black ? "#d4a4ff" : "#2588d0"} strokeWidth=".7" />
          </> : null}
        </g>
      </>}
    </g>
  </svg>;
}

export const minionsPieces = Object.fromEntries(
  (["w", "b"] as const).flatMap((color) => (["P", "R", "N", "B", "Q", "K"] as const).map((kind) => [
    `${color}${kind}`, (props?: { svgStyle?: CSSProperties }) => <MinionsPiece kind={kind} black={color === "b"} svgStyle={props?.svgStyle} />
  ]))
) as typeof defaultPieces;
