import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), save: vi.fn(), reductions: vi.fn(), achievements: vi.fn() }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: mocks.auth, StudentAuthenticationError: class extends Error {} }));
vi.mock("@/chess/persistence/saveCompletedGame", () => ({ saveCompletedGame: mocks.save }));
vi.mock("@/chess/persistence/halloweenAdaptationServer", () => ({ getStudentHalloweenReductions: mocks.reductions }));
vi.mock("@/lib/badges/gameAchievements/server", () => ({ scheduleGameAchievements: mocks.achievements }));
import { POST } from "@/app/api/student/chess-games/route";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

const bot = "halloween-2026-pumpkin";
function request(body = { opponentId: bot, result: "loss", studentId: "other-student" }) {
  return new Request("https://example.com/api/student/chess-games", { method: "POST", body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ studentId: "signed-in-student" });
  mocks.save.mockResolvedValue({ id: "saved-game", unlockedBotIds: [bot] });
  mocks.reductions.mockResolvedValue({ [bot]: 25 });
});
it("returns the saved student's next strength, never a supplied student ID", async () => {
  const response = await POST(request());
  expect(response.status).toBe(201);
  expect((await response.json()).halloweenReductions).toEqual({ [bot]: 25 });
  expect(mocks.save.mock.calls[0][0]).toBe("signed-in-student");
  expect(mocks.reductions).toHaveBeenCalledWith("signed-in-student");
});
it("does not turn a successful game save into a failure if the optional adjustment read fails", async () => {
  mocks.reductions.mockRejectedValue(new Error("read failed"));
  const response = await POST(request());
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ gameId: "saved-game", halloweenReductions: null });
  expect(mocks.save).toHaveBeenCalledTimes(1);
});
it("does not query adaptation for regular bots or wins", async () => {
  await POST(request({ opponentId: "pawny", result: "loss", studentId: "ignored" }));
  await POST(request({ opponentId: bot, result: "win", studentId: "ignored" }));
  expect(mocks.reductions).not.toHaveBeenCalled();
});
it("never reads difficulty before authentication and successful validation/save", async () => {
  mocks.auth.mockRejectedValueOnce(new StudentAuthenticationError());
  expect((await POST(request())).status).toBe(401);
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.save.mockRejectedValue(new Error("Invalid completed game"));
  expect((await POST(request())).status).toBe(400);
  expect(mocks.reductions).not.toHaveBeenCalled();
});
