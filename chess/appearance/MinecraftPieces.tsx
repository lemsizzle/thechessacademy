import type { CSSProperties } from "react";
import type { defaultPieces } from "react-chessboard";

type PieceKind = "P" | "R" | "N" | "B" | "Q" | "K";
// Original voxel chess silhouettes: small solid pawns, split mitres, horse profiles,
// castle battlements and different royal crowns stay legible on phone boards.
export function MinecraftPiece({ kind, black = false, svgStyle }: { kind: PieceKind; black?: boolean; svgStyle?: CSSProperties }) {
  const stone = black ? "#444554" : "#eee9da";
  const top = black ? "#777c8b" : "#fffdf4";
  const side = black ? "#252735" : "#a9a494";
  const line = "#141d25";
  const rim = black ? "#b6b2cc" : "#f7f3da";
  const gem = black ? "#bd85ff" : "#37ded2";
  const gold = "#edbb52";
  return <svg viewBox="0 0 64 64" width="100%" height="100%" style={svgStyle} aria-hidden="true" focusable="false" data-minecraft-piece={`${black ? "b" : "w"}${kind}`}>
    <path d="M10 56L33 62L56 56L33 51Z" fill="#08130e" opacity=".3" />
    <g stroke={line} strokeWidth="1.5" strokeLinejoin="miter">
      {/* A broad beveled block plinth gives every piece a consistent footprint. */}
      <path d="M12 49L33 44L53 49V56L33 61L12 56Z" fill={stone} stroke={rim} strokeWidth="3" />
      <path d="M12 49L33 44L53 49L33 54Z" fill={top} />
      <path d="M33 54L53 49V56L33 61Z" fill={side} />
      <path d="M12 49L33 54V61L12 56Z" fill={stone} />
      <path d="M20 46L27 32H38L44 46L33 50Z" fill={stone} />
      <path d="M33 34H38L44 46L33 50Z" fill={side} stroke="none" />
      {kind === "P" ? <g data-silhouette="small-cube-pawn">
        <path d="M23 22L33 19L43 22V33L33 37L23 33Z" fill={stone} />
        <path d="M23 22L33 19L43 22L33 26Z" fill={top} />
        <path d="M33 26L43 22V33L33 37Z" fill={side} />
        <path d="M26 27H29V30H26Z" fill={gem} stroke="none" />
      </g> : null}
      {kind === "R" ? <g data-silhouette="battlement-rook">
        <path d="M20 20H45V44L33 48L20 44Z" fill={stone} />
        <path d="M33 23L45 20V44L33 48Z" fill={side} />
        <path d="M17 11H24V17H29V11H36V17H41V11H48V26L33 30L17 26Z" fill={stone} />
        <path d="M17 11L21 8H28L24 11ZM29 11L33 8H40L36 11ZM41 11L45 8H52L48 11Z" fill={top} />
        <path d="M48 11L52 8V23L48 26Z" fill={side} />
        <path d="M24 33H28V37H24ZM34 33H38V37H34ZM28 37H34V42H31V40H28Z" fill={black ? gem : "#376c4d"} stroke="none" />
      </g> : null}
      {kind === "N" ? <g data-silhouette="block-horse-knight">
        <path d="M22 47V39L29 31L25 27L20 31H10V22L19 16L22 8H28V14H35L43 22L47 47L34 50Z" fill={stone} />
        <path d="M28 14H35L43 22L47 47L38 49L36 26Z" fill={side} />
        <path d="M22 8L26 5H32L28 8V14H22Z" fill={top} />
        <path d="M10 22L19 16H26L20 22Z" fill={top} />
        <path d="M33 15L40 19L46 27L48 38L42 36L39 26Z" fill={black ? "#9780bd" : "#937148"} />
        <path d="M23 20H28V24H23Z" fill={line} stroke="none" />
        <path d="M15 26H18V29H15Z" fill={side} stroke="none" />
      </g> : null}
      {kind === "B" ? <g data-silhouette="split-diamond-mitre">
        <path d="M29 7H36V12H41V17H46V25L38 33H27L19 25V17H24V12H29Z" fill={stone} />
        <path d="M29 7H36V12H41L34 19L28 25L24 22L30 16L33 13H29Z" fill={line} />
        <path d="M38 17L46 17V25L38 33H33V28L39 23Z" fill={side} stroke="none" />
        <path d="M18 34L33 31L47 34V38L33 41L18 38Z" fill={stone} />
        <path d="M29 40H36V45H29Z" fill={gem} stroke="none" />
      </g> : null}
      {kind === "Q" ? <g data-silhouette="three-point-crown">
        <path d="M18 13H24V22H29V8H36V22H41V13H47L44 31H21Z" fill={gold} />
        <path d="M21 31H44V36L33 40L21 36Z" fill={stone} />
        <path d="M33 31H44V36L33 40Z" fill={side} />
        <path d="M29 25L33 21L37 25L33 29Z" fill={gem} />
        <path d="M29 8V5H36V8M18 13V10H24V13M41 13V10H47V13" fill={top} />
      </g> : null}
      {kind === "K" ? <g data-silhouette="cross-crown">
        <path d="M29 4H36V10H42V17H36V23H29V17H23V10H29Z" fill={gold} />
        <path d="M21 25L33 21L45 25V32L40 37H25L21 32Z" fill={stone} />
        <path d="M33 21L45 25V32L40 37H33Z" fill={side} />
        <path d="M21 25L33 29L45 25V29L33 33L21 29Z" fill={gold} />
        <path d="M29 35H36V41H29Z" fill={gem} />
      </g> : null}
      <path d="M17 51L29 54V56L17 53Z" fill={gem} stroke="none" />
      <path d="M37 55L48 52V54L37 57Z" fill={gold} stroke="none" />
    </g>
  </svg>;
}

export const minecraftPieces = Object.fromEntries(
  (["w", "b"] as const).flatMap((color) => (["P", "R", "N", "B", "Q", "K"] as const).map((kind) => [
    `${color}${kind}`, (props?: { svgStyle?: CSSProperties }) => <MinecraftPiece kind={kind} black={color === "b"} svgStyle={props?.svgStyle} />
  ]))
) as typeof defaultPieces;
