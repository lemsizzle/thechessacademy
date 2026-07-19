import { describe, expect, it } from "vitest";
import { mapLichessGameForStudent } from "@/lib/lichess/fetchStudentGamesForWindow";

describe("mapLichessGameForStudent", () => {
  it("recognizes a win from the userId shape returned by the Lichess game export API", () => {
    const game = mapLichessGameForStudent({
      id: "game-1",
      rated: true,
      perf: "rapid",
      status: "mate",
      winner: "black",
      turns: 24,
      players: {
        white: { userId: "opponent" },
        black: { userId: "So_Pawny" }
      }
    }, "so_pawny", "rapid");

    expect(game.won).toBe(true);
    expect(game.moveCount).toBe(12);
  });

  it("does not mark a loss as a win", () => {
    const game = mapLichessGameForStudent({
      id: "game-2",
      rated: true,
      speed: "blitz",
      status: "resign",
      winner: "white",
      turns: 30,
      players: {
        white: { userId: "opponent" },
        black: { userId: "student" }
      }
    }, "student", "blitz");

    expect(game.won).toBe(false);
  });

  it("does not count a no-start pairing as a finished game", () => {
    const game = mapLichessGameForStudent({
      id: "game-3",
      rated: true,
      perf: "rapid",
      status: "noStart",
      winner: "black",
      turns: 0,
      moves: "",
      players: {
        white: { user: { id: "student", name: "Student" } },
        black: { user: { id: "opponent", name: "Opponent" } }
      }
    }, "student", "rapid");

    expect(game.finished).toBe(false);
    expect(game.won).toBe(false);
  });
});
