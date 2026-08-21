import { describe, expect, it } from "vitest";
import { resolveStudyAccessRole, studyRoleAllows } from "@/chess/analysis/permissions";

describe("study permissions", () => {
  const owner = { kind: "student" as const, studentId: "student-a", name: "A" };
  const other = { kind: "student" as const, studentId: "student-b", name: "B" };
  const admin = { kind: "admin" as const };

  it("allows owners and admins to manage a study", () => {
    expect(resolveStudyAccessRole(owner, "student-a", null)).toBe("owner");
    expect(resolveStudyAccessRole(admin, "student-a", null)).toBe("owner");
    expect(studyRoleAllows("owner", "delete")).toBe(true);
  });

  it("allows editors to save but not delete", () => {
    const role = resolveStudyAccessRole(other, "student-a", "editor");
    expect(studyRoleAllows(role, "write")).toBe(true);
    expect(studyRoleAllows(role, "delete")).toBe(false);
  });

  it("denies cross-student access without membership", () => {
    const role = resolveStudyAccessRole(other, "student-a", null);
    expect(studyRoleAllows(role, "read")).toBe(false);
    expect(studyRoleAllows(role, "write")).toBe(false);
  });

  it("keeps viewers read-only", () => {
    const role = resolveStudyAccessRole(other, "student-a", "viewer");
    expect(studyRoleAllows(role, "read")).toBe(true);
    expect(studyRoleAllows(role, "write")).toBe(false);
    expect(studyRoleAllows(role, "delete")).toBe(false);
  });
});
