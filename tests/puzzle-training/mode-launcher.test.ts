import { describe, expect, it } from "vitest";
import {
  initialPuzzleLauncherState,
  PUZZLE_MODE_OPTIONS,
  puzzleLauncherDismissAction,
  puzzleLauncherReducer
} from "@/lib/puzzle-training/launcher";

describe("puzzle training launcher", () => {
  it("offers every existing puzzle training experience exactly once", () => {
    const ids = PUZZLE_MODE_OPTIONS.map((mode) => mode.id);

    expect(ids).toEqual(["survival", "woodpecker", "daily", "starWars", "hideAndSeek", "adaptiveReview"]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const mode of PUZZLE_MODE_OPTIONS) {
      expect(mode.name.trim()).not.toBe("");
      expect(mode.summary.trim()).not.toBe("");
      expect(mode.description.trim()).not.toBe("");
      expect(mode.startLabel.trim()).not.toBe("");
    }
  });

  it("opens on mode choices without preselecting a mode", () => {
    expect(initialPuzzleLauncherState).toEqual({
      open: true,
      screen: "choices",
      selectedMode: null
    });
  });

  it("identifies Survival mistakes as part of adaptive review", () => {
    const review = PUZZLE_MODE_OPTIONS.find((mode) => mode.id === "adaptiveReview");

    expect(review?.summary).toContain("Survival");
    expect(review?.description).toContain("Survival training");
  });

  it("moves between choices, details, stats, and the compact landing card", () => {
    const details = puzzleLauncherReducer(initialPuzzleLauncherState, {
      type: "SELECT_MODE",
      mode: "woodpecker"
    });
    expect(details).toEqual({ open: true, screen: "details", selectedMode: "woodpecker" });
    expect(puzzleLauncherReducer(details, { type: "BACK" })).toEqual(initialPuzzleLauncherState);

    const stats = puzzleLauncherReducer(initialPuzzleLauncherState, { type: "OPEN_STATS" });
    expect(stats).toEqual({ open: true, screen: "stats", selectedMode: null });
    expect(puzzleLauncherReducer(stats, { type: "CLOSE" })).toEqual({
      open: false,
      screen: "choices",
      selectedMode: null
    });
    expect(puzzleLauncherReducer(stats, { type: "OPEN_CHOICES" })).toEqual(initialPuzzleLauncherState);
  });

  it("uses dismiss as back inside a mode or stats, and only closes from the selector", () => {
    expect(puzzleLauncherDismissAction("details")).toEqual({ type: "BACK" });
    expect(puzzleLauncherDismissAction("stats")).toEqual({ type: "BACK" });
    expect(puzzleLauncherDismissAction("choices")).toEqual({ type: "CLOSE" });
  });
});
