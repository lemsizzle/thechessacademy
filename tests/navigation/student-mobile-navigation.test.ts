import { describe, expect, it } from "vitest";
import { getNavigationGroups, getStudentMobileMoreLinks, getStudentMobilePrimaryLinks } from "@/components/navigation";

describe("student mobile navigation", () => {
  it("keeps the four core destinations prominent", () => {
    expect(getStudentMobilePrimaryLinks().map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/student", label: "Dashboard" },
      { href: "/student/training", label: "Train" },
      { href: "/student/play", label: "Play" },
      { href: "/student/quests", label: "Quests" }
    ]);
  });

  it("places every remaining student destination under More without duplicates", () => {
    const primaryHrefs = new Set(getStudentMobilePrimaryLinks().map((link) => link.href));
    const moreHrefs = getStudentMobileMoreLinks().map((link) => link.href);
    const allDesktopHrefs = getNavigationGroups("student").flatMap((group) => group.links.map((link) => link.href));

    expect(moreHrefs).toHaveLength(new Set(moreHrefs).size);
    expect(moreHrefs.every((href) => !primaryHrefs.has(href))).toBe(true);
    expect(new Set([...primaryHrefs, ...moreHrefs])).toEqual(new Set(allDesktopHrefs));
  });
});
