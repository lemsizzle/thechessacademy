import { describe, expect, it } from "vitest";
import { createChessHistorySummary, parseChessHistoryFilters } from "@/chess/history/history";

describe("chess history", () => {
  it("uses safe defaults for missing or invalid filters", () => {
    expect(parseChessHistoryFilters(new URLSearchParams("mode=team&result=great&page=-2&pageSize=500"))).toEqual({
      mode: "all",
      result: "all",
      page: 1,
      pageSize: 30
    });
  });

  it("accepts supported filters and positive pagination", () => {
    expect(parseChessHistoryFilters(new URLSearchParams("mode=student&result=draw&page=3&pageSize=20"))).toEqual({
      mode: "student",
      result: "draw",
      page: 3,
      pageSize: 20
    });
  });

  it("caps extreme page numbers", () => {
    expect(parseChessHistoryFilters(new URLSearchParams("page=900000"))).toMatchObject({ page: 10_000, pageSize: 12 });
  });

  it("calculates a rounded lifetime win rate", () => {
    expect(createChessHistorySummary({
      total: 7,
      wins: 4,
      draws: 2,
      losses: 1,
      computerGames: 5,
      liveGames: 2
    })).toEqual({
      total: 7,
      wins: 4,
      draws: 2,
      losses: 1,
      winRate: 57,
      computerGames: 5,
      liveGames: 2
    });
  });

  it("reports a zero win rate before the first game", () => {
    expect(createChessHistorySummary({
      total: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      computerGames: 0,
      liveGames: 0
    }).winRate).toBe(0);
  });
});
