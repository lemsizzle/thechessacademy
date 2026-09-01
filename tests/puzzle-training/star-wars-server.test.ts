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
  parseStarWarsRoutes,
  verifyStarWarsRoute
} from "@/lib/puzzle-training/starWarsServer";

describe("Star Wars server verification", () => {
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
