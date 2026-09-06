import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: vi.fn(), requireSignedInStudent: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from: () => ({ upsert: mocks.upsert }), rpc: mocks.rpc }) }));
import { saveTrainingAttempt } from "@/lib/puzzle-training/server";

const attempt = { studentId: "student-a", puzzleId: "puzzle-a", sessionId: "session-a", selectedTheme: "mixed" as const,
  trainingMode: "survival" as const, solved: true, incorrectMoveCount: 0, hintsUsed: 0, startedAt: new Date().toISOString() };

describe("automatic Survival awards", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.upsert.mockResolvedValue({ error: null }); mocks.rpc.mockResolvedValue({ data: [], error: null }); });
  it("saves the verified solve before requesting rewards and returns the earned badges", async () => {
    const awards = [{ badgeId: "pin", name: "Pin Bronze", tier: "Bronze", coins: 20 }];
    mocks.rpc.mockImplementation(async () => {
      expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ student_id: "student-a", solved: true }), expect.anything());
      return { data: awards, error: null };
    });
    expect((await saveTrainingAttempt(attempt)).badgeAwards).toEqual(awards);
    expect(mocks.rpc).toHaveBeenCalledWith("award_survival_tactical_badges", { p_student_id: "student-a" });
  });
  it.each(["daily", "woodpecker", "legacy"] as const)("does not award Survival badges for %s", async (trainingMode) => {
    await saveTrainingAttempt({ ...attempt, trainingMode });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not award for unsolved or unpersisted attempts", async () => {
    await saveTrainingAttempt({ ...attempt, solved: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.upsert.mockResolvedValue({ error: { message: "Save failed" } });
    await expect(saveTrainingAttempt(attempt)).rejects.toThrow("Save failed");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves the solve if rewards are temporarily unavailable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.rpc.mockRejectedValue(new Error("Offline"));
      expect((await saveTrainingAttempt(attempt)).badgeAwards).toEqual([]);
      mocks.rpc.mockResolvedValue({ error: { message: "Temporarily unavailable" }, data: null });
      expect((await saveTrainingAttempt(attempt)).badgeAwards).toEqual([]);
    } finally { log.mockRestore(); }
  });
});
