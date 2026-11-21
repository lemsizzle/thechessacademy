import { Chess, type PieceSymbol, type Square } from "chess.js";

/** Version 2 Challenge geometry. Reward verification reconstructs this exact
 * generator from a signed seed; future changes require another token version. */
export function generateChallengeEndgame(topicId: string, random: () => number): string {
  const pick = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  for (let attempt = 0; attempt < 800; attempt++) {
    const tokens: { type: PieceSymbol; color: "w" | "b"; file: number; rank: number }[] = [];
    const add = (type: PieceSymbol, color: "w" | "b", file: number, rank: number) => tokens.push({ type, color, file, rank });
    const file = pick(2, 5);
    if (["queen-mate", "rook-mate", "ladder-mate", "bishop-pair"].includes(topicId)) {
      // The defender has central space; the learner must activate their king.
      add("k", "w", pick(0, 7), pick(1, 2)); add("k", "b", pick(2, 5), pick(4, 6));
      if (topicId === "queen-mate") add("q", "w", pick(0, 7), pick(1, 3));
      if (topicId === "rook-mate" || topicId === "ladder-mate") add("r", "w", pick(0, 7), pick(1, 3));
      if (topicId === "ladder-mate") add("r", "w", pick(0, 7), pick(1, 3));
      if (topicId === "bishop-pair") {
        const first = { file: pick(0, 7), rank: pick(1, 3) }, second = { file: pick(0, 7), rank: pick(1, 3) };
        if ((first.file + first.rank) % 2 === (second.file + second.rank) % 2) continue;
        add("b", "w", first.file, first.rank); add("b", "w", second.file, second.rank);
      }
    } else if (topicId === "king-and-pawn") {
      add("p", "w", file, pick(2, 3)); add("k", "w", file + pick(-1, 1), 5);
      add("k", "b", file + pick(-1, 1), 7);
    } else if (topicId === "rook-escort") {
      add("p", "w", file, 5); add("k", "w", file + pick(-1, 1), 6);
      add("r", "w", file, pick(1, 3)); add("k", "b", file < 4 ? 7 : 0, pick(6, 7));
      add("r", "b", file < 4 ? pick(5, 7) : pick(0, 2), pick(2, 4));
    } else if (topicId === "connected-passers") {
      add("p", "w", file, 4); add("p", "w", file + 1, pick(3, 4));
      add("k", "w", file, pick(2, 3)); add("k", "b", file + pick(-1, 1), 6);
      add("p", "b", file < 4 ? 7 : 0, pick(5, 6));
    } else if (topicId === "outside-passer") {
      add("k", "w", pick(3, 5), 4); add("k", "b", pick(4, 6), 6);
      add("p", "w", pick(0, 1), pick(2, 3)); add("p", "w", 5, 3); add("p", "w", 6, pick(2, 3));
      add("p", "b", 5, pick(5, 6)); add("p", "b", 6, 6);
    } else if (["extra-queen", "extra-rook", "extra-bishop", "black-queen"].includes(topicId)) {
      add("k", "w", pick(4, 6), pick(2, 3)); add("k", "b", pick(4, 6), pick(6, 7));
      // Active defensive pieces create counterplay instead of a bare king.
      add("r", "b", pick(0, 3), pick(5, 7));
      if (topicId !== "black-queen") add("r", "w", pick(0, 3), pick(1, 3));
      add(topicId === "extra-rook" ? "r" : topicId === "extra-bishop" ? "b" : "q", "w", pick(0, 4), pick(2, 4));
      for (const f of [5, 6, 7]) { add("p", "w", f, pick(3, 4)); add("p", "b", f, pick(5, 6)); }
      if (topicId === "extra-bishop") {
        tokens.splice(tokens.findIndex(t => t.type === "p" && t.color === "w" && t.file === 7), 1);
        add("p", "w", pick(0, 1), 3);
      }
    } else throw new Error("Unknown endgame skill");

    const reflect = random() < .5, black = topicId === "black-queen" || random() < .5;
    const game = new Chess(); game.clear();
    const occupied = new Set<string>(); let collision = false;
    for (const token of tokens) {
      const square = `${"abcdefgh"[reflect ? 7 - token.file : token.file]}${black ? 9 - token.rank : token.rank}` as Square;
      if (occupied.has(square)) { collision = true; break; }
      occupied.add(square);
      game.put({ type: token.type, color: black ? token.color === "w" ? "b" : "w" : token.color }, square);
    }
    if (collision) continue;
    const fen = game.fen().replace(/ [wb] /, black ? " b " : " w ");
    const candidate = new Chess(fen), defender = new Chess(fen.replace(/ [wb] /, black ? " w " : " b "));
    if (candidate.isCheck() || defender.isCheck() || candidate.isGameOver() || candidate.moves().length < 3) continue;
    // Do not offer an immediate promotion or a ready-made piece capture.
    if (candidate.moves({ verbose: true }).some(move => move.promotion || (move.captured && move.captured !== "p"))) continue;
    if (defender.moves({ verbose: true }).some(move => move.captured && move.captured !== "p")) continue;
    return fen;
  }
  throw new Error("Could not construct a challenge position. Please try again.");
}
