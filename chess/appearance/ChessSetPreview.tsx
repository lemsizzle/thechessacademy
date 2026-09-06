import { PaperThemePreview } from "./PaperPieces";
import { blossomPieces } from "./BlossomPieces";
import { eightBitPieces } from "./EightBitPieces";
import { BLOSSOM_CHESS_SET_SLUG, EIGHT_BIT_CHESS_SET_SLUG, BOARD_THEME_STYLES } from "./themes";

export function ChessSetPreview({ slug, large = false }: { slug: string; large?: boolean }) {
  if (slug !== BLOSSOM_CHESS_SET_SLUG && slug !== EIGHT_BIT_CHESS_SET_SLUG) return <PaperThemePreview large={large} />;
  const pixel = slug === EIGHT_BIT_CHESS_SET_SLUG;
  const renderers = pixel ? eightBitPieces : blossomPieces;
  const styles = BOARD_THEME_STYLES[pixel ? "eightBit" : "blossom"];
  const pieces: Record<number, string> = { 1: "bR", 2: "bK", 5: "bB", 6: "bN", 9: "wP", 10: "wB", 13: "wQ", 14: "wN" };
  return (
    <div role="img" aria-label={pixel ? "8-Bit Chess Set: mint and indigo board with cream and violet pixel pieces" : "Blossom Chess Set: rose and lilac board with pearl and plum ribbon pieces"} className={`grid aspect-square shrink-0 grid-cols-4 overflow-hidden rounded-lg border-4 ${pixel ? "border-[#56678f]" : "border-[#bc7caa]"} shadow-lg ${large ? "w-72 max-w-full" : "w-28 sm:w-32"}`}>
      {Array.from({ length: 16 }, (_, index) => {
        const Piece = renderers[pieces[index]];
        return <div key={index} className="aspect-square" style={(Math.floor(index / 4) + index % 4) % 2 ? styles.darkSquareStyle : styles.lightSquareStyle}>{Piece ? <Piece /> : null}</div>;
      })}
    </div>
  );
}
