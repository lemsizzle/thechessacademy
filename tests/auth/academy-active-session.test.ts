import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ session: {} as any, results: [] as unknown[], filters: [] as unknown[] }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/auth/session", () => ({ readStudentSession: () => mock.session }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from: () => {
  const q: any = { select: () => q, eq: (...args: unknown[]) => { mock.filters.push(args); return q; }, maybeSingle: async () => mock.results.shift() }; return q;
} }) }));
import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";
describe("provider-aware active student validation", () => {
  beforeEach(() => { mock.session = { studentId: "11111111-1111-4111-8111-111111111111", onboardingCompleted: true, authProvider: "academy", academyUsername: "learner" }; mock.results = []; mock.filters = []; });
  it("accepts Academy identity without Lichess, checking active status and credential ownership", async () => {
    mock.results.push({ data: { id: mock.session.studentId, lichess_id: null, lichess_username: null } }, { data: { student_id: mock.session.studentId } });
    expect(await requireActiveStudent()).toBe(mock.session);
    expect(mock.filters).toContainEqual(["is_active", true]); expect(mock.filters).toContainEqual(["username", "learner"]);
  });
  it("rejects missing/inactive profiles", async () => { mock.results.push({ data: null }); await expect(requireActiveStudent()).rejects.toThrow(); });
  it("rejects revoked Academy credentials", async () => { mock.results.push({ data: {} }, { data: null }); await expect(requireActiveStudent()).rejects.toThrow("no longer exists"); });
  it.each([undefined, "lichess"])("validates legacy and explicit Lichess sessions (%s)", async (provider) => {
    mock.session = { ...mock.session, authProvider: provider, lichessUserId: "real-id", lichessUsername: "RealName" };
    mock.results.push({ data: { lichess_id: "real-id", lichess_username: "RealName" } });
    expect(await requireActiveStudent()).toBe(mock.session);
    mock.results.push({ data: { lichess_id: "other-id", lichess_username: "OtherName" } });
    await expect(requireActiveStudent()).rejects.toThrow("does not match");
  });
  it("does not treat a prefixed Lichess id as Academy authentication", async () => {
    mock.session = { ...mock.session, authProvider: undefined, lichessUserId: "academy:forged", lichessUsername: "academy:learner" };
    mock.results.push({ data: { lichess_id: null, lichess_username: null } }); await expect(requireActiveStudent()).rejects.toThrow("does not match");
  });
});
