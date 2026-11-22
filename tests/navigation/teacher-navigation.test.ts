import { describe, expect, it } from "vitest";
import { getNavigationGroups, isNavigationActive } from "@/components/navigation";

describe("teacher navigation", () => {
  it("keeps classroom essentials in the primary group", () => {
    expect(getNavigationGroups("admin")[0].links.map(link => link.href)).toEqual([
      "/admin", "/admin/students", "/admin/live-games", "/admin/tournaments", "/admin/classes"
    ]);
  });
  it("preserves every teacher destination exactly once", () => {
    const destinations = getNavigationGroups("admin").flatMap(group => group.links.map(link => link.href));
    expect(new Set(destinations).size).toBe(destinations.length);
    expect(destinations.slice().sort()).toEqual([
      "/admin", "/admin/students", "/admin/live-games", "/admin/tournaments", "/admin/classes",
      "/admin/submissions", "/admin/assessments", "/admin/leaderboard", "/admin/chess-performance",
      "/admin/adaptive-training", "/admin/chess-ratings", "/admin/studies", "/admin/activity",
      "/admin/badges", "/admin/quests", "/admin/resources", "/admin/avatar"
    ].sort());
  });
  it("opens the review group for a nested assessment review", () => {
    const activeGroup = getNavigationGroups("admin").find(group => group.links.some(link => isNavigationActive("/admin/assessments/test-123", link.href)));
    expect(activeGroup?.title).toBe("Review & progress");
  });
});
