import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: false, student: null as null | { studentId: string }, read: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth/adminSession", () => ({ ADMIN_SESSION_COOKIE: "admin", isValidAdminSession: async () => mocks.admin, isValidAdminActionToken: async () => false }));
vi.mock("@/lib/auth/session", () => ({ readStudentSession: () => mocks.student }));
vi.mock("@/lib/quests/supabaseQuestProgress", () => ({ getSupabaseQuestTracking: mocks.read, saveSupabaseQuestTracking: vi.fn() }));
import { GET } from "@/app/api/quest-progress/route";

beforeEach(() => { mocks.admin = false; mocks.student = null; mocks.read.mockReset().mockResolvedValue({ progress: [], attempts: [], completions: [] }); });
describe("scoped quest progress", () => {
  it("loads only the teacher's selected student", async () => {
    mocks.admin = true;
    expect((await GET(new Request("http://localhost/api/quest-progress?studentId=student-b"))).status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith("student-b");
  });
  it("preserves the full teacher view when no student is selected", async () => {
    mocks.admin = true;
    await GET(new Request("http://localhost/api/quest-progress"));
    expect(mocks.read).toHaveBeenCalledWith(undefined);
  });
  it("ignores another student's id when called by a student", async () => {
    mocks.student = { studentId: "student-a" };
    await GET(new Request("http://localhost/api/quest-progress?studentId=student-b"));
    expect(mocks.read).toHaveBeenCalledWith("student-a");
  });
  it("does not query data for an unauthenticated caller", async () => {
    expect((await GET(new Request("http://localhost/api/quest-progress?studentId=student-b"))).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
