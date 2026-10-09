import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudentUpdateList } from "@/components/student/StudentWhatsNewDialog";
import { getRecentStudentUpdates, studentUpdateCutoff, studentUpdates, type StudentUpdate } from "@/lib/student/whatsNew";

const note = (date: string): StudentUpdate => ({ id: date, date, category: "Feature", title: "New practice", description: "Practice here." });

describe("student what's new", () => {
  it("includes the two-month boundary and today, hides older and future entries, and orders newest first", () => {
    const result = getRecentStudentUpdates(new Date("2026-10-09T12:00:00Z"), [note("2026-08-08"), note("2026-08-09"), note("2026-10-10"), note("2026-09-01"), note("2026-10-09")]);
    expect(result.map(entry => entry.date)).toEqual(["2026-10-09", "2026-09-01", "2026-08-09"]);
  });
  it("uses two calendar months and clamps dates at shorter month ends", () => {
    expect(studentUpdateCutoff(new Date("2026-04-30T12:00:00Z"))).toBe("2026-02-28");
    expect(studentUpdateCutoff(new Date("2028-04-30T12:00:00Z"))).toBe("2028-02-29");
    expect(studentUpdateCutoff(new Date("2027-01-31T12:00:00Z"))).toBe("2026-11-30");
  });
  it("uses academy midnight so entries open on the right day", () => {
    const entries = [note("2026-10-09")];
    expect(getRecentStudentUpdates(new Date("2026-10-08T16:59:59Z"), entries)).toEqual([]);
    expect(getRecentStudentUpdates(new Date("2026-10-08T17:00:00Z"), entries)).toEqual(entries);
  });
  it("doesn't mutate the source and keeps same-day editorial order", () => {
    const entries = [note("2026-08-09"), { ...note("2026-10-09"), id: "a" }, { ...note("2026-10-09"), id: "b" }];
    expect(getRecentStudentUpdates(new Date("2026-10-09T12:00:00Z"), entries).map(entry => entry.id)).toEqual(["a", "b", "2026-08-09"]);
    expect(entries[0].date).toBe("2026-08-09");
  });
  it("shows a text-only list, with one date heading per day", () => {
    const entries = [note("2026-10-09"), { ...note("2026-10-09"), id: "second" }];
    const html = renderToStaticMarkup(createElement(StudentUpdateList, { entries }));
    expect(html.match(/<time /g)).toHaveLength(1);
    expect(html).toContain("Recent student updates");
    expect(html).not.toMatch(/<(img|svg|video|canvas)\b/);
  });
  it("has a useful empty state when all releases have aged out", () => {
    const entries = getRecentStudentUpdates(new Date("2027-01-01T12:00:00Z"));
    expect(entries).toEqual([]);
    expect(renderToStaticMarkup(createElement(StudentUpdateList, { entries }))).toContain("No new updates in the last two months");
  });
  it("keeps unique IDs, valid dates, and all four student-facing categories", () => {
    expect(new Set(studentUpdates.map(entry => entry.id)).size).toBe(studentUpdates.length);
    for (const entry of studentUpdates) {
      expect(new Date(`${entry.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(entry.date);
      expect(entry.title.trim()).not.toBe("");
      expect(entry.description.trim()).not.toBe("");
    }
    expect(new Set(studentUpdates.map(entry => entry.category))).toEqual(new Set(["Feature", "Badges", "Avatar Store", "Quest"]));
  });
});
