import { describe, expect, it } from "vitest";
import { isNavigationActive } from "@/components/navigation";

describe("navigation active routes", () => {
  it("does not highlight root destinations on unrelated pages", () => {
    expect(isNavigationActive("/app/resources", "/app")).toBe(false);
    expect(isNavigationActive("/admin/students", "/admin")).toBe(false);
    expect(isNavigationActive("/student/training", "/student")).toBe(false);
    expect(isNavigationActive("/app", "/app")).toBe(true);
  });

  it("keeps nested pages in their section without matching partial names", () => {
    expect(isNavigationActive("/student/play/live/123", "/student/play")).toBe(true);
    expect(isNavigationActive("/student/playground", "/student/play")).toBe(false);
    expect(isNavigationActive("/admin/students/duplicates", "/admin/students")).toBe(true);
  });

  it("distinguishes Stats from Home and ignores unrelated query parameters", () => {
    expect(isNavigationActive("/student", "/student?progress=overview", "progress=overview&source=nav")).toBe(true);
    expect(isNavigationActive("/student", "/student?progress=overview", "progress=games")).toBe(false);
    expect(isNavigationActive("/student", "/student?progress=overview")).toBe(false);
    expect(isNavigationActive("/student", "/student", "progress=overview")).toBe(false);
    expect(isNavigationActive("/student", "/student", "source=nav")).toBe(true);
  });
});
