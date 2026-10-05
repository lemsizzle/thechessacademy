import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { STUDENT_SESSION_KEY, STUDENT_SESSION_USER_KEY } from "@/lib/auth/roles";
import type { StudentUser } from "@/lib/types";
const { clearDrafts } = vi.hoisted(() => ({ clearDrafts: vi.fn() }));
vi.mock("@/chess/analysis/studyDraftSession", () => ({ clearStudyDraftsOnLogout: clearDrafts }));
import { clearCurrentStudentUser, getCurrentStudentUser, setCurrentStudentUserRecord } from "@/lib/auth/getCurrentUser";
let storage: Map<string, string>;
const user = (id: string): StudentUser => ({ id, studentId: id, name: "QA", email: "qa@example.invalid", role: "student" });
beforeEach(() => {
  vi.clearAllMocks(); storage = new Map();
  vi.stubGlobal("window", { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); }
  } });
});
afterEach(() => vi.unstubAllGlobals());
it("clearing an unavailable session cache does not delete recovery copies", () => {
  setCurrentStudentUserRecord(user("alice"));
  clearCurrentStudentUser();
  expect(getCurrentStudentUser()).toBeNull();
  expect(storage.has(STUDENT_SESSION_KEY)).toBe(false);
  expect(storage.has(STUDENT_SESSION_USER_KEY)).toBe(false);
  expect(clearDrafts).not.toHaveBeenCalled();
});
it("an explicit logout clears recovery before leaving the shared browser", () => {
  setCurrentStudentUserRecord(user("alice"));
  clearCurrentStudentUser({ logout: true });
  expect(clearDrafts).toHaveBeenCalledOnce();
  expect(getCurrentStudentUser()).toBeNull();
});
it("refreshing the same verified account preserves drafts; switching accounts clears them", () => {
  setCurrentStudentUserRecord(user("alice")); setCurrentStudentUserRecord(user("alice"));
  expect(clearDrafts).not.toHaveBeenCalled();
  setCurrentStudentUserRecord(user("bob"));
  expect(clearDrafts).toHaveBeenCalledOnce();
  expect(getCurrentStudentUser()?.id).toBe("bob");
});
it("denied browser storage cannot break server authentication or logout", () => {
  vi.stubGlobal("window", { get localStorage() { throw new Error("storage denied"); } });
  expect(() => setCurrentStudentUserRecord(user("alice"))).not.toThrow();
  expect(() => clearCurrentStudentUser({ logout: true })).not.toThrow();
  expect(clearDrafts).toHaveBeenCalledOnce();
  expect(getCurrentStudentUser()).toBeNull();
});
