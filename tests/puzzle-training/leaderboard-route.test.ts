import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { GET } from "@/app/api/student/puzzle-training/leaderboard/route";

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  getStudentsResult: vi.fn(),
  getStudentAvatarDisplayData: vi.fn(),
  getSurvivalLeaderboardScores: vi.fn()
}));
vi.mock("@/lib/auth/requireActiveStudent", () => ({
  requireActiveStudent: mocks.requireActiveStudent,
  StudentAuthenticationError: class extends Error {}
}));
vi.mock("@/lib/data/students", () => ({ getStudentsResult: mocks.getStudentsResult }));
vi.mock("@/lib/avatar/supabaseAvatar", () => ({ getStudentAvatarDisplayData: mocks.getStudentAvatarDisplayData }));
vi.mock("@/lib/leaderboard/survivalServer", () => ({ getSurvivalLeaderboardScores: mocks.getSurvivalLeaderboardScores }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireActiveStudent.mockResolvedValue({ studentId: "viewer" });
  mocks.getStudentsResult.mockResolvedValue({ source: "supabase", data: [{ id: "active-student" }] });
  mocks.getStudentAvatarDisplayData.mockResolvedValue({ items: [], avatars: {} });
  mocks.getSurvivalLeaderboardScores.mockResolvedValue([]);
});

describe("on-demand puzzle leaderboard", () => {
  it("requires an active student before reading roster or leaderboard data", async () => {
    mocks.requireActiveStudent.mockRejectedValue(new StudentAuthenticationError("inactive profile"));
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.getStudentsResult).not.toHaveBeenCalled();
    expect(mocks.getSurvivalLeaderboardScores).not.toHaveBeenCalled();
    expect(mocks.getStudentAvatarDisplayData).not.toHaveBeenCalled();
  });

  it("loads avatars only for the active roster and prevents response caching", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.getStudentAvatarDisplayData).toHaveBeenCalledWith(["active-student"]);
    expect(await response.json()).toEqual({ students: [{ id: "active-student" }], avatarItems: [], studentAvatars: {}, survivalScores: [] });
  });

  it("does not turn a database failure into a leaderboard of example students", async () => {
    mocks.getStudentsResult.mockResolvedValue({ source: "mock", data: [{ id: "example" }] });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(mocks.getStudentAvatarDisplayData).not.toHaveBeenCalled();
  });

  it("returns a retryable error without disclosing backend details", async () => {
    mocks.getSurvivalLeaderboardScores.mockRejectedValue(new Error("private database details"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database details");
  });
});
