import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ results: [] as unknown[], writes: [] as unknown[], tables: [] as string[] }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from: (table: string) => {
  db.tables.push(table);
  const q: any = { select: () => q, eq: () => q, maybeSingle: async () => db.results.shift(),
    insert: async (value: unknown) => { db.writes.push(value); return db.results.shift(); } };
  return q;
} }) }));
import { authenticateAcademyStudent, createAcademyStudentCredential, hashStudentPassword, normalizeStudentUsername, validateStudentUsername, verifyStudentPassword } from "@/lib/auth/studentCredentials";
describe("Academy credentials", () => {
  beforeEach(() => { db.results = []; db.writes = []; db.tables = []; });
  it("normalizes usernames", () => expect(normalizeStudentUsername("  Pawn_42  ")).toBe("pawn_42"));
  it.each(["ab", "a".repeat(25), "test name", "name@example.com", "école", "bad.name"])("rejects invalid username %s", (value) => expect(validateStudentUsername(value)).toBe(false));
  it.each(["abc", "a".repeat(24), "Pawn_42", "pawn-42"])("accepts valid username %s", (value) => expect(validateStudentUsername(value)).toBe(true));
  it("hashes with random salt, verifies correct passwords and rejects wrong ones", async () => {
    const a = await hashStudentPassword("sample-password"), b = await hashStudentPassword("sample-password");
    expect(a).not.toBe(b); expect(a).not.toContain("sample-password");
    expect(await verifyStudentPassword("sample-password", a)).toBe(true);
    expect(await verifyStudentPassword("wrong-password", a)).toBe(false);
    expect(await verifyStudentPassword("x", "invalid")).toBe(false);
    expect(await verifyStudentPassword("x", "AA:AA")).toBe(false);
  });
  it("enforces password bounds", async () => {
    await expect(hashStudentPassword("short")).rejects.toThrow("at least 8");
    await expect(hashStudentPassword("x".repeat(257))).rejects.toThrow("at most 256");
  });
  it("authenticates an active student without any Lichess identity", async () => {
    db.results.push({ data: { student_id: "student", password_hash: await hashStudentPassword("sample-password") } }, { data: { id: "student", display_name: "Learner", public_slug: "learner", is_active: true } });
    expect(await authenticateAcademyStudent(" LEARNER ", "sample-password")).toEqual({ studentId: "student", displayName: "Learner", publicSlug: "learner", username: "learner" });
  });
  it("denies inactive or deleted students", async () => {
    db.results.push({ data: { student_id: "student", password_hash: await hashStudentPassword("sample-password") } }, { data: null });
    expect(await authenticateAcademyStudent("learner", "sample-password")).toBeNull();
  });
  it("denies unknown users and wrong passwords", async () => {
    db.results.push({ data: null }); expect(await authenticateAcademyStudent("unknown", "sample-password")).toBeNull();
    db.results.push({ data: { password_hash: await hashStudentPassword("sample-password") } });
    expect(await authenticateAcademyStudent("learner", "wrong-password")).toBeNull();
  });
  it("handles database uniqueness races without storing plaintext", async () => {
    db.results.push({ error: { code: "23505" } });
    await expect(createAcademyStudentCredential("student", " LEARNER ", "sample-password")).rejects.toThrow("already in use");
    expect(db.writes[0]).toMatchObject({ username: "learner", must_change_password: false });
    expect(JSON.stringify(db.writes)).not.toContain("sample-password");
  });
});
