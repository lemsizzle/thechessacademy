import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ allowed: true, tokenAllowed: false, results: [] as any[], inserts: [] as any[], deleted: [] as string[], credential: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth/adminSession", () => ({ ADMIN_SESSION_COOKIE: "admin", isValidAdminSession: async () => m.allowed, isValidAdminActionToken: async () => m.tokenAllowed }));
vi.mock("@/lib/auth/studentCredentials", () => ({ normalizeStudentUsername: (s: string) => s.trim().toLowerCase(), validateStudentUsername: (s: string) => /^[a-z0-9_-]{3,24}$/.test(s), createAcademyStudentCredential: m.credential }));
vi.mock("@/lib/students/supabaseStudentProfiles", () => ({ deleteSupabaseStudentById: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseServiceConfigured: () => true, isSupabaseProjectConfigured: () => true, getSupabaseServiceClient: () => ({ from: () => {
  let deleting = false;
  const q: any = { select: () => q, eq: (_key: string, value: string) => { if (deleting) { m.deleted.push(value); return Promise.resolve({ error: null }); } return q; }, ilike: () => q,
    maybeSingle: async () => m.results.shift(), single: async () => m.results.shift(),
    insert: (value: unknown) => { m.inserts.push(value); return q; }, delete: () => { deleting = true; return q; } }; return q;
} }) }));
import { createAdminStudent } from "@/app/admin/students/actions";
const input = { displayName: "Learner", username: " LEARNER ", password: "sample-password" };
describe("manual student creation", () => {
  beforeEach(() => { m.allowed = true; m.tokenAllowed = false; m.results = []; m.inserts = []; m.deleted = []; m.credential.mockReset(); });
  it("requires teacher authorization before database writes", async () => { m.allowed = false; expect((await createAdminStudent(input)).ok).toBe(false); expect(m.inserts).toEqual([]); });
  it("accepts the existing admin action token", async () => { m.allowed = false; m.tokenAllowed = true; m.results.push({ data: null }, { data: null }, { data: { id: "student-id" } }); expect((await createAdminStudent(input)).ok).toBe(true); });
  it("creates an active student without Lichess and only returns the username", async () => {
    m.results.push({ data: null }, { data: null }, { data: { id: "student-id" } });
    expect(await createAdminStudent(input)).toEqual({ ok: true, studentId: "student-id", username: "learner" });
    expect(m.inserts[0]).toMatchObject({ display_name: "Learner", lichess_id: null, lichess_username: null, is_active: true });
    expect(m.inserts[0]).not.toHaveProperty("password");
    expect(m.credential).toHaveBeenCalledWith("student-id", "learner", "sample-password");
  });
  it("rejects duplicates without leaving a student profile", async () => { m.results.push({ data: { student_id: "existing" } }); expect((await createAdminStudent(input)).error).toContain("already in use"); expect(m.inserts).toEqual([]); });
  it("rolls back its new profile if credential creation loses a uniqueness race", async () => { m.results.push({ data: null }, { data: null }, { data: { id: "student-id" } }); m.credential.mockRejectedValue(new Error("That username is already in use.")); expect((await createAdminStudent(input)).ok).toBe(false); expect(m.deleted).toEqual(["student-id"]); });
});
