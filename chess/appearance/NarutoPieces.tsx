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
  const skin = black ? "#e6c3b6" : "#ffd2a1";
  const hair = black ? "#191b30" : "#ffd039";
  return <svg viewBox="0 0 64 64" width="100%" height="100%" style={svgStyle} aria-hidden="true" focusable="false" data-naruto-piece={`${black ? "b" : "w"}${kind}`}>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2=".7">
        <stop stopColor={black ? "#606076" : "#fffbea"} />
        <stop offset=".45" stopColor={black ? "#242033" : "#ffe7a1"} />
        <stop offset="1" stopColor={black ? "#10111d" : "#cd8930"} />
      </linearGradient>
    </defs>
    <ellipse cx="32" cy="58" rx="23" ry="3" fill="#000" opacity=".35" />
    {kind !== "P" && <g data-chakra="true">
      <path d="M12 49L7 37L12 39L8 26L15 32L13 15L21 25M51 49L58 35L52 39L56 24L49 30L50 14L43 25" fill={black ? "#ad264a" : "#ffb426"} opacity=".3" />
      <path d="M9 48L7 42M55 46L59 38M12 22L10 17M53 19L55 12" stroke={gold} strokeWidth="1.3" />
    </g>}
    <g stroke={edge} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
      {kind === "P" ? <g data-character="shinobi-pawn">
        <path d="M28 32H36Q35 41 42 48H22Q29 41 28 32Z" fill={`url(#${id})`} />
        <path d="M25 34H39" stroke={gold} strokeWidth="2" />
        <circle data-pawn-head="round" cx="32" cy="23" r="10" fill={`url(#${id})`} />
        <path d="M22 21Q32 19 42 21V25Q32 23 22 25Z" fill="#242b3b" strokeWidth=".8" />
        <rect x="28" y="21" width="8" height="3" rx=".7" fill="#c3d9e5" stroke="none" />
        <path d="M28 27H29M35 27H36" stroke={black ? "#fff0d8" : "#443023"} strokeWidth="1.5" />
      </g> : kind === "N" ? <g data-character={black ? "susanoo" : "kurama"}>
        {!black && <g fill="#ef942b" stroke="#743716" strokeWidth=".9" data-nine-tails="true">
          {Array.from({ length: 9 }, (_, index) => <path key={index} transform={`rotate(${index * 15 - 60} 36 43)`} d="M35 46Q47 38 40 17Q55 26 45 45L40 49Z" />)}
        </g>}
        <path d={shapes.N} fill={black ? "#6744ac" : "#ee962b"} stroke={black ? "#dac4ff" : "#5e3119"} />
        {black ? <>
          <path d="M23 18L17 5L29 12L35 19L40 6L44 19L39 25L29 23Z" fill="#9370d6" stroke="#dbc8ff" />
          <path d="M13 27L26 23L34 25L27 30L19 31Z" fill="#30204d" stroke="#c5a7ff" />
          <path d="M21 26L28 26" stroke="#a9fbff" strokeWidth="2" />
          <path d="M35 30L45 33L36 36L44 39L34 42L43 45M32 32L28 44" fill="none" stroke="#c4a0ff" strokeWidth="2" />
          <path d="M18 31L20 35L24 33L26 35L29 30" fill="#ddd1ff" strokeWidth=".8" />
        </> : <>
          <path d="M23 11L24 22L29 16M37 10L35 21L40 18" fill="#452625" />
          <path d="M17 26L29 22L25 29Z" fill="#231b24" stroke="#231b24" />
          <path d="M22 25H26" stroke="#fff5b6" strokeWidth="1.2" />
          <path d="M12 27L16 26L16 29Z" fill="#231b24" />
          <path d="M24 32L30 30L27 35L32 34M34 23L39 26L35 29M35 33L40 39L36 37" fill="none" stroke="#512825" />
          <path d="M20 30L22 32L24 29" fill="#fff4ce" strokeWidth=".7" />
        </>}
      </g> : kind === "B" ? <g data-character="shinobi-bishop">
        <path d="M25 34H39L37 40L43 48H21L27 40Z" fill={`url(#${id})`} />
        <path d="M32 5Q15 21 22 30Q32 38 42 30Q49 21 32 5Z" fill={`url(#${id})`} />
        <path d="M35 10L29 19" stroke={black ? "#0e101c" : "#533923"} strokeWidth="3" />
        <path d="M24 25H40L38 31L32 34L26 31Z" fill={skin} />
        <path d="M22 22H42V26H22Z" fill="#202838" /><path d="M28 23H36V25H28Z" fill="#c3d9e5" stroke="none" />
        <path d="M27 28H29M35 28H37M30 31H34" stroke="#302336" strokeWidth="1" />
        <path d="M24 37H40" stroke={gold} strokeWidth="2" />
      </g> : kind === "K" || kind === "Q" ? <g data-character={kind === "K" ? "hokage" : "tsunade"}>
        <path d="M23 32H41L46 47H18Z" fill={kind === "K" ? (black ? "#353447" : "#fff5df") : (black ? "#204b45" : "#559475")} />
        <path d="M23 33L17 36L14 47L24 47M41 33L47 36L50 47L40 47" fill={kind === "K" ? (black ? "#444052" : "#fff5df") : (black ? "#204b45" : "#559475")} />
        <path d="M26 33L32 37L38 33L37 47H27Z" fill={kind === "K" ? "#a63239" : "#c9c4c2"} />
        <path d="M28 37L35 43M36 37L29 43M27 45H37" stroke={kind === "K" ? "#f7ce7e" : "#343140"} strokeWidth="1" />
        <path d="M22 17Q22 12 32 12Q42 12 42 20L40 28L32 33L24 28Z" fill={skin} stroke="#493039" />
        {kind === "Q" ? <>
          <path d="M22 18Q21 11 32 12Q44 11 43 22L44 35L39 32L38 19L33 17L26 20L25 33L20 36Z" fill="#e9c061" stroke="#765132" />
          <path d="M31 20L32 18L33 20L32 22Z" fill="#73449e" stroke="none" />
          <path d="M23 14L20 5L27 10L32 3L37 10L44 5L41 14Z" fill={black ? "#a987da" : "#ffd463"} />
          <circle cx="20" cy="5" r="1.5" fill={gold} /><circle cx="32" cy="3" r="1.5" fill={gold} /><circle cx="44" cy="5" r="1.5" fill={gold} />
          <path d="M24 14H40" stroke={gold} strokeWidth="2" />
        </> : <>
          <path d="M21 17L23 31L19 33L18 18M43 17L41 31L45 33L46 18" fill={black ? "#bcb7c7" : "#fff5df"} />
          <path d="M17 17L23 9H41L47 17L40 20H24Z" fill={black ? "#4a344e" : "#fff6e3"} />
          <path d="M26 10H38L41 17H23Z" fill="#bd3743" />
          <path d="M29 1H35V5H39V9H35V13H29V9H25V5H29Z" fill={black ? "#d0b4f1" : "#ffd463"} strokeWidth="1" />
          <path d="M17 47L20 41L22 47L25 42L27 47M37 47L40 42L42 47L45 41L47 47" fill="#cd3b46" stroke="none" />
        </>}
        <path d="M26 24L29 25M35 25L38 24" stroke="#392a35" strokeWidth="1.4" />
        <path d="M31 26L30 28M29 30H35" stroke="#955d56" strokeWidth=".8" />
      </g> : <>
        <path d="M19 48L17 37L24 33H40L47 37L45 48Z" fill={black ? "#171826" : "#f18d24"} stroke="#161829" />
        <path d="M18 37L12 47L22 49L25 38M46 37L52 47L42 49L39 38" fill={black ? "#303041" : "#ffe4ba"} stroke="#161829" />
        <path d="M28 30H36V37L32 40L28 37Z" fill={skin} stroke="#5f3940" />
        <path d="M20 18Q21 11 32 11Q44 11 45 20L42 30L32 36L22 30Z" fill={skin} stroke="#422a38" />
        <path d="M39 19L42 27L36 32L32 36L42 30L45 20Z" fill="#a46a70" opacity=".3" stroke="none" />
        <path d="M18 24L14 17L21 18L17 10L25 13L25 5L31 11L36 4L38 11L47 8L44 16L50 17L44 26L40 18L36 22L33 16L27 21L25 17L22 25Z" fill={hair} stroke="#292134" />
        <path d="M23 17H41L42 22H22Z" fill="#202737" stroke="#151b2a" />
        <path d="M27 18H37V21H27Z" fill="#b9d6e6" stroke="none" />
        <path d="M31 19H34M32 19V20" stroke="#3b5069" strokeWidth=".7" />
        <path d="M23 24L29 25L25 27ZM35 25L41 24L39 27Z" fill="#fff" stroke="#272036" strokeWidth="1" />
        <path d="M27 25V27M37 25V27" stroke={black ? "#d92049" : "#2385c2"} strokeWidth="2" />
        <path d="M23 23L29 24M35 24L41 23" stroke="#251c2b" strokeWidth="1.3" />
        <path d="M32 26L31 29L33 29M29 32L35 31" stroke="#92594d" strokeWidth=".8" fill="none" />
        {!black && <path d="M22 28L26 29M22 30L26 31M38 29L42 28M38 31L42 30" stroke="#9a5f45" strokeWidth=".6" />}
        <path d="M22 33L29 36L32 42L35 36L42 33L41 44H23Z" fill={black ? "#252337" : "#ffefce"} stroke="#242033" />
        <path d="M32 42V48" stroke={gold} strokeWidth="2" />
        {kind === "R" && <path d="M20 14V5H25V10H29V5H35V10H39V5H44V14Z" fill={`url(#${id})`} />}
      </>}
      <path d="M22 47H42L47 51L50 57H14L17 51Z" fill={`url(#${id})`} />
      <path d="M18 52H46M17 56H47" stroke={gold} strokeWidth="2" />
      {kind === "R" && <g transform="translate(0 7) scale(1 .85)">
        {black ? <path d="M27 40C22 39 23 35 27 35C27 31 33 31 34 35C39 33 43 37 39 40C35 43 30 42 27 40Z" fill="#dc354b" stroke="#ffd3c9" strokeWidth=".7" /> :
          <path d="M34 35C28 32 25 38 29 40C34 43 38 37 34 35M28 40L25 42L25 38M35 35L38 32" fill="none" stroke="#76411b" strokeWidth="1.3" />}
      </g>}
    </g>
  </svg>;
}

// Stable, lightweight vector renderers for all twelve pieces.
export const narutoPieces = Object.fromEntries(
  (["w", "b"] as const).flatMap(color => (["P", "R", "N", "B", "Q", "K"] as const).map(kind => [
    `${color}${kind}`, (props?: { svgStyle?: CSSProperties }) => <NarutoPiece kind={kind} black={color === "b"} svgStyle={props?.svgStyle} />
  ]))
) as typeof defaultPieces;
