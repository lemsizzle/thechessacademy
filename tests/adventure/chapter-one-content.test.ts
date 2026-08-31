import { describe, expect, it } from "vitest";
import { Chess, type Square } from "chess.js";
import { ADVENTURE_CHALLENGES, CHALLENGE_NEXT_SCENE, STORY_DEBUG_SCENE_GROUPS, STORY_SCENES } from "@/adventure/content";
import { blackPiecesRemaining, findUnprotectedBlackCapture, findVisibleBlackAttack, hasUnprotectedBlackCapture } from "@/adventure/fundamentals";
import { findAdventureHintMove } from "@/adventure/hints";
import { LEARN_CHALLENGE_PIECES, PIECE_LESSON_INTROS } from "@/adventure/pieceLessonInfo";
import { hasPlayableStarTrailMove, keepWhiteToMove, starTrailRating } from "@/adventure/starTrail";
import type { AdventureLessonPiece } from "@/adventure/types";
import { pseudoLegalMovesFrom } from "@/chess/game/rules";

const lessonPieceType = { pawn: "p", rook: "r", bishop: "b", queen: "q", king: "k", knight: "n" } as const;

describe("Chapter 1 Adventure content", () => {
  it("keeps all story links inside the Chapter 1 scene data", () => {
    for (const scene of Object.values(STORY_SCENES)) {
      if (scene.next) expect(STORY_SCENES[scene.next]).toBeDefined();
      for (const choice of scene.choices ?? []) expect(STORY_SCENES[choice.next]).toBeDefined();
      if (scene.challengeId) {
        expect(ADVENTURE_CHALLENGES[scene.challengeId]).toBeDefined();
        expect(CHALLENGE_NEXT_SCENE[scene.challengeId]).toBeDefined();
      }
    }
  });

  it("keeps a local debug link for every Chapter 1 scene", () => {
    const linkedSceneIds = STORY_DEBUG_SCENE_GROUPS.flatMap((group) => group.sceneIds).sort();
    expect(linkedSceneIds).toEqual(Object.keys(STORY_SCENES).sort());
  });

  it("introduces each beginner piece in the story before its learning boards", () => {
    for (const [challengeId, piece] of Object.entries(LEARN_CHALLENGE_PIECES) as Array<[string, AdventureLessonPiece]>) {
      const introScene = Object.values(STORY_SCENES).find(
        (scene) => scene.pieceLesson === piece && scene.next === challengeId
      );

      expect(introScene, `${piece} needs a story introduction before ${challengeId}`).toBeDefined();
      expect(introScene?.challengeId).toBeUndefined();
      expect(PIECE_LESSON_INTROS[piece].value).toBeTruthy();
      expect(PIECE_LESSON_INTROS[piece].rule).toBeTruthy();
      expect(PIECE_LESSON_INTROS[piece].reminder).toBeTruthy();
    }
  });

  it("uses legal expected moves for every reusable board challenge", () => {
    for (const challenge of Object.values(ADVENTURE_CHALLENGES)) {
      expect(challenge.puzzles.length).toBeGreaterThanOrEqual(2);
      for (const puzzle of challenge.puzzles) {
        let chess = new Chess(puzzle.fen);
        if (puzzle.starTrail) {
          expect(puzzle.starTrail.startSquares.length).toBeGreaterThan(0);
          for (const startSquare of puzzle.starTrail.startSquares) {
            expect(chess.get(startSquare as Square)?.type).toBe(lessonPieceType[puzzle.starTrail.piece]);
            expect(chess.moves({ square: startSquare as Square }), `${puzzle.id}:${startSquare} should have a legal opening move`).not.toHaveLength(0);
          }
          expect(puzzle.shinySquares).toEqual(puzzle.starTrail.starSquares);
          expect(puzzle.starTrail.starSquares.length).toBeGreaterThan(0);
          expect(puzzle.starTrail.parMoves).toBeGreaterThan(0);
          expect(starTrailRating(puzzle.starTrail.parMoves, puzzle.starTrail.parMoves)).toBe(3);
          continue;
        }

        if (puzzle.fundamental) {
          expect(puzzle.sourceFen, `${puzzle.id} should retain its source layout for audit`).toBeDefined();
          expect(puzzle.fundamental.parMoves).toBeGreaterThan(0);
          expect(puzzle.movableSquares?.length).toBeGreaterThan(0);
          expect(chess.moves(), `${puzzle.id} should offer at least one legal opening move`).not.toHaveLength(0);

          if (puzzle.expectedMove) {
            const move = chess.move(puzzle.expectedMove);
            expect(move.from).toBe(puzzle.expectedMove.from);
            expect(move.to).toBe(puzzle.expectedMove.to);
          }

          if (puzzle.fundamental.goal === "capture-all") {
            expect(chess.board().flat().some((piece) => piece?.color === "b" && piece.type !== "k"), `${puzzle.id} should include black pieces to capture`).toBe(true);
          }
          if (puzzle.fundamental.goal === "escape-check") expect(chess.isCheck(), `${puzzle.id} should begin with White in check`).toBe(true);
          if (puzzle.fundamental.goal === "check" || puzzle.fundamental.goal === "checkmate") {
            const goalPosition = new Chess(puzzle.fen);
            const canReachGoal = goalPosition.moves({ verbose: true }).some((candidate) => {
              const next = new Chess(puzzle.fen);
              next.move({ from: candidate.from, to: candidate.to, promotion: candidate.promotion });
              return puzzle.fundamental?.goal === "check" ? next.isCheck() : next.isCheckmate();
            });
            expect(canReachGoal, `${puzzle.id} should have a legal ${puzzle.fundamental.goal} move`).toBe(true);
          }
          continue;
        }

        const expectedMove = puzzle.expectedMove;
        expect(expectedMove).toBeDefined();
        if (!expectedMove) throw new Error(`Missing expected move for ${puzzle.id}`);
        const move = chess.move(expectedMove);
        expect(move.from).toBe(expectedMove.from);
        expect(move.to).toBe(expectedMove.to);
        if (puzzle.expectedResult === "check") expect(chess.isCheck()).toBe(true);
        if (puzzle.expectedResult === "checkmate") expect(chess.isCheckmate()).toBe(true);
        if (puzzle.expectedResult === "stalemate") expect(chess.isStalemate()).toBe(true);
      }
    }
  });

  it("retains the complete Lichess piece-course star trails", () => {
    expect(ADVENTURE_CHALLENGES["learn-pawn"].puzzles).toHaveLength(8);
    expect(ADVENTURE_CHALLENGES["learn-rook"].puzzles).toHaveLength(6);
    expect(ADVENTURE_CHALLENGES["learn-bishop"].puzzles).toHaveLength(6);
    expect(ADVENTURE_CHALLENGES["learn-queen"].puzzles).toHaveLength(5);
    expect(ADVENTURE_CHALLENGES["learn-king"].puzzles).toHaveLength(3);
    expect(ADVENTURE_CHALLENGES["learn-knight"].puzzles).toHaveLength(6);

    for (const challengeId of ["learn-pawn", "learn-rook", "learn-bishop", "learn-queen", "learn-king", "learn-knight"] as const) {
      for (const puzzle of ADVENTURE_CHALLENGES[challengeId].puzzles) {
        expect(puzzle.starTrail).toBeDefined();
        expect(puzzle.shinySquares?.length).toBeGreaterThan(0);
      }
      expect(ADVENTURE_CHALLENGES[challengeId].puzzles[0].starTrail?.hintArrows?.length).toBeGreaterThan(0);
    }
  });

  it("gives every star trail at least one complete legal route", () => {
    const unsolvablePuzzles: string[] = [];
    for (const challenge of Object.values(ADVENTURE_CHALLENGES)) {
      for (const puzzle of challenge.puzzles) {
        if (!puzzle.starTrail) continue;
        if (!hasPlayableStarTrailMove(puzzle, puzzle.fen, puzzle.starTrail.startSquares, puzzle.starTrail.starSquares)) {
          unsolvablePuzzles.push(`${challenge.id}/${puzzle.id}`);
        }
      }
    }
    expect(unsolvablePuzzles, "each trail needs a complete legal star-collection route").toEqual([]);
  });

  it("retains the original eight Lichess Pawn boards", () => {
    const puzzles = ADVENTURE_CHALLENGES["learn-pawn"].puzzles;
    expect(puzzles.map((puzzle) => puzzle.id)).toEqual([
      "pawn-1", "pawn-2", "pawn-3", "pawn-4", "pawn-5", "pawn-6", "pawn-7", "pawn-8"
    ]);
    expect(puzzles.map((puzzle) => puzzle.starTrail?.parMoves)).toEqual([4, 8, 4, 8, 8, 7, 3, 9]);
    expect(puzzles[0].starTrail?.hintArrows).toEqual([
      { from: "a5", to: "a6" },
      { from: "a6", to: "a7" },
      { from: "a7", to: "a8" }
    ]);
    expect(new Chess(puzzles[2].fen).get("d5" as Square)).toMatchObject({ color: "b", type: "p" });
  });

  it("uses the Lichess piece-course star counts and locations", () => {
    const expectedStars = {
      "learn-pawn": [["f3"], ["b6", "c4", "d7", "e5", "a8"], ["c6", "d5", "d7"], ["b4", "b6", "c4", "c6", "c7", "d6"], ["c4", "b5", "b6", "d5", "d7", "e6", "c8"], ["b5", "c5", "d4", "e5", "g4"], ["d6"], ["c5", "d5", "e5", "f5", "d3", "e4"]],
      "learn-rook": [["e7"], ["c5", "g5"], ["a4", "g3", "g4"], ["f8", "g1", "g7", "g8", "h7"], ["a4", "g3", "g7", "h4"], ["b7", "d1", "d5", "f2", "f7", "g4", "g7"]],
      "learn-bishop": [["d5", "g8"], ["a2", "b1", "b5", "d1", "d3", "e2"], ["a1", "b6", "c1", "e3", "g7", "h6"], ["a4", "b1", "b3", "c2", "d3", "e2"], ["d3", "d4", "d5", "e3", "e4", "e5"], ["a3", "c2", "e7", "f5", "f6", "g8", "h4", "h7"]],
      "learn-queen": [["e5", "b8"], ["a3", "f2", "f8", "h3"], ["a3", "d6", "f1", "f8", "g3", "h6"], ["a2", "b5", "d3", "g1", "g8", "h2", "h5"], ["a6", "d1", "f2", "f6", "g6", "g8", "h1", "h4"]],
      "learn-king": [["e6"], ["c2", "d3", "e2", "e3"], ["b5", "c5", "d6", "e3", "f3", "g4"]],
      "learn-knight": [["c5", "d7"], ["c3", "d4", "e2", "f3", "f7", "g5", "h8"], ["b6", "d5", "d7", "e6", "f4"], ["e3", "e4", "e5", "f3", "f5", "g3", "g4", "g5"], ["c3", "e2", "e4", "f2", "f4", "g6"], ["b4", "b5", "c6", "c8", "d4", "d5", "e3", "e7", "f5"]]
    } as const;

    for (const [challengeId, locations] of Object.entries(expectedStars)) {
      expect(ADVENTURE_CHALLENGES[challengeId].puzzles.map((puzzle) => puzzle.starTrail?.starSquares)).toEqual(locations);
    }
    expect(ADVENTURE_CHALLENGES["learn-queen"].puzzles[0].starTrail?.hintArrows).toEqual([{ from: "e2", to: "e5" }, { from: "e5", to: "b8" }]);
  });

  it("uses a glowing target for every learn-by-playing puzzle", () => {
    for (const challenge of Object.values(ADVENTURE_CHALLENGES)) {
      for (const puzzle of challenge.puzzles) {
        if (puzzle.expectedMove && !puzzle.fundamental) expect(puzzle.shinySquares).toContain(puzzle.expectedMove.to);
        if (puzzle.starTrail) expect(puzzle.shinySquares).toEqual(puzzle.starTrail.starSquares);
      }
    }
  });

  for (const [challengeId, challenge] of Object.entries(ADVENTURE_CHALLENGES)) {
    it(`offers a legal free hint on every ${challengeId} board`, () => {
      for (const puzzle of challenge.puzzles) {
        const movableSquares = puzzle.starTrail?.startSquares
          ?? puzzle.movableSquares
          ?? (puzzle.expectedMove ? [puzzle.expectedMove.from] : []);
        const hint = findAdventureHintMove(
          puzzle,
          puzzle.fen,
          movableSquares,
          puzzle.starTrail?.starSquares ?? []
        );

        expect(hint, `${challengeId}/${puzzle.id} needs a board hint`).not.toBeNull();
        if (!hint) continue;
        const chess = new Chess(puzzle.fen);
        const legalMove = chess.moves({ square: hint.from as Square, verbose: true })
          .find((move) => move.to === hint.to);
        expect(legalMove, `${challengeId}/${puzzle.id} hint ${hint.from}-${hint.to} must be legal`).toBeDefined();
      }
    });
  }

  it("uses the requested final checkmate explanation", () => {
    const finalPuzzle = ADVENTURE_CHALLENGES["fundamentals-checkmate"].puzzles.at(-1);
    expect(finalPuzzle?.concept).toBe("Before you declare checkmate, ensure the opponent has no way to save their king.");
  });

  it("matches every Lichess Fundamentals lesson through mate in one", () => {
    const expectedLayouts = {
      "fundamentals-capture": ["8/2p2p2/8/8/8/2R5/8/8 w - -", "8/2r2p2/8/8/5Q2/8/8/8 w - -", "8/5r2/8/1r3p2/8/3B4/8/8 w - -", "8/5b2/5p2/3n2p1/8/6Q1/8/8 w - -", "8/3b4/2p2q2/8/3p1N2/8/8/8 w - -"],
      "fundamentals-protection": ["8/8/8/4bb2/8/8/P2P4/R2K4 w - -", "8/8/2q2N2/8/8/8/8/8 w - -", "8/N2q4/8/8/8/8/6R1/8 w - -", "8/8/1Bq5/8/2P5/8/8/8 w - -", "1r6/8/5b2/8/8/5N2/P2P4/R1B5 w - -", "8/1b6/8/8/8/3P2P1/5NRP/r7 w - -", "rr6/3q4/4n3/4P1B1/7P/P7/1B1N1PP1/R5K1 w - -", "8/3q4/8/1N3R2/8/2PB4/8/8 w - -"],
      "fundamentals-combat": ["8/8/8/8/P2r4/6B1/8/8 w - -", "2r5/8/3b4/2P5/8/1P6/2B5/8 w - -", "1r6/8/5n2/3P4/4P1P1/1Q6/8/8 w - -", "2r5/8/3N4/5b2/8/8/PPP5/8 w - -", "8/6q1/8/4P1P1/8/4B3/r2P2N1/8 w - -"],
      "fundamentals-check": ["4k3/8/2b5/8/8/8/8/R7 w - -", "8/8/4k3/3n4/8/1Q6/8/8 w - -", "3qk3/1pp5/3p4/4p3/8/3B4/6r1/8 w - -", "2r2q2/2n5/8/4k3/8/2N1P3/3P2B1/8 w - -", "8/2b1q2n/1ppk4/2N5/8/8/8/8 w - -", "6R1/1k3r2/8/4Q3/8/2n5/8/8 w - -", "7r/4k3/8/3n4/4N3/8/2R5/4Q3 w - -"],
      "fundamentals-out-of-check": ["8/8/8/4q3/8/8/8/4K3 w - -", "8/2n5/5b2/8/2K5/8/2q5/8 w - -", "8/7r/6r1/8/R7/7K/8/8 w - -", "8/8/8/3b4/8/4N3/KBn5/1R6 w - -", "4q3/8/8/8/8/5nb1/3PPP2/3QKBNr w - -", "8/8/7p/2q5/5n2/1N1KP2r/3R4/8 w - -", "8/6b1/8/8/q4P2/2KN4/3P4/8 w - -"],
      "fundamentals-checkmate": ["3qk3/3ppp2/8/8/2B5/5Q2/8/8 w - -", "6rk/6pp/7P/6N1/8/8/8/8 w - -", "R7/8/7k/2r5/5n2/8/6Q1/8 w - -", "2rb4/2k5/5N2/1Q6/8/8/8/8 w - -", "1r2kb2/ppB1p3/2P2p2/2p1N3/B7/8/8/3R4 w - -", "8/pk1N4/n7/b7/6B1/1r3b2/8/1RR5 w - -", "r1b5/ppp5/2N2kpN/5q2/8/Q7/8/4B3 w - -"]
    } as const;

    for (const [challengeId, layouts] of Object.entries(expectedLayouts)) {
      expect(ADVENTURE_CHALLENGES[challengeId].puzzles.map((puzzle) => puzzle.sourceFen)).toEqual(layouts);
    }
  });

  it("keeps every protection board solvable and every capture board populated", () => {
    for (const puzzle of ADVENTURE_CHALLENGES["fundamentals-protection"].puzzles) {
      const chess = new Chess(puzzle.fen);
      const canMakeSafeMove = chess.moves({ verbose: true })
        .filter((move) => puzzle.movableSquares?.includes(move.from))
        .some((move) => {
          const next = new Chess(puzzle.fen);
          next.move({ from: move.from, to: move.to, promotion: move.promotion });
          return !hasUnprotectedBlackCapture(next, puzzle.opponentSquares);
        });
      expect(canMakeSafeMove, `${puzzle.id} should have a move that protects the white team`).toBe(true);
    }

    for (const challengeId of ["fundamentals-capture", "fundamentals-combat"] as const) {
      for (const puzzle of ADVENTURE_CHALLENGES[challengeId].puzzles) {
        expect(blackPiecesRemaining(new Chess(puzzle.fen)), `${puzzle.id} should start with something to capture`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps White's turn between captures on the first fundamentals board", () => {
    const puzzle = ADVENTURE_CHALLENGES["fundamentals-capture"].puzzles[0];
    const chess = new Chess(puzzle.fen);

    chess.move({ from: "c3", to: "c7" });
    chess.load(keepWhiteToMove(chess.fen()));
    expect(chess.turn()).toBe("w");
    chess.move({ from: "c7", to: "f7" });

    expect(blackPiecesRemaining(chess)).toBe(0);
  });

  it("finds Black's winning reply when a fundamentals capture leaves a piece hanging", () => {
    const puzzle = ADVENTURE_CHALLENGES["fundamentals-capture"].puzzles[3];
    const chess = new Chess(puzzle.fen);

    chess.move({ from: "g3", to: "g5" });
    const blackReply = findUnprotectedBlackCapture(chess, puzzle.opponentSquares);

    expect(blackReply).toMatchObject({ from: "f6", to: "g5", captured: "q" });
  });

  it("uses the visible queen instead of a hidden support king for Ng7", () => {
    const puzzle = ADVENTURE_CHALLENGES["fundamentals-capture"].puzzles[4];
    const chess = new Chess(puzzle.fen);

    chess.move({ from: "f4", to: "h5" });
    chess.load(keepWhiteToMove(chess.fen()));
    chess.move({ from: "h5", to: "g7" });

    expect(findUnprotectedBlackCapture(chess, puzzle.opponentSquares)).toMatchObject({
      from: "f6",
      to: "g7",
      piece: "q",
      captured: "n"
    });
  });

  it("lets the visible knight punish Qc3 in Combat 3", () => {
    const puzzle = ADVENTURE_CHALLENGES["fundamentals-combat"].puzzles[2];
    const chess = new Chess(puzzle.fen);

    chess.move({ from: "b3", to: "c3" });

    expect(findUnprotectedBlackCapture(chess, puzzle.opponentSquares)).toMatchObject({
      from: "f6",
      to: "g4",
      piece: "n",
      captured: "p"
    });
  });

  it("shows the g6 rook's attack after unsafe Kg3 in Out of Check 3", () => {
    const puzzle = ADVENTURE_CHALLENGES["fundamentals-out-of-check"].puzzles[2];
    const chess = new Chess(puzzle.fen);
    const king = chess.get("h3");
    if (!king) throw new Error("Out of Check 3 needs Luis on h3");

    chess.remove("h3");
    chess.put(king, "g3");

    expect(findVisibleBlackAttack(chess, "g3", puzzle.opponentSquares)).toMatchObject({
      from: "g6",
      to: "g3",
      piece: "r"
    });
  });

  it("allows d3 as an instructional attempt and keeps the knight check visible", () => {
    const puzzle = ADVENTURE_CHALLENGES["fundamentals-out-of-check"].puzzles[4];
    const chess = new Chess(puzzle.fen);

    expect(pseudoLegalMovesFrom(chess, "d2")).toContainEqual(expect.objectContaining({ from: "d2", to: "d3", piece: "p" }));

    const pawn = chess.get("d2");
    if (!pawn) throw new Error("Out of Check 5 needs a pawn on d2");
    chess.remove("d2");
    chess.put(pawn, "d3");

    expect(findVisibleBlackAttack(chess, "e1", puzzle.opponentSquares)).toMatchObject({
      from: "f3",
      to: "e1",
      piece: "n"
    });
  });

  it("shows Kf8 as Black's only saving reply after Bxf7+", () => {
    const puzzle = ADVENTURE_CHALLENGES["fundamentals-checkmate"].puzzles[0];
    const chess = new Chess(puzzle.fen);

    chess.move({ from: "c4", to: "f7" });

    expect(chess.isCheck()).toBe(true);
    expect(chess.isCheckmate()).toBe(false);
    expect(chess.moves({ verbose: true })).toEqual([
      expect.objectContaining({ from: "e8", to: "f8", piece: "k" })
    ]);
  });

});
