import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  canMarkHideAndSeekBoard,
  canScoreHideAndSeekBoard,
  HideAndSeekTraining,
  HideAndSeekStarExplosion,
  HIDE_AND_SEEK_EXPLOSION_MS,
  hideAndSeekRevealDelay,
  hideAndSeekResultSound,
  hideAndSeekSynchronizedStartOffset,
  isTerminalHideAndSeekFinishFailure,
  type HideAndSeekSearchPhase
} from "@/components/training/HideAndSeekTraining";

describe("Hide and Seek training UI", () => {
  it("renders a bounded, deterministic burst at each lost star without interactive elements", () => {
    const props = { squares: ["a8", "h1", "a8"] as const };
    const html = renderToStaticMarkup(createElement(HideAndSeekStarExplosion, props));
    expect(html).toBe(renderToStaticMarkup(createElement(HideAndSeekStarExplosion, props)));
    expect(html.match(/data-star-burst=/g)).toHaveLength(2);
    expect(html.match(/<path /g)).toHaveLength(16);
    expect(html).toContain('translate(50 50)');
    expect(html).toContain('translate(750 750)');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toContain('<button');
    expect(renderToStaticMarkup(createElement(HideAndSeekStarExplosion, { squares: [] }))).toBe("");
  });

  it("uses a slow finite fade, reduced-motion fallback, and cleanup after the last particle", () => {
    const css = readFileSync("components/training/HideAndSeekExplosion.module.css", "utf8");
    expect(css).toContain("2800ms");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("star-fade 180ms");
    expect(css).not.toContain("infinite");
    expect(HIDE_AND_SEEK_EXPLOSION_MS).toBeGreaterThan(2800 + 135);
  });

  it("keeps danger arrows visible for straight rook and queen attacks", () => {
    const source = readFileSync("components/training/HideAndSeekTraining.tsx", "utf8");
    expect(source).toContain('filterUnits="userSpaceOnUse"');
    expect(source).toContain('x="-1"');
    expect(source).toContain('y="-1"');
    expect(source).toContain('width="10"');
    expect(source).toContain('height="10"');
  });

  it("uses distinct Hard Mode failure and completion sounds only once the result is known", () => {
    expect(hideAndSeekResultSound({ mode: "hard", wrongCount: 1 })).toBe("explosion");
    expect(hideAndSeekResultSound({ mode: "hard", wrongCount: 0 })).toBe("victory");
    expect(hideAndSeekResultSound({ mode: "classic", wrongCount: 1 })).toBeNull();
    expect(hideAndSeekResultSound({ mode: "time_trial", wrongCount: 0 })).toBeNull();
  });

  it("keeps the board covered and the timer stopped until the student starts", () => {
    const html = renderToStaticMarkup(createElement(HideAndSeekTraining, {
      onExit: vi.fn(),
      initialBestScore: 321
    }));

    expect(html).toContain("Board hidden");
    expect(html).toContain("Start Classic Search");
    expect(html).toContain("Time Trial");
    expect(html).toContain("Hard Mode");
    expect(html).toContain("One strike");
    expect(html).toContain("60 seconds");
    expect(html).toContain("40% speed");
    expect(html).toContain("The clock starts when the pieces appear.");
    expect(html).toContain("321");
    expect(html).not.toContain("Stop &amp; Score");
    expect(html).not.toContain('aria-label="Hide and Seek chessboard"');
  });

  it("requires an active token and allows an empty automatic Time Trial finish", () => {
    expect(canMarkHideAndSeekBoard("searching")).toBe(true);
    expect(canScoreHideAndSeekBoard({ phase: "searching", token: "", selectedCount: 3 })).toBe(false);
    expect(canScoreHideAndSeekBoard({ phase: "searching", token: "active-token", selectedCount: 0 })).toBe(false);
    expect(canScoreHideAndSeekBoard({ phase: "searching", token: "active-token", selectedCount: 0, mode: "time_trial" })).toBe(true);
    expect(canScoreHideAndSeekBoard({ phase: "searching", token: "active-token", selectedCount: 3 })).toBe(true);
  });

  it("aligns the reveal with the authoritative server start time", () => {
    expect(hideAndSeekRevealDelay("2026-08-29T08:00:02.000Z", Date.parse("2026-08-29T08:00:00.500Z"))).toBe(1_500);
    expect(hideAndSeekRevealDelay("2026-08-29T08:00:02.000Z", Date.parse("2026-08-29T08:00:03.000Z"))).toBe(0);
    expect(hideAndSeekRevealDelay("not-a-date", Date.now())).toBeNull();

    expect(hideAndSeekSynchronizedStartOffset({
      startedAt: "2026-08-29T08:00:02.140Z",
      serverReceivedAt: "2026-08-29T08:00:00.040Z",
      serverSentAt: "2026-08-29T08:00:00.140Z",
      requestStartedAt: Date.parse("2026-08-29T01:00:00.000Z"),
      responseReceivedAt: Date.parse("2026-08-29T01:00:00.200Z")
    })).toBe(1_950);
    expect(hideAndSeekSynchronizedStartOffset({
      startedAt: "not-a-date",
      serverReceivedAt: "2026-08-29T08:00:00.000Z",
      serverSentAt: "2026-08-29T08:00:00.001Z",
      requestStartedAt: 1,
      responseReceivedAt: 2
    })).toBeNull();
  });

  it("locks marking outside the active search and treats finish authorization failures as terminal", () => {
    const lockedPhases: HideAndSeekSearchPhase[] = [
      "ready",
      "preparing",
      "finishing",
      "restart-required",
      "result"
    ];
    for (const phase of lockedPhases) expect(canMarkHideAndSeekBoard(phase)).toBe(false);

    expect(isTerminalHideAndSeekFinishFailure(401)).toBe(true);
    expect(isTerminalHideAndSeekFinishFailure(400)).toBe(false);
    expect(isTerminalHideAndSeekFinishFailure(503)).toBe(false);
  });
});
