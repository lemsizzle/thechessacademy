import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudentSession } from "@/lib/types";
const m = vi.hoisted(() => ({ results: [] as any[], updates: [] as any[] }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from: () => {
  const q: any = { select: () => q, eq: () => q, neq: () => q, is: () => q, ilike: () => q, maybeSingle: async () => m.results.shift(), update: (data: unknown) => { m.updates.push(data); return q; } }; return q;
} }) }));
import { linkAcademyLichess } from "@/lib/auth/linkAcademyLichess";
const academy = { authProvider: "academy", academyUsername: "learner", studentId: "student" } as StudentSession;
describe("Academy Lichess linking", () => {
  beforeEach(() => { m.results = []; m.updates = []; });
  it("retains the existing Academy student id when attaching a verified OAuth identity", async () => {
    m.results.push({ data: { id: "student", lichess_id: null, lichess_username: null } }, { data: null }, { data: null }, { data: { id: "student" } });
    expect(await linkAcademyLichess(academy, { id: "realname", username: "RealName" })).toBe("student");
    expect(m.updates).toEqual([{ lichess_id: "realname", lichess_username: "RealName" }]);
  });
  it("rejects another student's account", async () => { m.results.push({ data: {} }, { data: { id: "other" } }, { data: null }); await expect(linkAcademyLichess(academy, { id: "other", username: "Other" })).rejects.toThrow("already assigned"); expect(m.updates).toEqual([]); });
  it("cannot replace an existing Lichess identity", async () => { m.results.push({ data: { lichess_id: "original" } }); await expect(linkAcademyLichess(academy, { id: "other", username: "Other" })).rejects.toThrow("already linked"); });
  it("requires the teacher-assigned optional username", async () => { m.results.push({ data: { lichess_username: "AssignedName" } }); await expect(linkAcademyLichess(academy, { id: "other", username: "Other" })).rejects.toThrow("assigned by your teacher"); });
  it("rejects non-Academy sessions", async () => { await expect(linkAcademyLichess({ authProvider: "lichess" } as StudentSession, { id: "x", username: "X" })).rejects.toThrow("Academy login required"); });
});
