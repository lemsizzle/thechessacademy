import { beforeEach, expect, it, vi } from "vitest";
const { active, redirect } = vi.hoisted(() => ({ active: vi.fn(), redirect: vi.fn(() => { throw new Error("login redirect"); }) }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: active, StudentAuthenticationError: class extends Error {} }));
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { requireStudentPage } from "@/lib/auth/requireStudentPage";
beforeEach(() => vi.clearAllMocks());
it("sends missing or expired student sessions to login", async () => {
  active.mockRejectedValue(new StudentAuthenticationError("expired"));
  await expect(requireStudentPage()).rejects.toThrow("login redirect");
  expect(redirect).toHaveBeenCalledWith("/login");
});
it("preserves verified identity", async () => {
  const session = { studentId: "student-one" };
  active.mockResolvedValue(session);
  expect(await requireStudentPage()).toBe(session);
});
it("does not turn database outages into login loops", async () => {
  active.mockRejectedValue(new Error("database unavailable"));
  await expect(requireStudentPage()).rejects.toThrow("database unavailable");
  expect(redirect).not.toHaveBeenCalled();
});
