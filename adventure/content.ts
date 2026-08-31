import type { AdventureChallenge, AdventureDebugSceneGroup, AdventureFundamentalExercise, AdventureLessonPiece, AdventurePuzzle, AdventureScene, KnowledgeEntry } from "@/adventure/types";

function starPuzzle(
  id: string,
  objective: string,
  concept: string,
  fen: string,
  from: string,
  to: string,
  successMessage: string,
  hint: string,
  expectedResult?: AdventurePuzzle["expectedResult"]
): AdventurePuzzle {
  return { id, objective, concept, fen, expectedMove: { from, to }, successMessage, hint, expectedResult, shinySquares: [to] };
}

function starTrailPuzzle(
  id: string,
  objective: string,
  concept: string,
  fen: string,
  piece: AdventureLessonPiece,
  startSquares: string[],
  starSquares: string[],
  parMoves: number,
  successMessage: string,
  hint: string,
  hintArrows?: Array<{ from: string; to: string }>
): AdventurePuzzle {
  return {
    id,
    objective,
    concept,
    fen,
    successMessage,
    hint,
    shinySquares: starSquares,
    starTrail: { piece, startSquares, starSquares, parMoves, hintArrows }
  };
}

type LessonSupportPiece = { square: string; piece: string };

const lessonPieceSymbols: Record<AdventureLessonPiece, string> = { pawn: "P", rook: "R", bishop: "B", queen: "Q", king: "K", knight: "N" };

const lichessLessonParMoves: Record<string, number> = {
  "pawn-1": 4, "pawn-2": 8, "pawn-3": 4, "pawn-4": 8, "pawn-5": 8, "pawn-6": 7, "pawn-7": 3, "pawn-8": 9,
  "rook-1": 1, "rook-2": 2, "rook-3": 3, "rook-4": 5, "rook-5": 4, "rook-6": 7,
  "bishop-1": 2, "bishop-2": 6, "bishop-3": 6, "bishop-4": 6, "bishop-5": 6, "bishop-6": 11,
  "queen-1": 2, "queen-2": 4, "queen-3": 6, "queen-4": 7, "queen-5": 9,
  "king-1": 3, "king-2": 4, "king-3": 8,
  "knight-1": 2, "knight-2": 8, "knight-3": 5, "knight-4": 9, "knight-5": 6, "knight-6": 9
};

function boardFromFen(fen: string) {
  const [placement] = fen.split(" ");
  const board = new Map<string, string>();
  placement.split("/").forEach((rank, rankIndex) => {
    let fileIndex = 0;
    for (const token of rank) {
      if (/\d/.test(token)) {
        fileIndex += Number(token);
      } else {
        board.set(`${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`, token);
        fileIndex += 1;
      }
    }
  });
  return board;
}

function fenFromBoard(board: Map<string, string>) {
  return Array.from({ length: 8 }, (_, rankIndex) => {
    const rank = 8 - rankIndex;
    let emptySquares = 0;
    let encoded = "";
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const piece = board.get(`${String.fromCharCode(97 + fileIndex)}${rank}`);
      if (!piece) {
        emptySquares += 1;
        continue;
      }
      if (emptySquares) encoded += String(emptySquares);
      emptySquares = 0;
      encoded += piece;
    }
    return `${encoded}${emptySquares || ""}`;
  }).join("/");
}

function squareCoordinates(square: string) {
  return { file: square.charCodeAt(0) - 97, rank: Number(square[1]) - 1 };
}

function isSquareAttacked(board: Map<string, string>, square: string, attacker: "white" | "black") {
  const target = squareCoordinates(square);
  const ownsPiece = (piece: string) => attacker === "white" ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
  const isOnBoard = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 0 && rank < 8;
  const squareAt = (file: number, rank: number) => `${String.fromCharCode(97 + file)}${rank + 1}`;

  for (const [from, piece] of board.entries()) {
    if (!ownsPiece(piece)) continue;
    const origin = squareCoordinates(from);
    const fileDelta = target.file - origin.file;
    const rankDelta = target.rank - origin.rank;
    const role = piece.toLowerCase();
    if (role === "p" && rankDelta === (attacker === "white" ? 1 : -1) && Math.abs(fileDelta) === 1) return true;
    if (role === "n" && ((Math.abs(fileDelta) === 1 && Math.abs(rankDelta) === 2) || (Math.abs(fileDelta) === 2 && Math.abs(rankDelta) === 1))) return true;
    if (role === "k" && Math.max(Math.abs(fileDelta), Math.abs(rankDelta)) === 1) return true;

    const isDiagonal = Math.abs(fileDelta) === Math.abs(rankDelta) && fileDelta !== 0;
    const isStraight = (fileDelta === 0) !== (rankDelta === 0);
    if (!((role === "b" && isDiagonal) || (role === "r" && isStraight) || (role === "q" && (isDiagonal || isStraight)))) continue;
    const fileStep = Math.sign(fileDelta);
    const rankStep = Math.sign(rankDelta);
    let file = origin.file + fileStep;
    let rank = origin.rank + rankStep;
    while (isOnBoard(file, rank)) {
      const currentSquare = squareAt(file, rank);
      if (currentSquare === square) return true;
      if (board.has(currentSquare)) break;
      file += fileStep;
      rank += rankStep;
    }
  }
  return false;
}

/**
 * Lichess's learning boards omit kings. The academy board uses chess.js, so it
 * adds hidden kings and (for pawn captures) invisible enemy placeholders while
 * keeping the learner-facing pieces and star squares identical.
 */
function lessonFen(sourceFen: string, starSquares: string[], supportPieces: LessonSupportPiece[] = []) {
  const board = boardFromFen(sourceFen);
  for (const { square, piece } of supportPieces) board.set(square, piece);

  const preferredKingSquares = ["a1", "h8", "h1", "a8", "a2", "h7", "b1", "g8", "b2", "g7", "a3", "h6"];
  const allSquares = Array.from({ length: 8 }, (_, rank) => Array.from({ length: 8 }, (_, file) => `${String.fromCharCode(97 + file)}${rank + 1}`)).flat();
  const addKing = (piece: "K" | "k") => {
    if ([...board.values()].includes(piece)) return;
    const opponent = piece === "K" ? "black" : "white";
    const opposingKing = piece === "K" ? "k" : "K";
    const square = [...preferredKingSquares, ...allSquares].find((candidate) => {
      if (board.has(candidate) || starSquares.includes(candidate) || isSquareAttacked(board, candidate, opponent)) return false;
      const opponentKingSquare = [...board.entries()].find(([, boardPiece]) => boardPiece === opposingKing)?.[0];
      if (!opponentKingSquare) return true;
      const own = squareCoordinates(candidate);
      const enemy = squareCoordinates(opponentKingSquare);
      return Math.max(Math.abs(own.file - enemy.file), Math.abs(own.rank - enemy.rank)) > 1;
    });
    if (!square) throw new Error("A lesson board needs a safe hidden king square.");
    board.set(square, piece);
  };
  addKing("K");
  addKing("k");
  return `${fenFromBoard(board)} w - - 0 1`;
}

function squaresWithPiece(fen: string, piece: string) {
  return [...boardFromFen(fen).entries()].filter(([, token]) => token === piece).map(([square]) => square);
}

function lichessPiecePuzzle(
  id: string,
  objective: string,
  concept: string,
  sourceFen: string,
  piece: AdventureLessonPiece,
  starSquares: string[],
  hint: string,
  hintArrows?: Array<{ from: string; to: string }>,
  supportPieces?: LessonSupportPiece[]
) {
  // In a pawn lesson every star really is an enemy piece. This makes a
  // diagonal star move a genuine chess capture, rather than relying on an
  // easy-to-miss hand-written support piece. Pawns cannot exist on the first
  // or eighth rank, so those promotion-rank targets use a hidden knight.
  const pawnStarSupport = piece === "pawn"
    ? starSquares.map((square) => ({ square, piece: square[1] === "1" || square[1] === "8" ? "n" : "p" }))
    : [];
  const fen = lessonFen(sourceFen, starSquares, [...pawnStarSupport, ...(supportPieces ?? [])]);
  return starTrailPuzzle(
    id,
    objective,
    concept,
    fen,
    piece,
    squaresWithPiece(fen, lessonPieceSymbols[piece]),
    starSquares,
    lichessLessonParMoves[id],
    `The stars flare as ${piece === "pawn" ? "Pip" : "the wooden piece"} finds another way forward. Lem marks the page with a satisfied little snap.`,
    hint,
    hintArrows
  );
}

type FundamentalPuzzleOptions = {
  expectedMove?: AdventurePuzzle["expectedMove"];
  hintArrows?: Array<{ from: string; to: string; color?: string }>;
};

/**
 * The public Lichess Fundamentals positions do not always contain both kings.
 * Add only the missing king(s) off-stage so chess.js can enforce legal moves,
 * and limit selection to the visible white pieces from the original board.
 */
function lichessFundamentalPuzzle(
  id: string,
  objective: string,
  concept: string,
  sourceFen: string,
  goal: AdventureFundamentalExercise["goal"],
  parMoves: number,
  successMessage: string,
  hint: string,
  options: FundamentalPuzzleOptions = {}
): AdventurePuzzle {
  const sourceBoard = boardFromFen(sourceFen);
  const sourcePieces = [...sourceBoard.values()];
  const hiddenPieces = [
    ...(sourcePieces.includes("K") ? [] : ["wK"]),
    ...(sourcePieces.includes("k") ? [] : ["bK"])
  ];
  const movableSquares = [...sourceBoard.entries()]
    .filter(([, piece]) => piece === piece.toUpperCase())
    .map(([square]) => square);
  const opponentSquares = [...sourceBoard.entries()]
    .filter(([, piece]) => piece === piece.toLowerCase())
    .map(([square]) => square);

  return {
    id,
    objective,
    concept,
    fen: lessonFen(sourceFen, []),
    sourceFen,
    successMessage,
    hint,
    fundamental: { goal, parMoves },
    expectedMove: options.expectedMove,
    hintArrows: options.hintArrows,
    hiddenPieces,
    movableSquares,
    opponentSquares
  };
}

export const ADVENTURE_CHALLENGES: Record<string, AdventureChallenge> = {
  "learn-pawn": {
    id: "learn-pawn",
    title: "Pawn Training",
    chapterLabel: "Pip Awakens · Lichess Pawn course",
    knowledgeIds: ["pawn"],
    reward: { coins: 5 },
    completionFlags: ["learned_pawn_movement", "pawns_restored"],
    puzzles: [
      lichessPiecePuzzle("pawn-1", "Help Pip reach the far rank, then collect the star.", "Pawns move forward. When Pip reaches the final rank, he may become a queen, rook, bishop, or knight.", "8/8/8/P7/8/8/8/8 w - -", "pawn", ["f3"], "March Pip to the far rank first. His new job will help him reach the star.", [{ from: "a5", to: "a6" }, { from: "a6", to: "a7" }, { from: "a7", to: "a8" }]),
      lichessPiecePuzzle("pawn-2", "Collect every star after Pip earns a promotion.", "A promoted pawn becomes the piece you choose. A queen is powerful, but it is never automatic.", "8/8/8/5P2/8/8/8/8 w - -", "pawn", ["b6", "c4", "d7", "e5", "a8"], "Pip starts on f5. Reach the final rank, then use your new piece's moves."),
      lichessPiecePuzzle("pawn-3", "Use Pip's forward move and diagonal capture.", "Pawns move forward, but capture one square diagonally forward. Stars stand for enemy pieces.", "8/8/8/8/8/4P3/8/8 w - -", "pawn", ["c6", "d5", "d7"], "Move up from e3, capture the diagonal star, then continue forward.", [{ from: "e3", to: "e4" }, { from: "e4", to: "d5" }], [{ square: "d5", piece: "p" }, { square: "c6", piece: "p" }, { square: "d7", piece: "p" }]),
      lichessPiecePuzzle("pawn-4", "Collect Pip's longer mixed trail.", "A pawn can keep moving forward after a capture. Promotion opens up a whole new set of moves.", "8/8/8/8/8/1P6/8/8 w - -", "pawn", ["b4", "b6", "c4", "c6", "c7", "d6"], "Capture c4, march to c5, then choose either diagonal star to keep Pip's route alive.", undefined, [{ square: "c4", piece: "p" }, { square: "b6", piece: "p" }, { square: "c7", piece: "p" }, { square: "d6", piece: "p" }]),
      lichessPiecePuzzle("pawn-5", "Guide Pip through a zigzag of captures and forward steps.", "Pawns capture diagonally, travel forward, and choose a new identity only at the final rank.", "8/8/8/8/8/3P4/8/8 w - -", "pawn", ["c4", "b5", "b6", "d5", "d7", "e6", "c8"], "From c4, Pip may capture either nearby diagonal star. The d5 path can continue with another capture on e6 before promoting.", undefined, [{ square: "c4", piece: "p" }, { square: "b5", piece: "p" }, { square: "c6", piece: "p" }, { square: "c8", piece: "n" }, { square: "d5", piece: "p" }, { square: "d7", piece: "p" }, { square: "e6", piece: "p" }]),
      lichessPiecePuzzle("pawn-6", "Use every member of Pip's pawn committee.", "More than one pawn may collect stars. Choose the pawn with the best legal move.", "8/8/8/8/8/P1PP3P/8/8 w - -", "pawn", ["b5", "c5", "d4", "e5", "g4"], "Several pawns can help. A pawn on h3 can capture the star on g4.", undefined, [{ square: "b5", piece: "p" }, { square: "e4", piece: "p" }, { square: "e5", piece: "p" }, { square: "g4", piece: "p" }]),
      lichessPiecePuzzle("pawn-7", "Use Pip's two-square first move.", "A pawn on its starting rank may move two clear squares forward on its very first move.", "8/8/8/8/8/8/4P3/8 w - -", "pawn", ["d6"], "From e2, Pip may leap two squares first; then capture diagonally to make Pip's promotion route.", [{ from: "e2", to: "e4" }], [{ square: "d5", piece: "p" }, { square: "c6", piece: "p" }]),
      lichessPiecePuzzle("pawn-8", "Send the whole pawn squad through the final trail.", "Each pawn follows the same rule: forward to move, diagonal to capture. Pick the best teammate for each star.", "8/8/8/8/8/8/2P1PP2/8 w - -", "pawn", ["c5", "d5", "e5", "f5", "d3", "e4"], "Start with the diagonal captures on d3, e4, and d5. Once Pip promotes, the remaining stars are his to collect.", undefined, [{ square: "d3", piece: "p" }, { square: "e4", piece: "p" }, { square: "d5", piece: "p" }, { square: "c6", piece: "p" }])
    ]
  },
  "learn-rook": {
    id: "learn-rook", title: "Restore Roger & Ricky", chapterLabel: "Dad's wooden army", knowledgeIds: ["rook"], puzzles: [
      lichessPiecePuzzle("rook-1", "Send Roger along his first file.", "Rooks move any number of clear squares in a straight line: up, down, left, or right.", "8/8/8/8/8/8/4R3/8 w - -", "rook", ["e7"], "The first star is directly above Roger.", [{ from: "e2", to: "e7" }]),
      lichessPiecePuzzle("rook-2", "Turn Roger once to collect both stars.", "A rook may change direction between moves, but it never bends during one move.", "8/2R5/8/8/8/8/8/8 w - -", "rook", ["c5", "g5"], "Move straight down, then straight across.", [{ from: "c7", to: "c5" }, { from: "c5", to: "g5" }]),
      lichessPiecePuzzle("rook-3", "Find the shortest straight-line route.", "Before moving, look for a star on the same rank or file.", "8/8/8/8/3R4/8/8/8 w - -", "rook", ["a4", "g3", "g4"], "A rook on d4 can reach a4 in one straight move."),
      lichessPiecePuzzle("rook-4", "Sweep the far side of the board.", "Rooks are long-range pieces when their ranks and files are clear.", "7R/8/8/8/8/8/8/8 w - -", "rook", ["f8", "g1", "g7", "g8", "h7"], "Start from h8 and look for stars sharing a rank or file."),
      lichessPiecePuzzle("rook-5", "Let Roger and Ricky work together.", "Either rook may move. Two rooks cover much more of the board.", "8/1R6/8/8/3R4/8/8/8 w - -", "rook", ["a4", "g3", "g7", "h4"], "You have two straight-line teammates this time."),
      lichessPiecePuzzle("rook-6", "Clear the final two-rook patrol.", "Use the rook that can reach each star in the fewest straight moves.", "8/8/8/8/8/5R2/8/R7 w - -", "rook", ["b7", "d1", "d5", "f2", "f7", "g4", "g7"], "Both rooks may collect stars. Plan their lines together.")
    ]
  },
  "learn-bishop": {
    id: "learn-bishop", title: "Restore Kate & Hanna", chapterLabel: "Dad's wooden army", knowledgeIds: ["bishop"], puzzles: [
      lichessPiecePuzzle("bishop-1", "Guide Kate through her first diagonal route.", "Bishops move any number of clear squares diagonally, never straight across a rank or file.", "8/8/8/8/8/5B2/8/8 w - -", "bishop", ["d5", "g8"], "Follow the diagonal up-left, then up-right.", [{ from: "f3", to: "d5" }, { from: "d5", to: "g8" }]),
      lichessPiecePuzzle("bishop-2", "Collect every star on Kate's color.", "A bishop stays on one square color for the entire game.", "8/8/8/8/8/1B6/8/8 w - -", "bishop", ["a2", "b1", "b5", "d1", "d3", "e2"], "Every star lies on Kate's diagonal color."),
      lichessPiecePuzzle("bishop-3", "Trace Kate's next web of diagonals.", "After landing, a bishop may choose any new clear diagonal.", "8/8/8/8/3B4/8/8/8 w - -", "bishop", ["a1", "b6", "c1", "e3", "g7", "h6"], "Count the same number of squares sideways and up or down."),
      lichessPiecePuzzle("bishop-4", "Find another diagonal-only route.", "If a star is not on a diagonal, this bishop cannot reach it.", "8/8/8/8/2B5/8/8/8 w - -", "bishop", ["a4", "b1", "b3", "c2", "d3", "e2"], "Start with a nearby diagonal from c4."),
      lichessPiecePuzzle("bishop-5", "Use both bishops to cover both colors.", "One bishop cannot change square color. Kate and Hanna together can reach both.", "8/8/8/8/8/8/8/2B2B2 w - -", "bishop", ["d3", "d4", "d5", "e3", "e4", "e5"], "Choose the bishop whose diagonal reaches each star."),
      lichessPiecePuzzle("bishop-6", "Finish the two-bishop star field.", "Two bishops work as a team by controlling different diagonals and colors.", "8/3B4/8/8/8/2B5/8/8 w - -", "bishop", ["a3", "c2", "e7", "f5", "f6", "g8", "h4", "h7"], "Use both bishops when one color alone will not do.")
    ]
  },
  "learn-queen": {
    id: "learn-queen", title: "Restore Marilou", chapterLabel: "Dad's wooden army", knowledgeIds: ["queen"], puzzles: [
      lichessPiecePuzzle("queen-1", "Show Marilou's rook-and-bishop moves.", "The queen moves like a rook and a bishop combined: straight lines and diagonals.", "8/8/8/8/8/8/4Q3/8 w - -", "queen", ["e5", "b8"], "Go straight from e2 to e5, then follow a diagonal to b8.", [{ from: "e2", to: "e5" }, { from: "e5", to: "b8" }]),
      lichessPiecePuzzle("queen-2", "Sweep the next mixed star field.", "Before each move, decide whether Marilou needs a straight line or a diagonal.", "8/8/8/8/3Q4/8/8/8 w - -", "queen", ["a3", "f2", "f8", "h3"], "Marilou can use either kind of line on every move."),
      lichessPiecePuzzle("queen-3", "Collect stars spread across the board.", "A queen has both rook and bishop movement, but may not jump over pieces.", "8/8/8/8/2Q5/8/8/8 w - -", "queen", ["a3", "d6", "f1", "f8", "g3", "h6"], "Look for the shortest straight or diagonal connection each time."),
      lichessPiecePuzzle("queen-4", "Find Marilou's long-range route.", "The queen can travel across the whole board when a line is clear.", "8/6Q1/8/8/8/8/8/8 w - -", "queen", ["a2", "b5", "d3", "g1", "g8", "h2", "h5"], "Stars can be reached from a rank, file, or diagonal."),
      lichessPiecePuzzle("queen-5", "Finish the queen's final star map.", "Marilou combines the rook's straight lines and the bishop's diagonals in every turn.", "8/8/8/8/8/8/8/4Q3 w - -", "queen", ["a6", "d1", "f2", "f6", "g6", "g8", "h1", "h4"], "Pause before each move: straight line or diagonal?")
    ]
  },
  "learn-king": {
    id: "learn-king", title: "Restore Luis", chapterLabel: "Dad's wooden army", knowledgeIds: ["king"], puzzles: [
      lichessPiecePuzzle("king-1", "Guide Luis one careful step at a time.", "A king moves exactly one square in any direction.", "8/8/8/8/8/3K4/8/8 w - -", "king", ["e6"], "From d3, take three one-square steps to e6.", [{ from: "d3", to: "d4" }, { from: "d4", to: "d5" }, { from: "d5", to: "e6" }]),
      lichessPiecePuzzle("king-2", "Collect Luis's small crown-shaped trail.", "Kings never leap or slide: every move is one square.", "8/8/8/8/8/8/8/4K3 w - -", "king", ["c2", "d3", "e2", "e3"], "Each glowing square must be next to Luis."),
      lichessPiecePuzzle("king-3", "Finish Luis's long royal walk.", "Take the route one square at a time, even when the star is far away.", "8/8/8/4K3/8/8/8/8 w - -", "king", ["b5", "c5", "d6", "e3", "f3", "g4"], "Luis only needs to look one square away after each move.")
    ]
  },
  "learn-knight": {
    id: "learn-knight", title: "Restore Kevin & Kai", chapterLabel: "Dad's wooden army", knowledgeIds: ["knight"], puzzles: [
      lichessPiecePuzzle("knight-1", "Make Kevin's first L-shaped route.", "Knights move two squares one way and one square sideways. They can jump over pieces.", "8/8/8/8/4N3/8/8/8 w - -", "knight", ["c5", "d7"], "From e4, jump to c5, then make another L to d7.", [{ from: "e4", to: "c5" }, { from: "c5", to: "d7" }]),
      lichessPiecePuzzle("knight-2", "Collect Kevin's longer jumping trail.", "A knight never slides along the board; it lands directly on the end of its L.", "8/8/8/8/8/8/8/1N6 w - -", "knight", ["c3", "d4", "e2", "f3", "f7", "g5", "h8"], "Count two in one direction, then one sideways for every jump."),
      lichessPiecePuzzle("knight-3", "Find a different set of L-shaped jumps.", "A knight can turn its L in eight different directions.", "8/2N5/8/8/8/8/8/8 w - -", "knight", ["b6", "d5", "d7", "e6", "f4"], "Kevin begins on c7. Each destination must be an L away."),
      lichessPiecePuzzle("knight-4", "Show how Kevin jumps over obstacles.", "Knights can jump over pieces, unlike every sliding piece.", "8/8/8/8/5N2/8/8/8 w - -", "knight", ["e3", "e4", "e5", "f3", "f5", "g3", "g4", "g5"], "The surrounding stars do not block Kevin's L-shaped jumps."),
      lichessPiecePuzzle("knight-5", "Complete Kevin's next jumping field.", "A knight's destination is always two-and-one, never a straight line or diagonal.", "8/8/8/8/8/3N4/8/8 w - -", "knight", ["c3", "e2", "e4", "f2", "f4", "g6"], "Start from d3 and keep checking the two-and-one pattern."),
      lichessPiecePuzzle("knight-6", "Finish Kevin and Kai's full star field.", "A knight's strange-looking move becomes easier when you count it carefully.", "8/2N5/8/8/8/8/8/8 w - -", "knight", ["b4", "b5", "c6", "c8", "d4", "d5", "e3", "e7", "f5"], "There is more than one route. Every legal L-shaped jump counts.")
    ]
  },
  "rookus-defend": {
    id: "rookus-defend", title: "Rookus: Hold the Line", chapterLabel: "First underling encounter", knowledgeIds: ["attack-defense"], puzzles: [
      starPuzzle("defend-pip", "Defend Pip on g2 with your rook.", "A defended piece has a teammate ready to protect it.", "4k1r1/8/8/8/8/8/6P1/4K2R w - - 0 1", "h1", "g1", "Roger covers Pip. Rookus' giant rook is suddenly much less impressive.", "Pip needs a teammate. Can Roger move beside him on the g-file?"),
      starPuzzle("defend-kate", "Defend Kate with Roger before Rookus can grab her.", "Protection is a chess superpower: make sure an attacked teammate has a defender.", "4k1r1/8/8/8/8/8/6B1/4K2R w - - 0 1", "h1", "g1", "Roger guards Kate, who calls this 'an entirely expected rescue.'", "Move Roger to g1. From there he protects Kate on g2.")
    ]
  },
  "rookus-attack": {
    id: "rookus-attack", title: "Rookus: Take It Back", chapterLabel: "First underling encounter", knowledgeIds: ["attack-defense"], reward: { coins: 8, item: "hint-charm", itemAmount: 1 }, puzzles: [
      starPuzzle("attack-rook", "Capture the loose pawn with Roger.", "Look for enemy pieces that are not protected.", "4k3/p7/8/8/8/8/8/R3K3 w - - 0 1", "a1", "a7", "Roger takes the coin-snatching pawn. Rookus calls this 'an extremely normal business loss.'", "The pawn is alone on the a-file. A rook can travel the whole clear file to capture it."),
      starPuzzle("attack-bishop", "Use Kate's diagonal attack to capture Rookus' star-snatcher.", "A piece attacks the squares it could capture. Look along each move line.", "4k3/8/8/6p1/8/8/8/2B1K3 w - - 0 1", "c1", "g5", "Kate retrieves the shiny loot. Rookus attempts to invoice the diagonal.", "Kate can reach g5 on one clear diagonal from c1.")
    ]
  },
  "castler-check": {
    id: "castler-check", title: "Castler: A Proper Check", chapterLabel: "Second underling encounter", knowledgeIds: ["check"], puzzles: [
      starPuzzle("check-rook", "Give Castler's king a check with Roger.", "Check means the enemy king is under attack and must respond.", "4k3/8/8/8/8/8/8/4R1K1 w - - 0 1", "e1", "e7", "Check! Castler's grin wobbles for exactly half a second.", "Put the rook on the same file as the king, with no pieces between them.", "check"),
      starPuzzle("check-bishop", "Find Kate's diagonal check.", "A check can come from any piece that attacks the king.", "8/7k/8/8/8/8/2B5/4K3 w - - 0 1", "c2", "g6", "Castler squints at the diagonal. It was there the whole time, which seems rude.", "Move the bishop to g6. Its diagonal will point at the king on h7.", "check"),
      starPuzzle("check-knight", "Let Kevin hop in with a checking fork-shaped leap.", "Knights check from their L-shaped attack squares, even when their path looks impossible.", "4k3/8/8/7N/8/8/8/4K3 w - - 0 1", "h5", "f6", "Kevin checks the king from an angle nobody saw coming. Kevin included.", "A knight on f6 attacks e8. Make the L from h5.", "check")
    ]
  },
  "castler-castle": {
    id: "castler-castle", title: "Castler: The Two-Piece Move", chapterLabel: "Second underling encounter", knowledgeIds: ["castling"], puzzles: [
      starPuzzle("castle-kingside", "Castle Luis toward Roger's glowing star.", "Castling moves the king two squares toward a rook, then the rook jumps over.", "4k3/8/8/8/8/8/8/4K2R w K - 0 1", "e1", "g1", "Luis castles safely, and Castler looks personally offended by the rule he was just explaining.", "Click or drag Luis two squares toward Roger. The rook will move automatically."),
      starPuzzle("castle-queenside", "Castle Luis toward Ricky on the other side.", "You can castle with either rook when the path is clear and both pieces are unmoved.", "4k3/8/8/8/8/8/8/R3K3 w Q - 0 1", "e1", "c1", "Ricky hops over with a flourish. Castler did not mention there were two versions.", "Move Luis two squares toward the rook on a1. He lands on c1."),
      starPuzzle("castle-out-of-check", "The castle is blocked: move Luis out of check instead.", "You cannot castle out of check. First make a legal king move to safety.", "k3r3/8/8/8/8/8/8/4K2R w K - 0 1", "e1", "f2", "Lem snaps the book shut. 'No castle while the king is in check. Rules are terribly inconvenient that way.'", "The black rook attacks e1. Luis must escape one square before any castling can happen.")
    ]
  },
  "nate-mate": {
    id: "nate-mate", title: "Stale Nate: Finish the Net", chapterLabel: "Third underling encounter", knowledgeIds: ["checkmate"], puzzles: [
      starPuzzle("mate-g7", "Find checkmate in one with Marilou.", "Checkmate is check with no legal escape. That wins the game.", "7k/8/5KQ1/8/8/8/8/8 w - - 0 1", "g6", "g7", "Checkmate! Nate's trick smile gets stuck halfway through a trick.", "The queen can give check from g7, and Luis protects that square.", "checkmate"),
      starPuzzle("mate-b7", "Close another mate-in-one net.", "A good checkmate covers the king's escape squares and keeps the checking piece safe.", "k7/2Q5/2K5/8/8/8/8/8 w - - 0 1", "c7", "b7", "Nate counts every escape twice. There are still none.", "Put Marilou on b7. Luis on c6 protects the queen and the nearby squares.", "checkmate"),
      starPuzzle("mate-g7-side", "Finish a final mate-in-one from the side.", "Before calling it mate, check: is the king attacked, can it run, and can it capture the attacker?", "7k/8/5K1Q/8/8/8/8/8 w - - 0 1", "h6", "g7", "The net closes. Lem makes a tiny bookmark-shaped mic drop.", "Marilou goes to g7. Luis protects her, and the black king has no square left.", "checkmate")
    ]
  },
  "nate-stalemate": {
    id: "nate-stalemate", title: "Stale Nate: The Sneaky Draw", chapterLabel: "Third underling encounter", knowledgeIds: ["stalemate"], puzzles: [
      starPuzzle("stalemate-b6", "Create Nate's forced stalemate.", "Stalemate is a draw: the king is not in check but has no legal moves.", "k7/2Q5/2K5/8/8/8/8/8 w - - 0 1", "c7", "b6", "Stalemate. Nate cackles, then realizes you learned the trick instead of falling for it.", "Trap the black king without checking it. Look at the square one diagonal down from c7.", "stalemate"),
      starPuzzle("stalemate-g6", "Set a second stalemate trap without checking the king.", "A stalemate is not a win: the enemy king must be safe but unable to move.", "7k/5K2/5Q2/8/8/8/8/8 w - - 0 1", "f6", "g6", "Nate declares a draw so loudly that the pigeons leave the square.", "Move the queen to g6. It removes the king's moves without attacking h8.", "stalemate"),
      starPuzzle("stalemate-g6-from-f7", "Spot the same draw idea from a new position.", "Checkmate needs check. Without check and without a move, the result is stalemate.", "7k/5Q2/5K2/8/8/8/8/8 w - - 0 1", "f7", "g6", "Nate tips his hat. 'A draw is still not a loss.' Lem: 'No one asked.'", "The target g6 fences in h8 but does not check it.", "stalemate")
    ]
  },
  "fundamentals-capture": {
    id: "fundamentals-capture", title: "Rookus: Capture", chapterLabel: "Fundamentals · 1 of 6", knowledgeIds: ["capture"], puzzles: [
      lichessFundamentalPuzzle("capture-1", "Capture every black piece.", "Capturing takes an enemy piece off the board. Choose a route that reaches them all.", "8/2p2p2/8/8/8/2R5/8/8 w - -", "capture-all", 2, "Rookus' first guards clatter into the fountain. The shiny coins were not theirs after all.", "Roger can collect both guards along the c-file, then the seventh rank.", { hintArrows: [{ from: "c3", to: "c7" }, { from: "c7", to: "f7" }] }),
      lichessFundamentalPuzzle("capture-2", "Capture every black piece without losing yours.", "A capture can be bad if the enemy can take you straight back. Check who protects each piece.", "8/2r2p2/8/8/5Q2/8/8/8 w - -", "capture-all", 2, "Marilou recovers the second patrol's loot with one royal sweep.", "One black piece is bait. Find the safe capture first.", { hintArrows: [{ from: "f4", to: "c7" }, { from: "f4", to: "f7", color: "#fb7185" }, { from: "c7", to: "f7" }] }),
      lichessFundamentalPuzzle("capture-3", "Clear the black pieces with Kate.", "Bishops capture only along clear diagonals, so look for a route before you begin.", "8/5r2/8/1r3p2/8/3B4/8/8 w - -", "capture-all", 5, "Kate's diagonal patrol returns every last piece to Dad's box.", "Trace the diagonal paths that let Kate reach every black piece."),
      lichessFundamentalPuzzle("capture-4", "Clear the black pieces with Marilou.", "Queens can capture in straight lines and diagonals, but still cannot jump over a piece.", "8/5b2/5p2/3n2p1/8/6Q1/8/8 w - -", "capture-all", 7, "Marilou finishes the cleanup. Rookus calls this a very unfair cleaning policy.", "Plan a queen route that reaches every black piece."),
      lichessFundamentalPuzzle("capture-5", "Clear the black pieces with Kevin.", "Knights capture by landing on an L-shaped destination, even when pieces sit between them.", "8/3b4/2p2q2/8/3p1N2/8/8/8 w - -", "capture-all", 6, "Kevin collects the last guard by taking the scenic route. The scenic route involves jumping.", "Count two squares one way and one sideways for each capture.")
    ]
  },
  "fundamentals-protection": {
    id: "fundamentals-protection", title: "Rookus: Protection", chapterLabel: "Fundamentals · 2 of 6", knowledgeIds: ["protection"], puzzles: [
      lichessFundamentalPuzzle("protection-1", "Move an attacked piece to safety.", "When an enemy attacks a piece, you can often save it by moving it or giving it a defender.", "8/8/8/4bb2/8/8/P2P4/R2K4 w - -", "safe-move", 1, "Rookus' bishops swing at empty air. A fine start.", "The rook is in danger. Find a safe square for it.", { hintArrows: [{ from: "e5", to: "a1", color: "#fb7185" }, { from: "a1", to: "c1" }] }),
      lichessFundamentalPuzzle("protection-2", "Rescue the knight from the queen.", "A piece is safe when it cannot simply be taken for free.", "8/8/2q2N2/8/8/8/8/8 w - -", "safe-move", 1, "Kevin leaps clear just before the queen's cape lands on him.", "Find a knight square the queen cannot take."),
      lichessFundamentalPuzzle("protection-3", "Protect the knight instead of running.", "Sometimes a teammate can guard an attacked piece, making the capture unsafe for the enemy.", "8/N2q4/8/8/8/8/6R1/8 w - -", "safe-move", 1, "Roger covers Kevin. Rookus looks disappointed that teamwork exists.", "Move Roger so Kevin is protected.", { expectedMove: { from: "g2", to: "a2" } }),
      lichessFundamentalPuzzle("protection-4", "Keep the bishop safe from the queen.", "Look for an enemy attack before you move, then answer it by escaping or defending.", "8/8/1Bq5/8/2P5/8/8/8 w - -", "safe-move", 1, "Kate stays on the board, which she considers a reasonable expectation.", "The queen attacks along long lines. Choose a safe bishop move."),
      lichessFundamentalPuzzle("protection-5", "Save the threatened team.", "A safe move can protect one teammate while keeping another from being captured.", "1r6/8/5b2/8/8/5N2/P2P4/R1B5 w - -", "safe-move", 1, "The wooden army holds its ground. Rookus' invoice has fewer pieces on it now.", "Look for the black bishop's attack, then make a move that keeps the team safe.", { hintArrows: [{ from: "f6", to: "a1", color: "#fb7185" }, { from: "d2", to: "d4" }] }),
      lichessFundamentalPuzzle("protection-6", "Keep every loose piece safe.", "Before ending your turn, check whether the enemy can take an undefended teammate.", "8/1b6/8/8/8/3P2P1/5NRP/r7 w - -", "safe-move", 1, "Nobody gets picked off. Lem calls that a successful group project.", "Find the move that leaves no free capture for Black."),
      lichessFundamentalPuzzle("protection-7", "Keep every loose piece safe.", "Several pieces can be attacked at once. Look for one move that solves the biggest problem.", "rr6/3q4/4n3/4P1B1/7P/P7/1B1N1PP1/R5K1 w - -", "safe-move", 1, "The whole squad survives the ambush. Rookus is starting to take this personally.", "Find the move that leaves no undefended white piece."),
      lichessFundamentalPuzzle("protection-8", "Keep every loose piece safe.", "Defending is active chess: identify the enemy's threat and stop it before it happens.", "8/3q4/8/1N3R2/8/2PB4/8/8 w - -", "safe-move", 1, "Rookus runs out of easy targets. A tragic day for easy targets.", "Find the move that prevents Black from taking a loose piece.")
    ]
  },
  "fundamentals-combat": {
    id: "fundamentals-combat", title: "Rookus: Combat", chapterLabel: "Fundamentals · 3 of 6", knowledgeIds: ["combat"], reward: { coins: 8, item: "hint-charm", itemAmount: 1 }, puzzles: [
      lichessFundamentalPuzzle("combat-1", "Capture the black rook without losing your pieces.", "Attack and defense work together: capture what is loose and protect what might be taken back.", "8/8/8/8/P2r4/6B1/8/8 w - -", "capture-all", 3, "Rookus loses his rook and most of his argument.", "Use the pawn and bishop together before Kate captures the rook.", { hintArrows: [{ from: "a4", to: "a5" }, { from: "g3", to: "f2" }, { from: "f2", to: "d4" }, { from: "d4", to: "a4", color: "#facc15" }] }),
      lichessFundamentalPuzzle("combat-2", "Capture both black pieces and keep yours safe.", "Combat puzzles ask you to capture while noticing what the enemy can capture in return.", "2r5/8/3b4/2P5/8/1P6/2B5/8 w - -", "capture-all", 4, "The second patrol folds. Rookus pretends this was part of the plan.", "Plan a route that takes both black pieces safely."),
      lichessFundamentalPuzzle("combat-3", "Capture both black pieces and keep yours safe.", "Pawns and queens can work together when each one covers a different line.", "1r6/8/5n2/3P4/4P1P1/1Q6/8/8 w - -", "capture-all", 4, "Pip's committee wins a very small, very serious battle.", "Use the white team to collect both black pieces."),
      lichessFundamentalPuzzle("combat-4", "Capture both black pieces and keep yours safe.", "A knight can win a fight by jumping where sliding pieces cannot go.", "2r5/8/3N4/5b2/8/8/PPP5/8 w - -", "capture-all", 4, "Kevin leaps into the rescue. Nobody saw that coming, including Kevin.", "Find a safe route to both black pieces."),
      lichessFundamentalPuzzle("combat-5", "Capture both black pieces and keep yours safe.", "When the board is crowded, take your time and check every enemy reply.", "8/6q1/8/4P1P1/8/4B3/r2P2N1/8 w - -", "capture-all", 8, "Rookus retreats from the fountain, grumbling about unfairly competent children.", "Both black pieces can be taken. Keep every white piece protected.")
    ]
  },
  "fundamentals-check": {
    id: "fundamentals-check", title: "Castler: Check in One", chapterLabel: "Fundamentals · 4 of 6", knowledgeIds: ["check"], puzzles: [
      lichessFundamentalPuzzle("check-1", "Give the black king check in one move.", "Check means your piece attacks the enemy king. The other player must answer it.", "4k3/8/2b5/8/8/8/8/R7 w - -", "check", 1, "Check! Castler's cape stops swishing for one whole second.", "Put Roger on a clear line to the black king.", { hintArrows: [{ from: "a1", to: "e1" }] }),
      lichessFundamentalPuzzle("check-2", "Give the black king check in one move.", "Queens can check along ranks, files, and diagonals.", "8/8/4k3/3n4/8/1Q6/8/8 w - -", "check", 1, "Marilou points directly at the king. Castler understands the situation at last.", "Find a queen move that attacks the king."),
      lichessFundamentalPuzzle("check-3", "Give the black king check in one move.", "A bishop gives check when its diagonal reaches the enemy king.", "3qk3/1pp5/3p4/4p3/8/3B4/6r1/8 w - -", "check", 1, "Kate finds the diagonal. The black king is officially having a problem.", "Look for a clear diagonal to the king."),
      lichessFundamentalPuzzle("check-4", "Give the black king check in one move.", "Knights check from their L-shaped destinations.", "2r2q2/2n5/8/4k3/8/2N1P3/3P2B1/8 w - -", "check", 1, "Kevin lands with a clack: check.", "A knight can attack the king without sharing a line."),
      lichessFundamentalPuzzle("check-5", "Give the black king check in one move.", "Every piece has its own way of attacking the king. Scan all of them.", "8/2b1q2n/1ppk4/2N5/8/8/8/8 w - -", "check", 1, "Castler's lecture gets interrupted by a very real check.", "Find the white piece that can attack the king now."),
      lichessFundamentalPuzzle("check-6", "Give the black king check in one move.", "When several pieces are active, look for the checking line that cannot be blocked.", "6R1/1k3r2/8/4Q3/8/2n5/8/8 w - -", "check", 1, "Check. Lem marks the page with a smug little flourish.", "Find a move that attacks the king immediately."),
      lichessFundamentalPuzzle("check-7", "Give the black king check in one move.", "A checking move can come from any white piece that attacks the king.", "7r/4k3/8/3n4/4N3/8/2R5/4Q3 w - -", "check", 1, "Castler is out of clever words. He is not out of cape, unfortunately.", "Look at every white attack on e7.")
    ]
  },
  "fundamentals-out-of-check": {
    id: "fundamentals-out-of-check", title: "Castler: Out of Check", chapterLabel: "Fundamentals · 5 of 6", knowledgeIds: ["out-of-check"], puzzles: [
      lichessFundamentalPuzzle("out-of-check-1", "Get Luis out of check.", "When your king is attacked, you must escape, block the attack, or capture the attacker.", "8/8/8/4q3/8/8/8/4K3 w - -", "escape-check", 1, "Luis steps out of danger. Castler's lecture about rules becomes suddenly useful.", "The queen attacks down the e-file. Move Luis to safety.", { hintArrows: [{ from: "e5", to: "e1", color: "#fb7185" }, { from: "e1", to: "f1" }] }),
      lichessFundamentalPuzzle("out-of-check-2", "Get Luis out of check.", "Kings cannot move into danger, so choose an escape square the enemy does not attack.", "8/2n5/5b2/8/2K5/8/2q5/8 w - -", "escape-check", 1, "Luis escapes the trap. Lem calls that the entire point of a king.", "Find a legal king escape."),
      lichessFundamentalPuzzle("out-of-check-3", "Get Luis out of check by blocking.", "A sliding attack can be stopped by placing a piece between the attacker and king.", "8/7r/6r1/8/R7/7K/8/8 w - -", "escape-check", 1, "Roger blocks the attack just in time.", "Luis cannot run, so use a teammate to block the rook."),
      lichessFundamentalPuzzle("out-of-check-4", "Get Luis out of check by capturing.", "Capturing the checking piece is another way to get out of check.", "8/8/8/3b4/8/4N3/KBn5/1R6 w - -", "escape-check", 1, "Kevin removes the problem. Lem approves of concise solutions.", "Can a white piece capture the attacker?"),
      lichessFundamentalPuzzle("out-of-check-5", "Get Luis out of check.", "Knights can give check through a crowded board because they jump.", "4q3/8/8/8/8/5nb1/3PPP2/3QKBNr w - -", "escape-check", 1, "Luis gets safe. Castler stops using the phrase 'obvious rule.'", "Find the one legal response to the check."),
      lichessFundamentalPuzzle("out-of-check-6", "Get Luis out of check.", "When a king is in check, you may escape or block if either move is legal.", "8/8/7p/2q5/5n2/1N1KP2r/3R4/8 w - -", "escape-check", 1, "The wooden army covers Luis while he gets out of danger.", "Look for an escape or a block."),
      lichessFundamentalPuzzle("out-of-check-7", "Get Luis out of check.", "Always answer check first. Every other idea can wait one move.", "8/6b1/8/8/q4P2/2KN4/3P4/8 w - -", "escape-check", 1, "Castler has to admit you know the rule better than he does now.", "Find the legal response that ends the check.")
    ]
  },
  "fundamentals-checkmate": {
    id: "fundamentals-checkmate", title: "Stale Nate: Mate in One", chapterLabel: "Fundamentals · 6 of 6", knowledgeIds: ["checkmate"], puzzles: [
      lichessFundamentalPuzzle("checkmate-1", "Checkmate the black king in one move.", "Checkmate means the king is in check and has no legal escape, block, or capture.", "3qk3/3ppp2/8/8/2B5/5Q2/8/8 w - -", "checkmate", 1, "Checkmate. Nate's clever smile forgets what it was doing.", "Find the checking move that covers every escape square.", { hintArrows: [{ from: "f3", to: "f7" }] }),
      lichessFundamentalPuzzle("checkmate-2", "Checkmate the black king in one move.", "A king can be trapped by its own pieces as well as yours.", "6rk/6pp/7P/6N1/8/8/8/8 w - -", "checkmate", 1, "Checkmate by Kevin! Nate looks around for a rule that says horses cannot be this smug.", "Look for a knight check with no exit."),
      lichessFundamentalPuzzle("checkmate-3", "Checkmate the black king in one move.", "Rooks and queens can build a mating net from far away.", "R7/8/7k/2r5/5n2/8/6Q1/8 w - -", "checkmate", 1, "The net closes. Nate's coin lands on its edge, which feels about right.", "Find the one checking move that ends the game."),
      lichessFundamentalPuzzle("checkmate-4", "Checkmate the black king in one move.", "Teammates cover escape squares while the checking piece delivers the final move.", "2rb4/2k5/5N2/1Q6/8/8/8/8 w - -", "checkmate", 1, "Checkmate. Lem makes a bookmark-shaped mic drop.", "Use the queen and knight together."),
      lichessFundamentalPuzzle("checkmate-5", "Checkmate the black king in one move.", "Sometimes moving a piece reveals a check from a teammate behind it.", "1r2kb2/ppB1p3/2P2p2/2p1N3/B7/8/8/3R4 w - -", "checkmate", 1, "The discovered attack seals it. Nate's tricks were no match for the whole board.", "Look for a move that opens a hidden attack."),
      lichessFundamentalPuzzle("checkmate-6", "Checkmate the black king in one move.", "A diagonal check can be decisive when every escape square is already covered.", "8/pk1N4/n7/b7/6B1/1r3b2/8/1RR5 w - -", "checkmate", 1, "Checkmate. Nate finally runs out of backup plans.", "Find the bishop move that checks the king along a diagonal.", { expectedMove: { from: "g4", to: "f3" } }),
      lichessFundamentalPuzzle("checkmate-7", "Checkmate the black king in one move.", "Before you declare checkmate, ensure the opponent has no way to save their king.", "r1b5/ppp5/2N2kpN/5q2/8/Q7/8/4B3 w - -", "checkmate", 1, "Checkmate. The occupied town hall goes quiet.", "Find the finishing check.")
    ]
  }
};

const RANSACKED_HOUSE_BACKGROUND = {
  background: "house",
  backgroundImage: "/adventure/scenes/ransacked-house.webp",
  backgroundAlt: "Dad's ransacked family home, with his damaged wooden chess army at center, an old leather book at left, and a portrait of Dad and the adventurer at right"
} as const;

const PIP_AWAKENS_BACKGROUND = {
  background: "house",
  backgroundImage: "/adventure/scenes/pip-awakens.webp",
  backgroundAlt: "Pip, a cracked wooden Pawn, stirring with warm light beside Lem and Dad's dormant chess army in the ransacked family home",
  hideArtworkOverlays: true
} as const;

export const STORY_SCENES: Record<string, AdventureScene> = {
  "arrival-intro": {
    id: "arrival-intro",
    title: "Pawnhaven Arrival",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "A sunlit road entering occupied Pawnhaven, with Marge near the inn, a Black King banner overhead, and the family home ahead",
    speaker: "Narrator",
    portrait: "narrator",
    text: "Pawnhaven.",
    next: "arrival-home"
  },
  "arrival-home": {
    id: "arrival-home",
    title: "Pawnhaven Arrival",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "A sunlit road entering occupied Pawnhaven, with Marge near the inn, a Black King banner overhead, and the family home ahead",
    speaker: "Narrator",
    portrait: "narrator",
    text: "Home.",
    next: "arrival-wrong"
  },
  "arrival-wrong": {
    id: "arrival-wrong",
    title: "Pawnhaven Arrival",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "A sunlit road entering occupied Pawnhaven, with Marge near the inn, a Black King banner overhead, and the family home ahead",
    speaker: "Narrator",
    portrait: "narrator",
    text: "But something feels wrong.",
    next: "arrival"
  },
  arrival: {
    id: "arrival",
    title: "Chapter 1 · The Fall of Pawnhaven",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "A sunlit road entering occupied Pawnhaven, with Marge near the inn, a Black King banner overhead, and the family home ahead",
    speaker: "Narrator",
    portrait: "narrator",
    text: "The street is too quiet. Marge watches from the inn, and a dark banner hangs over the road home.",
    hotspots: [
      { id: "marge", label: "Talk to Marge", shortLabel: "Marge", icon: "☕", x: 13.5, y: 33.5, width: 12, height: 57.5, importance: "primary", action: { type: "dialogue", dialogueId: "marge-greeting" }, visibleWhen: [{ kind: "storyFlag", flag: "learned_dad_was_taken", equals: false }] },
      { id: "marge-repeat", label: "Talk to Marge", shortLabel: "Marge", icon: "☕", x: 13.5, y: 33.5, width: 12, height: 57.5, importance: "primary", action: { type: "dialogue", dialogueId: "marge-repeat" }, visibleWhen: [{ kind: "storyFlag", flag: "learned_dad_was_taken" }] },
      { id: "player-home-before", label: "Go home", shortLabel: "Home", icon: "⌂", x: 62.4, y: 25.6, width: 22.2, height: 41.3, importance: "primary", action: { type: "dialogue", dialogueId: "home-called-back" }, visibleWhen: [{ kind: "storyFlag", flag: "learned_dad_was_taken", equals: false }] },
      { id: "player-home", label: "Go home", shortLabel: "Home", icon: "⌂", x: 62.4, y: 25.6, width: 22.2, height: 41.3, importance: "primary", action: { type: "gotoScene", sceneId: "house" }, visibleWhen: [{ kind: "storyFlag", flag: "learned_dad_was_taken" }] },
      { id: "black-king-banner", label: "Inspect the banner", shortLabel: "Banner", icon: "⚑", x: 53.9, y: 6.3, width: 17.2, height: 31.8, action: { type: "inspect", title: "A strange banner", description: "A dark banner hangs over the village. You don't remember seeing it before." }, visibleWhen: [{ kind: "storyFlag", flag: "learned_dad_was_taken", equals: false }] },
      { id: "black-king-banner-known", label: "Inspect the banner", shortLabel: "Banner", icon: "⚑", x: 53.9, y: 6.3, width: 17.2, height: 31.8, action: { type: "inspect", title: "The Black King's banner", description: "The symbol belongs to the Black King. Kingpin's gang hung these throughout Pawnhaven." }, visibleWhen: [{ kind: "storyFlag", flag: "learned_dad_was_taken" }] }
    ]
  },
  "home-called-back": {
    id: "home-called-back",
    title: "Pawnhaven Arrival",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "Marge calls from beside Pawnhaven's inn as the family home waits across the occupied village",
    speaker: "Marge",
    portrait: "marge",
    text: "Wait! I need to tell you what happened before you go in.",
    next: "arrival"
  },
  "marge-greeting": {
    id: "marge-greeting",
    title: "Marge",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "Marge waits beside Pawnhaven's inn while the family house stands across the occupied village",
    speaker: "Marge",
    portrait: "marge",
    text: "You're back!",
    setsFlags: ["met_marge"],
    choices: [
      { label: "What happened?", next: "marge-what-happened" },
      { label: "Where's Dad?", next: "marge-where-dad" },
      { label: "Why are those banners everywhere?", next: "marge-banners" }
    ]
  },
  "marge-what-happened": {
    id: "marge-what-happened",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "Marge explains what happened in occupied Pawnhaven",
    speaker: "Marge",
    portrait: "marge",
    text: "Kingpin's gang came to Pawnhaven. They work for the Black King.",
    next: "marge-occupation"
  },
  "marge-where-dad": {
    id: "marge-where-dad",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "Marge explains what happened in occupied Pawnhaven",
    speaker: "Marge",
    portrait: "marge",
    text: "Your father stood up to Kingpin's gang.",
    next: "marge-occupation"
  },
  "marge-banners": {
    id: "marge-banners",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "Marge explains the Black King's banners over occupied Pawnhaven",
    speaker: "Marge",
    portrait: "marge",
    text: "They carry the Black King's symbol. Kingpin hung them everywhere, as if every cobblestone needed a reminder.",
    next: "marge-occupation"
  },
  "marge-occupation": {
    id: "marge-occupation",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "Marge explains what happened in occupied Pawnhaven",
    speaker: "Marge",
    portrait: "marge",
    text: "Kingpin took control of the village. Your father refused to accept his rule.",
    next: "marge-challenge"
  },
  "marge-challenge": {
    id: "marge-challenge",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "Marge explains what happened in occupied Pawnhaven",
    speaker: "Marge",
    portrait: "marge",
    text: "He challenged Kingpin.",
    next: "marge-lost"
  },
  "marge-lost": {
    id: "marge-lost",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "Marge explains what happened in occupied Pawnhaven",
    speaker: "Marge",
    portrait: "marge",
    text: "He lost.",
    next: "marge-taken"
  },
  "marge-taken": {
    id: "marge-taken",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "Marge explains what happened in occupied Pawnhaven",
    speaker: "Marge",
    portrait: "marge",
    text: "Kingpin's gang took him away. I don't know where.",
    setsFlags: ["learned_dad_was_taken"],
    next: "arrival"
  },
  "marge-repeat": {
    id: "marge-repeat",
    title: "Marge",
    background: "road",
    backgroundImage: "/adventure/scenes/pawnhaven-arrival.webp",
    backgroundAlt: "Marge waits beside Pawnhaven's inn while the family house stands across the occupied village",
    speaker: "Marge",
    portrait: "marge",
    text: "Your house is just down the road. Be careful. Kingpin's people are everywhere.",
    next: "arrival"
  },
  house: {
    id: "house",
    title: "The Ransacked House",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Narrator",
    portrait: "narrator",
    text: "Home should feel safe. Instead, drawers gape open, papers cover the floor, and Dad's wooden chess army lies broken beside an old book.",
    hotspots: [
      { id: "lemicus-book", label: "Pick up the old book", shortLabel: "Old book", icon: "📖", x: 9, y: 67.3, width: 22.6, height: 32.3, importance: "primary", action: { type: "dialogue", dialogueId: "house-lem-pickup" }, visibleWhen: [{ kind: "storyFlag", flag: "met_lem", equals: false }] },
      { id: "lemicus-book-repeat", label: "Talk to Lem", shortLabel: "Lem", icon: "📖", x: 9, y: 67.3, width: 22.6, height: 32.3, importance: "primary", action: { type: "dialogue", dialogueId: "house-lem-repeat" }, visibleWhen: [{ kind: "storyFlag", flag: "met_lem" }, { kind: "storyFlag", flag: "inspected_dads_chess_set", equals: false }] },
      { id: "lemicus-book-ready", label: "Ask Lem about Dad's pieces", shortLabel: "Ask Lem", icon: "📖", x: 9, y: 67.3, width: 22.6, height: 32.3, importance: "primary", action: { type: "dialogue", dialogueId: "house-can-we-fix" }, visibleWhen: [{ kind: "storyFlag", flag: "met_lem" }, { kind: "storyFlag", flag: "inspected_dads_chess_set" }, { kind: "storyFlag", flag: "army_restoration_explained", equals: false }] },
      { id: "lemicus-book-after-plan", label: "Talk to Lem", shortLabel: "Lem", icon: "📖", x: 9, y: 67.3, width: 22.6, height: 32.3, importance: "primary", action: { type: "dialogue", dialogueId: "house-lem-plan-repeat" }, visibleWhen: [{ kind: "storyFlag", flag: "army_restoration_explained" }] },
      { id: "dads-chess-set", label: "Inspect Dad's chess set", shortLabel: "Chess set", icon: "♟", x: 42.2, y: 55.2, width: 35.8, height: 38, importance: "primary", action: { type: "dialogue", dialogueId: "house-chess-set-board" }, visibleWhen: [{ kind: "storyFlag", flag: "inspected_dads_chess_set", equals: false }] },
      { id: "dads-chess-set-repeat", label: "Inspect Dad's chess set", shortLabel: "Chess set", icon: "♟", x: 42.2, y: 55.2, width: 35.8, height: 38, importance: "primary", action: { type: "inspect", title: "Dad's damaged army", description: "The pieces are badly damaged, but not destroyed. They are waiting for someone who knows how to command them." }, visibleWhen: [{ kind: "storyFlag", flag: "inspected_dads_chess_set" }] },
      { id: "family-portrait", label: "Look at the picture", shortLabel: "Picture", icon: "◇", x: 86.2, y: 35.6, width: 11.1, height: 31.6, action: { type: "inspect", title: "You and Dad", description: "You and Dad, painted before everything changed. The frame is dusty, but the picture is safe." } }
    ]
  },
  "house-chess-set-board": {
    id: "house-chess-set-board",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Narrator",
    portrait: "narrator",
    text: "Dad's chessboard.",
    next: "house-chess-set-broken"
  },
  "house-chess-set-broken": {
    id: "house-chess-set-broken",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Narrator",
    portrait: "narrator",
    text: "Several wooden pieces are cracked or broken.",
    next: "house-chess-set-fought"
  },
  "house-chess-set-fought": {
    id: "house-chess-set-fought",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Narrator",
    portrait: "narrator",
    text: "The way they fell makes it look like they tried to fight.",
    setsFlags: ["inspected_dads_chess_set"],
    next: "house"
  },
  "house-lem-pickup": {
    id: "house-lem-pickup",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Narrator",
    portrait: "narrator",
    text: "You pull the old book free. Dust tickles your nose, and it slips onto a cushion.",
    next: "house-lem-ow"
  },
  "house-lem-ow": {
    id: "house-lem-ow",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Lem",
    portrait: "lem",
    text: "Ow.",
    next: "house-lem-six-seconds"
  },
  "house-lem-six-seconds": {
    id: "house-lem-six-seconds",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Lem",
    portrait: "lem",
    text: "Excellent. We've known each other six seconds and you've already thrown me.",
    next: "house-lem-name"
  },
  "house-lem-name": {
    id: "house-lem-name",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Lem",
    portrait: "lem",
    text: "I am Lemicus, Keeper of Ancient Gambits, Guardian of—",
    next: "house-lem-short-name"
  },
  "house-lem-short-name": {
    id: "house-lem-short-name",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Narrator",
    portrait: "narrator",
    text: "Lem, you decide.",
    next: "house-lem-met"
  },
  "house-lem-met": {
    id: "house-lem-met",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Lem",
    portrait: "lem",
    text: "I was still on the impressive titles.",
    setsFlags: ["met_lem"],
    next: "house"
  },
  "house-lem-repeat": {
    id: "house-lem-repeat",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Lem",
    portrait: "lem",
    text: "Yes, the book talks. No, this is not the strangest thing in the room. Look at Dad's chessboard.",
    next: "house"
  },
  "house-can-we-fix": {
    id: "house-can-we-fix",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Narrator",
    portrait: "narrator",
    text: "Can we fix them?",
    next: "house-lem-maybe"
  },
  "house-lem-maybe": {
    id: "house-lem-maybe",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Lem",
    portrait: "lem",
    text: "Maybe.",
    next: "house-army-fought"
  },
  "house-army-fought": {
    id: "house-army-fought",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Lem",
    portrait: "lem",
    text: "Dad's pieces fought when Kingpin's gang took him. They were defeated, not destroyed.",
    next: "house-army-rule"
  },
  "house-army-rule": {
    id: "house-army-rule",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Lem",
    portrait: "lem",
    text: "Chess knowledge lets a player command an army. Learn enough, and these pieces may stand again.",
    setsFlags: ["army_restoration_explained"],
    next: "difficulty"
  },
  "house-lem-plan-repeat": {
    id: "house-lem-plan-repeat",
    ...RANSACKED_HOUSE_BACKGROUND,
    speaker: "Lem",
    portrait: "lem",
    text: "The pieces are waiting. First, we find out how much chess you know.",
    next: "difficulty"
  },
  difficulty: { id: "difficulty", title: "Lem's very serious survey", ...RANSACKED_HOUSE_BACKGROUND, speaker: "Lem", portrait: "lem", text: "Before we go any further, how much chess do you actually know? There is no wrong answer. There are, however, several wrong moves.", choices: [
    { label: "I've never played before.", next: "pip-awakens-intro", difficulty: "beginner" },
    { label: "I know how the pieces move.", next: "pieces-ready", difficulty: "pieces" },
    { label: "I've played some chess.", next: "pieces-ready", difficulty: "some" },
    { label: "I play a lot.", next: "pieces-ready", difficulty: "experienced" }
  ] },
  "pieces-ready": { id: "pieces-ready", ...RANSACKED_HOUSE_BACKGROUND, speaker: "Lem", portrait: "lem", text: "Then we can move quickly. The pieces listen as you name their moves, and Dad's little army wakes with a series of very judgmental wooden clacks.", next: "rookus-intro" },
  "pip-awakens-intro": { id: "pip-awakens-intro", title: "Scene 3 · Pip Awakens", ...PIP_AWAKENS_BACKGROUND, speaker: "Lem", portrait: "lem", text: "Dad's pieces need a player who knows how to command them. Learn their moves, and they may stand again.", next: "pip-awakens-stirs" },
  "pip-awakens-stirs": { id: "pip-awakens-stirs", title: "Scene 3 · Pip Awakens", ...PIP_AWAKENS_BACKGROUND, speaker: "Narrator", portrait: "narrator", text: "A tiny wooden Pawn twitches. Warm light slips through his cracks.", next: "pip-awakens-boast" },
  "pip-awakens-boast": { id: "pip-awakens-boast", title: "Scene 3 · Pip Awakens", ...PIP_AWAKENS_BACKGROUND, speaker: "Pip", portrait: "pip", text: "I CAN STILL FIGHT!", next: "pip-awakens-cracked" },
  "pip-awakens-cracked": { id: "pip-awakens-cracked", title: "Scene 3 · Pip Awakens", ...PIP_AWAKENS_BACKGROUND, speaker: "Lem", portrait: "lem", text: "You are cracked in three places.", next: "pip-awakens-counts" },
  "pip-awakens-counts": { id: "pip-awakens-counts", title: "Scene 3 · Pip Awakens", ...PIP_AWAKENS_BACKGROUND, speaker: "Pip", portrait: "pip", text: "Still counts.", setsFlags: ["met_pip"], next: "pip-awakens" },
  "pip-awakens": {
    id: "pip-awakens",
    title: "Scene 3 · Pip Awakens",
    ...PIP_AWAKENS_BACKGROUND,
    speaker: "Narrator",
    portrait: "narrator",
    text: "Pip vibrates with confidence. Lem and the rest of Dad's damaged army wait nearby.",
    hotspots: [
      { id: "pip-before-training", label: "Talk to Pip", shortLabel: "Pip", icon: "♟", x: 55.8, y: 41.8, width: 13.7, height: 29, importance: "primary", action: { type: "dialogue", dialogueId: "pip-lesson-offer" }, visibleWhen: [{ kind: "completedChallenge", challengeId: "learn-pawn", equals: false }] },
      { id: "pip-after-training", label: "Talk to Pip", shortLabel: "Pip", icon: "♟", x: 55.8, y: 41.8, width: 13.7, height: 29, importance: "primary", action: { type: "dialogue", dialogueId: "pip-repeat" }, visibleWhen: [{ kind: "completedChallenge", challengeId: "learn-pawn" }] },
      { id: "lem-before-training", label: "Talk to Lem", shortLabel: "Lem", icon: "📖", x: 8.5, y: 60, width: 23.5, height: 37, action: { type: "dialogue", dialogueId: "pip-lem-before" }, visibleWhen: [{ kind: "completedChallenge", challengeId: "learn-pawn", equals: false }] },
      { id: "lem-after-training", label: "Talk to Lem", shortLabel: "Lem", icon: "📖", x: 8.5, y: 60, width: 23.5, height: 37, action: { type: "dialogue", dialogueId: "pip-lem-after" }, visibleWhen: [{ kind: "completedChallenge", challengeId: "learn-pawn" }] },
      { id: "army-before-training", label: "Inspect Dad's army", shortLabel: "Army", icon: "♟", x: 43.2, y: 52.2, width: 13.9, height: 19, action: { type: "inspect", title: "Dad's damaged army", description: "Most of Dad's pieces are still badly damaged. The Pawns are the simplest place to start." }, visibleWhen: [{ kind: "completedChallenge", challengeId: "learn-pawn", equals: false }] },
      { id: "army-after-training", label: "Inspect Dad's army", shortLabel: "Army", icon: "♙", x: 43.2, y: 52.2, width: 13.9, height: 19, action: { type: "inspect", title: "Dad's army", description: "The Pawns are awake now. The rest of the army is still dormant." }, visibleWhen: [{ kind: "completedChallenge", challengeId: "learn-pawn" }] }
    ]
  },
  "pip-lesson-offer": { id: "pip-lesson-offer", title: "Pip Awakens", ...PIP_AWAKENS_BACKGROUND, speaker: "Pip", portrait: "pip", text: "Come on! Let's get moving!", choices: [
    { label: "Learn how Pawns move", next: "learn-pawn-intro" },
    { label: "Look around first", next: "pip-awakens" }
  ] },
  "pip-lem-before": { id: "pip-lem-before", title: "Pip Awakens", ...PIP_AWAKENS_BACKGROUND, speaker: "Lem", portrait: "lem", text: "Dad's pieces are damaged. Learning how to command them may restore them. Pawns are the simplest place to start.", next: "pip-awakens" },
  "pip-lem-after": { id: "pip-lem-after", title: "Pip Awakens", ...PIP_AWAKENS_BACKGROUND, speaker: "Lem", portrait: "lem", text: "The Pawns remember their orders. Roger and Ricky, the Rooks, are next.", next: "pip-awakens" },
  "pip-repeat": { id: "pip-repeat", title: "Pip Awakens", ...PIP_AWAKENS_BACKGROUND, speaker: "Pip", portrait: "pip", text: "Point me forward. I have a flawless plan and at least half a working base.", next: "pip-awakens" },
  "learn-pawn-intro": { id: "learn-pawn-intro", title: "Pawn Training", ...PIP_AWAKENS_BACKGROUND, speaker: "Lem", portrait: "lem", text: "Pip's full Pawn course is ready: movement, captures, first moves, and promotion routes.", pieceLesson: "pawn", next: "learn-pawn" },
  "learn-pawn": { id: "learn-pawn", title: "Pawn Training", ...PIP_AWAKENS_BACKGROUND, speaker: "Pip", portrait: "pip", text: "Come on! Let's get moving!", challengeId: "learn-pawn" },
  "pawns-restored": { id: "pawns-restored", title: "Pip Awakens", ...PIP_AWAKENS_BACKGROUND, speaker: "Narrator", portrait: "narrator", text: "Warm light races through the wooden Pawns. Their cracks seal, and the whole row straightens. Lem marks 5 training coins in the margin.", restoration: { title: "PAWNS RESTORED", durationMs: 1800 }, next: "pawns-restored-pip" },
  "pawns-restored-pip": { id: "pawns-restored-pip", title: "Pawns Restored", ...PIP_AWAKENS_BACKGROUND, speaker: "Pip", portrait: "pip", text: "Told you I was ready!", next: "pawns-restored-lem" },
  "pawns-restored-lem": { id: "pawns-restored-lem", title: "Pawns Restored", ...PIP_AWAKENS_BACKGROUND, speaker: "Lem", portrait: "lem", text: "Your confidence remains medically concerning. Roger and Ricky are next.", next: "learn-rook-intro" },
  "learn-rook-intro": { id: "learn-rook-intro", title: "Meet Roger & Ricky", background: "house", speaker: "Lem", portrait: "lem", text: "Two wooden rooks clack awake. Lem opens to a page with an aggressively straight line drawn across it.", pieceLesson: "rook", next: "learn-rook" },
  "learn-rook": { id: "learn-rook", background: "house", speaker: "Lem", portrait: "lem", text: "Roger and Ricky point down two perfectly straight corridors. Subtlety is not their favorite game.", challengeId: "learn-rook" },
  "learn-bishop-intro": { id: "learn-bishop-intro", title: "Meet Kate & Hanna", background: "house", speaker: "Lem", portrait: "lem", text: "A gentle glow reaches the bishops. 'Diagonals,' Lem says. 'A wonderful invention for people who enjoy arriving from the side.'", pieceLesson: "bishop", next: "learn-bishop" },
  "learn-bishop": { id: "learn-bishop", background: "house", speaker: "Lem", portrait: "lem", text: "Kate and Hanna glide across the wooden board, entirely refusing to use a straight road.", challengeId: "learn-bishop" },
  "learn-queen-intro": { id: "learn-queen-intro", title: "Meet Marilou", background: "house", speaker: "Lem", portrait: "lem", text: "Marilou's crack glimmers. 'The queen does not need an introduction,' she says, despite not being awake yet.", pieceLesson: "queen", next: "learn-queen" },
  "learn-queen": { id: "learn-queen", background: "house", speaker: "Lem", portrait: "lem", text: "Marilou gives the board a royal nod. Lem quietly points at the glowing stars.", challengeId: "learn-queen" },
  "learn-king-intro": { id: "learn-king-intro", title: "Meet Luis", background: "house", speaker: "Lem", portrait: "lem", text: "Luis is the last to stir. 'The king is important,' Lem whispers, 'but important does not mean fast.'", pieceLesson: "king", next: "learn-king" },
  "learn-king": { id: "learn-king", background: "house", speaker: "Lem", portrait: "lem", text: "Luis takes one careful wooden step. Lem approves of the caution, which is rare.", challengeId: "learn-king" },
  "learn-knight-intro": { id: "learn-knight-intro", title: "Meet Kevin & Kai", background: "house", speaker: "Lem", portrait: "lem", text: "Kevin's wooden horse tilts sideways. Lem sighs. 'The knight does not follow roads. It barely follows directions.'", pieceLesson: "knight", next: "learn-knight" },
  "learn-knight": { id: "learn-knight", background: "house", speaker: "Lem", portrait: "lem", text: "Kevin and Kai leap over the board's little fences and land somewhere alarming.", challengeId: "learn-knight" },
  "rookus-intro": {
    id: "rookus-intro",
    background: "square",
    backgroundImage: "/adventure/scenes/village-square.svg",
    backgroundAlt: "Pawnhaven village square, where Rookus blocks the fountain while villagers hide near the road to the town hall",
    speaker: "Rookus",
    portrait: "rookus",
    text: "Rookus blocks the village fountain with arms like castle walls. 'Kingpin says this fountain belongs to us now.' He points at Pip. 'And that little pawn owes rent.' Lem opens Dad's first Fundamentals page: Capture.",
    hotspots: [
      { id: "rookus", label: "Confront Rookus", shortLabel: "Rookus", icon: "⚔", x: 40, y: 25, width: 23, height: 55, importance: "primary", action: { type: "startEncounter", encounterId: "rookus" } },
      { id: "villager", label: "Check on the hidden villager", shortLabel: "Villager", icon: "!", x: 9, y: 44, width: 17, height: 34, action: { type: "inspect", title: "A worried villager", description: "She points to the fountain and whispers, 'Rookus takes anything that looks unprotected.'" } },
      { id: "road-forward", label: "Continue toward the town hall", shortLabel: "Road ahead", icon: "➜", x: 76, y: 25, width: 20, height: 51, action: { type: "gotoScene", sceneId: "castler-intro" }, disabledWhen: [{ kind: "completedChallenge", challengeId: "fundamentals-combat", equals: false }], disabledReason: "Finish Rookus's lessons before taking the road ahead." }
    ],
    next: "rookus-capture"
  },
  "rookus-capture": { id: "rookus-capture", title: "Fundamentals · Capture", background: "square", speaker: "Lem", portrait: "lem", text: "'A capture removes an enemy piece from the board,' Lem says. 'Start by taking back what Rookus took. Do try to keep your own pieces while doing it.'", challengeId: "fundamentals-capture" },
  "rookus-protection": { id: "rookus-protection", title: "Fundamentals · Protection", background: "square", speaker: "Rookus", portrait: "rookus", text: "Rookus swings at the repaired army. 'Easy targets!' Lem turns the page. 'Not once they are protected.'", challengeId: "fundamentals-protection" },
  "rookus-combat": { id: "rookus-combat", title: "Fundamentals · Combat", background: "square", speaker: "Lem", portrait: "lem", text: "'Now combine both ideas,' Lem says. 'Capture loose enemies and do not leave your teammates loose. It is a remarkably effective way to ruin a bruiser's afternoon.'", challengeId: "fundamentals-combat" },
  "castler-intro": { id: "castler-intro", background: "square", speaker: "Castler", portrait: "castler", text: "Castler adjusts his cape. 'I am an expert in every rule.' Lem flips to the next Fundamentals page. 'Excellent. Then you can explain check when you lose to it.'", next: "castler-check" },
  "castler-check": { id: "castler-check", title: "Fundamentals · Check", background: "square", speaker: "Lem", portrait: "lem", text: "'Check means the enemy king is attacked,' Lem says. 'It must be answered immediately. That is less a suggestion and more a law of the universe.'", challengeId: "fundamentals-check" },
  "castler-out-of-check": { id: "castler-out-of-check", title: "Fundamentals · Out of Check", background: "square", speaker: "Castler", portrait: "castler", text: "Castler's grin thins. 'And if my king is checked?' Lem: 'Move the king, block the line, or capture the attacker. Your cape is not one of the options.'", challengeId: "fundamentals-out-of-check" },
  "nate-intro": { id: "nate-intro", background: "square", speaker: "Stale Nate", portrait: "nate", text: "Stale Nate flips a coin between his fingers. 'I do not win. I merely make escape impossible.' Lem opens the final Fundamentals page: Checkmate.", next: "nate-mate" },
  "nate-mate": { id: "nate-mate", title: "Fundamentals · Mate in One", background: "square", speaker: "Lem", portrait: "lem", text: "'Check with no legal escape is checkmate,' Lem says. 'It ends the game. Nate dislikes this because it ends his speeches too.'", challengeId: "fundamentals-checkmate" },
  "boss-setup": {
    id: "boss-setup",
    title: "Pawnhaven's first boss",
    background: "castle",
    backgroundImage: "/adventure/scenes/kingpin-hall.svg",
    backgroundAlt: "Kingpin's occupied town hall, with Kingpin before a black throne and Dad's chess record on a guarded table",
    speaker: "Kingpin",
    portrait: "kingpin",
    text: "Kingpin steps from the occupied town hall. 'Your dad tried courage. You brought a book and a box of repaired firewood.' Lem clears his throat. 'The firewood has names.'",
    setsFlags: ["reached_kingpin"],
    hotspots: [
      { id: "kingpin", label: "Challenge Kingpin", shortLabel: "Kingpin", icon: "♛", x: 39, y: 17, width: 24, height: 60, importance: "primary", action: { type: "startEncounter", encounterId: "kingpin" } },
      { id: "battle-record", label: "Inspect Dad's battle record", shortLabel: "Battle record", icon: "▤", x: 69, y: 46, width: 18, height: 28, action: { type: "inspect", title: "Dad's battle record", description: "The final position is circled in red. Beside it, Kingpin wrote: 'Courage is not a plan.'" } },
      { id: "locked-door", label: "Inspect the locked door", shortLabel: "Locked door", icon: "🔒", x: 8, y: 25, width: 19, height: 50, action: { type: "inspect", title: "Locked passage", description: "Boot prints lead through the door toward the capital road. Dad was taken this way." } }
    ],
    isBossSetup: true
  },
  ending: { id: "ending", title: "Chapter 1 complete", background: "road", speaker: "Marge", portrait: "marge", text: "Kingpin's gang pulls down its banners. Pawnhaven is free for now. On Kingpin's table, you find an order marked with the Black King's seal: Dad was taken toward the capital. Lem shuts with a snap. 'Then we have a road to follow.'", isEnding: true }
};

/** Encounter IDs stay content-owned; the controller only executes the resolved scene. */
export const ADVENTURE_ENCOUNTER_START_SCENES: Record<string, string> = {
  rookus: "rookus-capture",
  castler: "castler-check",
  nate: "nate-mate",
  kingpin: "boss-setup"
};

export const CHALLENGE_NEXT_SCENE: Record<string, string> = {
  "learn-pawn": "pawns-restored", "learn-rook": "learn-bishop-intro", "learn-bishop": "learn-queen-intro", "learn-queen": "learn-king-intro", "learn-king": "learn-knight-intro", "learn-knight": "rookus-intro",
  "fundamentals-capture": "rookus-protection", "fundamentals-protection": "rookus-combat", "fundamentals-combat": "castler-intro", "fundamentals-check": "castler-out-of-check", "fundamentals-out-of-check": "nate-intro", "fundamentals-checkmate": "boss-setup"
};

export const STORY_DEBUG_SCENE_GROUPS: AdventureDebugSceneGroup[] = [
  { label: "Opening", sceneIds: ["arrival-intro", "arrival-home", "arrival-wrong", "arrival", "home-called-back", "marge-greeting", "marge-what-happened", "marge-where-dad", "marge-banners", "marge-occupation", "marge-challenge", "marge-lost", "marge-taken", "marge-repeat", "house", "house-chess-set-board", "house-chess-set-broken", "house-chess-set-fought", "house-lem-pickup", "house-lem-ow", "house-lem-six-seconds", "house-lem-name", "house-lem-short-name", "house-lem-met", "house-lem-repeat", "house-can-we-fix", "house-lem-maybe", "house-army-fought", "house-army-rule", "house-lem-plan-repeat", "difficulty", "pieces-ready"] },
  { label: "Restore Dad's army", sceneIds: ["pip-awakens-intro", "pip-awakens-stirs", "pip-awakens-boast", "pip-awakens-cracked", "pip-awakens-counts", "pip-awakens", "pip-lesson-offer", "pip-lem-before", "pip-lem-after", "pip-repeat", "learn-pawn-intro", "learn-pawn", "pawns-restored", "pawns-restored-pip", "pawns-restored-lem", "learn-rook-intro", "learn-rook", "learn-bishop-intro", "learn-bishop", "learn-queen-intro", "learn-queen", "learn-king-intro", "learn-king", "learn-knight-intro", "learn-knight"] },
  { label: "Rookus · Capture, protection & combat", sceneIds: ["rookus-intro", "rookus-capture", "rookus-protection", "rookus-combat"] },
  { label: "Castler · Check fundamentals", sceneIds: ["castler-intro", "castler-check", "castler-out-of-check"] },
  { label: "Stale Nate · Checkmate", sceneIds: ["nate-intro", "nate-mate"] },
  { label: "Kingpin & ending", sceneIds: ["boss-setup", "ending"] }
];

export const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  { id: "lem", title: "Lem's Field Notes", icon: "📖", summary: "A sarcastic guide to saving Pawnhaven one legal move at a time.", detail: "Use this book whenever you want a quick reminder. Lem insists he is not a hint button with a face." },
  { id: "pawn", title: "Pawns", icon: "♟", summary: "Move forward; capture diagonally.", detail: "A Pawn moves one square forward. From its starting square, it may move two. It captures one square diagonally forward and cannot move backward.", practiceChallengeId: "learn-pawn" },
  { id: "rook", title: "Rooks", icon: "♜", summary: "Move straight across ranks and files.", detail: "Rooks move any number of clear squares horizontally or vertically. Roger and Ricky approve of clean lines.", practiceChallengeId: "learn-rook" },
  { id: "bishop", title: "Bishops", icon: "♝", summary: "Move diagonally.", detail: "Bishops move any number of clear squares diagonally. Each bishop stays on one color for the whole game.", practiceChallengeId: "learn-bishop" },
  { id: "queen", title: "Queen", icon: "♛", summary: "Moves like a rook and bishop combined.", detail: "Marilou can move any number of clear squares straight or diagonally. Powerful does not mean invincible, so keep her safe.", practiceChallengeId: "learn-queen" },
  { id: "king", title: "King", icon: "♚", summary: "Moves one square and must stay safe.", detail: "Luis moves one square in any direction. You may never leave your king in check.", practiceChallengeId: "learn-king" },
  { id: "knight", title: "Knights", icon: "♞", summary: "Leap in an L shape.", detail: "Kevin and Kai move two squares one way and one square sideways. Knights can jump over every piece in between.", practiceChallengeId: "learn-knight" },
  { id: "capture", title: "Capture", icon: "⚔️", summary: "Take an enemy piece by moving onto its square.", detail: "A capture removes an enemy piece from the board. Before capturing, check whether the enemy can capture you back.", practiceChallengeId: "fundamentals-capture" },
  { id: "protection", title: "Protection", icon: "🛡️", summary: "Keep your pieces from being taken for free.", detail: "When a teammate is attacked, move it to safety or protect it with another piece. Look for every loose piece before you end your turn.", practiceChallengeId: "fundamentals-protection" },
  { id: "combat", title: "Combat", icon: "⚔️", summary: "Capture enemy pieces while protecting your own.", detail: "The best captures do not leave your own pieces loose. Scan both sides of every exchange.", practiceChallengeId: "fundamentals-combat" },
  { id: "check", title: "Check", icon: "⚔️", summary: "The king is under attack.", detail: "When a king is in check, that player must get out of check immediately by moving, blocking, or capturing the attacker.", practiceChallengeId: "fundamentals-check" },
  { id: "out-of-check", title: "Out of Check", icon: "🛡️", summary: "Answer a check immediately.", detail: "Get out of check by moving your king, blocking a sliding attack, or capturing the checking piece. Every other plan must wait.", practiceChallengeId: "fundamentals-out-of-check" },
  { id: "checkmate", title: "Checkmate", icon: "👑", summary: "Check with no legal escape.", detail: "Checkmate ends the game. The king is attacked and cannot move, block, or capture its way out.", practiceChallengeId: "fundamentals-checkmate" }
];
