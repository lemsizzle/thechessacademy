import { describe, expect, it, vi } from "vitest";
import {
  findStarWarsSolution,
  initialStarWarsState,
  STAR_WARS_MAX_ROUTE_MOVES,
  starWarsPuzzleForScore
} from "@/lib/puzzle-training/starWars";

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: vi.fn() }));
vi.mock("@/lib/auth/requireActiveStudent", () => {
  class StudentAuthenticationError extends Error {}
  return { StudentAuthenticationError, requireActiveStudent: vi.fn() };
});

import {
  isStarWarsTimeTrialSubmissionOpen,
  parseStarWarsStartOptions,
  parseStarWarsRoutes,
  verifyStarWarsRoute
} from "@/lib/puzzle-training/starWarsServer";

describe("Star Wars server verification", () => {
  it("accepts Classic and the three supported Time Trial durations", () => {
    expect(parseStarWarsStartOptions(undefined)).toEqual({ mode: "classic", timeLimitMs: null });
    for (const timeLimitMs of [60_000, 180_000, 300_000]) {
      expect(parseStarWarsStartOptions({ mode: "time_trial", timeLimitMs })).toEqual({ mode: "time_trial", timeLimitMs });
    }
    expect(() => parseStarWarsStartOptions({ mode: "time_trial", timeLimitMs: 120_000 })).toThrow(/1, 3, or 5 minute/i);
    expect(() => parseStarWarsStartOptions({ mode: "classic", timeLimitMs: 60_000 })).toThrow(/does not use a time limit/i);
  });

  it("accepts in-flight Time Trial saves only through the short submission grace", () => {
    const startedAtMs = Date.parse("2026-09-02T12:00:00.000Z");
    expect(isStarWarsTimeTrialSubmissionOpen({
      startedAtMs,
      timeLimitMs: 60_000,
      receivedAtMs: startedAtMs + 75_000
    })).toBe(true);
    expect(isStarWarsTimeTrialSubmissionOpen({
      startedAtMs,
      timeLimitMs: 60_000,
      receivedAtMs: startedAtMs + 75_001
    })).toBe(false);
  });

  it("accepts the deterministic perfect route for the matching mission seed", () => {
    const runVariant = 42;
    const score = 6;
    const puzzle = starWarsPuzzleForScore(score, runVariant);
    const route = findStarWarsSolution(initialStarWarsState(puzzle));

    expect(route).not.toBeNull();
    expect(() => verifyStarWarsRoute(score, runVariant, route ?? [])).not.toThrow();
  });

  it("accepts a ten-move solo-knight gauntlet", () => {
    const runVariant = 4242;
    const score = 40;
    const puzzle = starWarsPuzzleForScore(score, runVariant);
    const route = findStarWarsSolution(initialStarWarsState(puzzle));

    expect(puzzle.stars).toHaveLength(STAR_WARS_MAX_ROUTE_MOVES);
    expect(puzzle.pieces).toHaveLength(1);
    expect(puzzle.pieces[0]?.type).toBe("n");
    expect(route).toHaveLength(STAR_WARS_MAX_ROUTE_MOVES);
    expect(() => parseStarWarsRoutes([route ?? []])).not.toThrow();
    expect(() => verifyStarWarsRoute(score, runVariant, route ?? [])).not.toThrow();
  });

  it("rejects incomplete, invalid, and oversized route submissions", () => {
    expect(() => verifyStarWarsRoute(0, 1, [])).toThrow(/incomplete/i);
    expect(() => parseStarWarsRoutes([])).toThrow(/between 1 and 500/i);
    expect(() => parseStarWarsRoutes([[{ from: "z9", to: "a1" }]])).toThrow(/invalid square/i);
    expect(() => parseStarWarsRoutes([Array.from({ length: STAR_WARS_MAX_ROUTE_MOVES + 1 }, () => ({ from: "a1", to: "a2" }))])).toThrow(/invalid length/i);
  });

  it("rejects a legal move sequence that does not solve the submitted mission", () => {
    const puzzle = starWarsPuzzleForScore(0, 81);
    const route = findStarWarsSolution(initialStarWarsState(puzzle));
    expect(route).not.toBeNull();
    expect(() => verifyStarWarsRoute(0, 81, (route ?? []).slice(0, -1))).toThrow(/incomplete/i);
  });
});
