import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { forkPuzzle } from "@/tests/fixtures/lichessPuzzles";
import { readPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import type { PublicTrainingPuzzle } from "@/lib/puzzle-training/types";

const mocks = vi.hoisted(() => ({ requireStudentPage: vi.fn(), hasPuzzleHistory: vi.fn(), getTrainingPuzzle: vi.fn(), getPuzzleDashboard: vi.fn() }));
vi.mock("@/lib/auth/requireStudentPage", () => mocks);
vi.mock("@/lib/auth/session", () => ({ sessionToStudentUser: (value: unknown) => value }));
vi.mock("@/lib/puzzle-training/server", () => mocks);
vi.mock("@/lib/puzzle-training/dashboardServer", () => mocks);
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/components/student/StudentPortalShell", () => ({ StudentPortalShell: () => null }));
vi.mock("@/components/training/PuzzleReplay", () => ({ PuzzleReplay: () => null }));
import ReplayPage from "@/app/student/training/replay/[id]/page";

const studentId = "20000000-0000-4000-8000-000000000002";
async function props(search: Record<string, string> = {}) {
  const page = await ReplayPage({ params: Promise.resolve({ id: forkPuzzle.id }), searchParams: Promise.resolve(search) });
  return (page.props.children as ReactElement<{ initialPuzzle: PublicTrainingPuzzle; backHref: string; nextHref: string | null; initialAutoAdvance: boolean }>).props;
}

describe("direct puzzle replay page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.PUZZLE_SESSION_SECRET = "test-secret-that-is-longer-than-24-characters";
    mocks.requireStudentPage.mockResolvedValue({ studentId });
    mocks.hasPuzzleHistory.mockResolvedValue(true);
    mocks.getTrainingPuzzle.mockResolvedValue(forkPuzzle);
    mocks.getPuzzleDashboard.mockResolvedValue({ replayQueue: [forkPuzzle.id, "next-missed"] });
  });

  it("prepares the playable board server-side without exposing the answer", async () => {
    const result = await props();
    expect(result.initialPuzzle.displayFen).toBeTruthy();
    expect(result.initialPuzzle).not.toHaveProperty("moves");
    expect(result.initialPuzzle).not.toHaveProperty("accepted_moves");
    expect(readPuzzleSessionToken(result.initialPuzzle.token)).toMatchObject({ studentId, dashboardReplay: true, trainingMode: "legacy" });
    expect(result.nextHref).toBe("/student/training/replay/next-missed?period=30");
    expect(result.initialAutoAdvance).toBe(false);
  });

  it("retains replay filters and auto-advance while ignoring the history page/outcome", async () => {
    const result = await props({ period: "7", theme: "fork", opening: "Italian_Game", auto: "1", outcome: "clean", page: "3" });
    expect(mocks.getPuzzleDashboard).toHaveBeenCalledWith(studentId, { period: "7", theme: "fork", opening: "Italian_Game", view: "replay", outcome: "all", page: 1 });
    expect(result.nextHref).toBe("/student/training/replay/next-missed?period=7&theme=fork&opening=Italian_Game");
    expect(result.backHref).toBe("/student/training/dashboard?period=7&view=replay&theme=fork&opening=Italian_Game");
    expect(result.initialAutoAdvance).toBe(true);
  });

  it("has no next puzzle at the end of the list", async () => {
    mocks.getPuzzleDashboard.mockResolvedValue({ replayQueue: [forkPuzzle.id] });
    expect((await props()).nextHref).toBeNull();
  });

  it("rejects another student's puzzle before loading its position", async () => {
    mocks.hasPuzzleHistory.mockResolvedValue(false);
    await expect(props()).rejects.toThrow("NOT_FOUND");
    expect(mocks.getTrainingPuzzle).not.toHaveBeenCalled();
    expect(mocks.getPuzzleDashboard).not.toHaveBeenCalled();
  });

  it("rejects retired puzzles", async () => {
    mocks.getTrainingPuzzle.mockResolvedValue(null);
    await expect(props()).rejects.toThrow("NOT_FOUND");
  });

  it("requires authentication before looking up history", async () => {
    mocks.requireStudentPage.mockRejectedValue(new Error("LOGIN_REQUIRED"));
    await expect(props()).rejects.toThrow("LOGIN_REQUIRED");
    expect(mocks.hasPuzzleHistory).not.toHaveBeenCalled();
  });
});
