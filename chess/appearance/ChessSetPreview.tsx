import { PaperThemePreview } from "./PaperPieces";
import { blossomPieces } from "./BlossomPieces";
import { BLOSSOM_CHESS_SET_SLUG, BOARD_THEME_STYLES } from "./themes";

export function ChessSetPreview({ slug, large = false }: { slug: string; large?: boolean }) {
  if (slug !== BLOSSOM_CHESS_SET_SLUG) return <PaperThemePreview large={large} />;
  const pieces: Record<number, string> = { 1: "bR", 2: "bK", 5: "bB", 6: "bN", 9: "wP", 10: "wB", 13: "wQ", 14: "wN" };
  return (
    <div role="img" aria-label="Blossom Chess Set: rose and lilac board with pearl and plum ribbon pieces" className={`grid aspect-square shrink-0 grid-cols-4 overflow-hidden rounded-lg border-4 border-[#bc7caa] shadow-lg ${large ? "w-72 max-w-full" : "w-28 sm:w-32"}`}>
      {Array.from({ length: 16 }, (_, index) => {
        const Piece = blossomPieces[pieces[index]];
        return <div key={index} className="aspect-square" style={(Math.floor(index / 4) + index % 4) % 2 ? BOARD_THEME_STYLES.blossom.darkSquareStyle : BOARD_THEME_STYLES.blossom.lightSquareStyle}>{Piece ? <Piece /> : null}</div>;
      })}
    </div>
  );
}
