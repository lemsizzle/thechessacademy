import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PuzzleDashboard } from "@/components/training/PuzzleDashboard";
import { buildPuzzleDashboard, dashboardHref, dashboardSince, parseDashboardQuery, type DashboardAttempt } from "@/lib/puzzle-training/dashboard";

const now = Date.parse("2026-10-05T10:00:00Z");
const query = parseDashboardQuery({});
function attempt(id: number, overrides: Partial<DashboardAttempt> = {}): DashboardAttempt {
  return { id: String(id), puzzleId: `p${id}`, attemptedAt: "2026-10-04T10:00:00Z", solved: true, clean: true, seconds: 20,
    mode: "survival", rating: 1200, themes: ["fork", "short"], openings: ["Italian_Game"], active: true, ...overrides };
}

describe("puzzle dashboard", () => {
  it("normalizes untrusted query parameters and builds encoded navigation links", () => {
    expect(parseDashboardQuery({ period: "bad", view: "bad", page: "-3", theme: "x<script>", opening: "x".repeat(200) })).toMatchObject({ period: "30", view: "overview", page: 1, theme: "", opening: "x".repeat(160) });
    expect(dashboardHref(query, { view: "history", opening: "King's Gambit & test", page: 2 })).toContain("opening=King%27s+Gambit+%26+test&page=2");
    expect(dashboardSince("7", now)).toBe("2026-09-28T10:00:00.000Z");
    expect(dashboardSince("all", now)).toBeNull();
  });

  it("counts clean, helped, missed and unrated attempts honestly", () => {
    const data = buildPuzzleDashboard([
      attempt(1), attempt(2, { clean: false, rating: 2000 }), attempt(3, { solved: false, clean: false }), attempt(4, { rating: null })
    ], new Map(), query, now);
    expect(data).toMatchObject({ played: 4, solved: 3, clean: 2, accuracy: 50, solvedLevel: 1200, seconds: 80, toReplay: 2 });
    expect(data.themes[0]).toMatchObject({ played: 4, clean: 2, accuracy: 50 });
    expect(data.openings[0].name).toBe("Italian Game");
  });

  it("handles rolling period boundaries, future and invalid dates", () => {
    const data = buildPuzzleDashboard([
      attempt(1, { attemptedAt: dashboardSince("30", now)! }), attempt(2, { attemptedAt: "2026-01-01T00:00:00Z" }),
      attempt(3, { attemptedAt: "invalid" }), attempt(4, { attemptedAt: "2027-01-01T00:00:00Z" })
    ], new Map(), query, now);
    expect(data.played).toBe(1);
  });

  it("deduplicates replay puzzles and respects later clean training attempts and replays", () => {
    const rows = [attempt(1, { clean: false }), attempt(2, { puzzleId: "p1", clean: false, attemptedAt: "2026-10-03T10:00:00Z" })];
    expect(buildPuzzleDashboard(rows, new Map(), query, now).toReplay).toBe(1);
    expect(buildPuzzleDashboard(rows, new Map([["p1", "2026-10-04T11:00:00Z"]]), query, now).toReplay).toBe(0);
    expect(buildPuzzleDashboard(rows, new Map([["p1", "2026-10-03T11:00:00Z"]]), query, now).toReplay).toBe(1);
    expect(buildPuzzleDashboard([...rows, attempt(3, { puzzleId: "p1", attemptedAt: "2026-10-05T09:00:00Z" })], new Map(), query, now).toReplay).toBe(0);
  });

  it("excludes retired puzzles from replay but retains history", () => {
    const data = buildPuzzleDashboard([attempt(1, { active: false, clean: false })], new Map(), query, now);
    expect(data.toReplay).toBe(0);
    expect(data.played).toBe(1);
  });

  it("filters and paginates history without altering the overall metrics", () => {
    const rows = Array.from({ length: 27 }, (_, id) => attempt(id, { clean: false }));
    const data = buildPuzzleDashboard(rows, new Map(), { ...query, view: "replay", theme: "fork", outcome: "helped", page: 999 }, now);
    expect(data).toMatchObject({ played: 27, historyCount: 27, pageCount: 3, query: { page: 3 } });
    expect(data.history).toHaveLength(3);
    expect(buildPuzzleDashboard(rows, new Map(), { ...query, opening: "absent" }, now).historyCount).toBe(0);
  });

  it("does not double count duplicate theme tags", () => {
    expect(buildPuzzleDashboard([attempt(1, { themes: ["fork", "fork"] })], new Map(), query, now).themes[0].played).toBe(1);
  });

  it("renders accessible chart, learning notes, and safe navigation", () => {
    const rows = Array.from({ length: 6 }, (_, id) => attempt(id, { themes: ["fork", "pin", "skewer"], clean: id !== 0 }));
    const html = renderToStaticMarkup(createElement(PuzzleDashboard, { data: buildPuzzleDashboard(rows, new Map(), query, now) }));
    expect(html).toContain('aria-label="Puzzle dashboard"');
    expect(html).toContain("Your puzzle skill map");
    expect(html).toContain("Fork: 83% from 6 attempts");
    expect(html).toContain("not your playing rating");
    expect(html).toContain("From my games");
    expect(html).not.toContain("NaN");
  });

  it("shows encouraging empty states and never fabricates a skill rating", () => {
    const data = buildPuzzleDashboard([], new Map(), query, now);
    expect(data.solvedLevel).toBeNull();
    const html = renderToStaticMarkup(createElement(PuzzleDashboard, { data }));
    expect(html).toContain("Your next move starts your story");
    expect(html).toContain("Your skill map is growing");
  });

  it("requires meaningful samples for strengths and improvement suggestions", () => {
    const data = buildPuzzleDashboard([attempt(1, { clean: false })], new Map(), { ...query, view: "improve" }, now);
    const html = renderToStaticMarkup(createElement(PuzzleDashboard, { data }));
    expect(html).toContain("Keep exploring!");
  });

  it("suggests fresh training after every mistake in the focus theme has been cleared", () => {
    const rows = Array.from({ length: 6 }, (_, id) => attempt(id, { themes: ["fork"], clean: id !== 0 }));
    const data = buildPuzzleDashboard(rows, new Map([["p0", "2026-10-05T09:00:00Z"]]), query, now);
    const html = renderToStaticMarkup(createElement(PuzzleDashboard, { data }));
    expect(html).toMatch(/href="\/student\/training\?theme=fork">Choose some puzzles/);
  });
});
