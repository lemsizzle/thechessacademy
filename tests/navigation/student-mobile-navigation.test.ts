import { describe, expect, it } from "vitest";
import {
  getNavigationGroups,
  getStudentMobileMoreGroups,
  getStudentMobileMoreLinks,
  getStudentMobilePrimaryLinks,
  getStudentNavigationHubs
} from "@/components/navigation";

describe("student mobile navigation", () => {
  it("keeps the four core destinations prominent", () => {
    expect(getStudentMobilePrimaryLinks().map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/student/training", label: "Train" },
      { href: "/student/play", label: "Play" },
      { href: "/student/quests", label: "Quests" },
      { href: "/student/avatar", label: "Avatar Store" }
    ]);
    expect(getStudentMobilePrimaryLinks().find((link) => link.href === "/student/play")?.icon).toBe("▶️");
  });

  it("organizes related pages beneath the four student hubs", () => {
    const hubs = getStudentNavigationHubs();
    expect(hubs.map((hub) => hub.label)).toEqual(["Train", "Play", "Quests", "Avatar Store"]);
    expect(hubs.map((hub) => hub.branches.map((branch) => branch.label))).toEqual([
      [],
      ["Correspondence", "Tournaments"],
      [],
      []
    ]);

    const groups = getNavigationGroups("student");
    expect(groups.map((group) => group.title)).toEqual(["Train", "Play", "Quests", "Avatar Store", "More"]);
    expect(groups.at(-1)?.links.map((link) => link.label)).toEqual(["Studies", "Submit Work", "Stats", "Leaderboard", "Resources FAQ"]);
    expect(groups.flatMap((group) => group.links).some((link) => link.href === "/student")).toBe(false);
    expect(groups.flatMap((group) => group.links).some((link) => link.href === "/student/play/history")).toBe(false);
    expect(groups.flatMap((group) => group.links).some((link) => link.href === "/student/adventure")).toBe(false);
  });

  it("places every secondary destination in grouped mobile navigation without duplicates", () => {
    const primaryHrefs = new Set(getStudentMobilePrimaryLinks().map((link) => link.href));
    const moreHrefs = getStudentMobileMoreLinks().map((link) => link.href);
    const allDesktopHrefs = getNavigationGroups("student").flatMap((group) => group.links.map((link) => link.href));

    expect(getStudentMobileMoreGroups().map((group) => group.title)).toEqual(["Play", "More"]);
    expect(moreHrefs).toHaveLength(new Set(moreHrefs).size);
    expect(moreHrefs.every((href) => !primaryHrefs.has(href))).toBe(true);
    expect(new Set([...primaryHrefs, ...moreHrefs])).toEqual(new Set(allDesktopHrefs));
  });
});
