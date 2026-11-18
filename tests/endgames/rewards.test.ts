import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => null }));
import { createEndgameRewardToken, readEndgameRewardToken } from "@/lib/endgames/rewardToken";
import { verifyEndgameCompletion } from "@/lib/endgames/rewardsServer";
import { endgameCandidateFromSeed } from "@/lib/endgames/generator";
import { readEndgameProgress } from "@/lib/endgames/practice";
const student = "30000000-0000-4000-8000-000000000001";
beforeEach(() => { vi.stubEnv("STUDENT_SESSION_SECRET", "endgame-reward-unit-test-secret-123456789"); });
describe("endgame reward verification", () => {
  it("binds each generated batch to the student and rejects tampering and expiry", () => {
    const { token, seed } = createEndgameRewardToken(student, "queen-mate", 1000);
    expect(readEndgameRewardToken(token, student, 1001).seed).toBe(seed);
    expect(() => readEndgameRewardToken(token + "x", student, 1001)).toThrow();
    expect(() => readEndgameRewardToken(token, "other", 1001)).toThrow();
    expect(() => readEndgameRewardToken(token, student, 1000 + 8 * 86400000)).toThrow("expired");
    expect(() => createEndgameRewardToken(student, "unknown")).toThrow();
  });
  it("reconstructs positions exactly, rather than trusting a submitted FEN", () => {
    expect(endgameCandidateFromSeed("rook-mate", 12345, 3)).toBe(endgameCandidateFromSeed("rook-mate", 12345, 3));
    expect(endgameCandidateFromSeed("rook-mate", 12345, 3)).not.toBe(endgameCandidateFromSeed("rook-mate", 12345, 4));
    const { token } = createEndgameRewardToken(student, "queen-mate");
    expect(() => verifyEndgameCompletion(student, { token, candidateIndex: 0, assisted: false, fen: "7k/8/5KQ1/8/8/8/8/8 w - - 0 1", moves: ["g6g7"] })).toThrow();
    expect(() => verifyEndgameCompletion(student, { token, candidateIndex: 25, assisted: false, moves: [] })).toThrow();
    expect(() => verifyEndgameCompletion(student, { token, candidateIndex: 0, moves: ["e2e4"] })).toThrow();
  });
  it("preserves assistance and the reward receipt through reload", () => {
    const attempt = { fen: endgameCandidateFromSeed("rook-mate", 123, 0), moves: [], assisted: true, completed: false, rewardToken: "signed-token", candidateIndex: 0, rewardXp: 3 };
    expect(readEndgameProgress(JSON.stringify({ selected: "rook-mate", attempts: { "rook-mate": attempt } })).attempts["rook-mate"]).toEqual(attempt);
  });
});
