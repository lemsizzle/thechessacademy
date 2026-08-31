import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STORY_SCENES } from "@/adventure/content";
import { createNewAdventureProgress } from "@/adventure/localProgress";
import { enterAdventureScene, isAdventureHotspotVisible } from "@/adventure/sceneHotspots";
import type { AdventureSceneRuntimeState } from "@/adventure/types";

function houseState(storyFlags: Record<string, boolean> = {}): AdventureSceneRuntimeState {
  return {
    chapterComplete: false,
    completedChallengeIds: [],
    difficulty: null,
    storyFlags,
    visitedSceneIds: ["house"]
  };
}

function visibleHouseHotspotIds(state: AdventureSceneRuntimeState) {
  return (STORY_SCENES.house.hotspots ?? [])
    .filter((hotspot) => isAdventureHotspotVisible(hotspot, state))
    .map((hotspot) => hotspot.id)
    .sort();
}

describe("The Ransacked House", () => {
  it("uses the final WebP and the editor-measured rectangles", () => {
    expect(STORY_SCENES.house.backgroundImage).toBe("/adventure/scenes/ransacked-house.webp");
    expect(existsSync(join(process.cwd(), "public/adventure/scenes/ransacked-house.webp"))).toBe(true);

    const hotspots = STORY_SCENES.house.hotspots ?? [];
    expect(hotspots.find((hotspot) => hotspot.id === "lemicus-book")).toMatchObject({ x: 9, y: 67.3, width: 22.6, height: 32.3 });
    expect(hotspots.find((hotspot) => hotspot.id === "dads-chess-set")).toMatchObject({ x: 42.2, y: 55.2, width: 35.8, height: 38 });
    expect(hotspots.find((hotspot) => hotspot.id === "family-portrait")).toMatchObject({ x: 86.2, y: 35.6, width: 11.1, height: 31.6 });
  });

  it("allows either required discovery first while keeping the portrait optional", () => {
    expect(visibleHouseHotspotIds(houseState())).toEqual(["dads-chess-set", "family-portrait", "lemicus-book"]);
    expect(visibleHouseHotspotIds(houseState({ inspected_dads_chess_set: true }))).toEqual(["dads-chess-set-repeat", "family-portrait", "lemicus-book"]);
    expect(visibleHouseHotspotIds(houseState({ met_lem: true }))).toEqual(["dads-chess-set", "family-portrait", "lemicus-book-repeat"]);
  });

  it("unlocks the restoration conversation only after both discoveries", () => {
    const ready = houseState({ met_lem: true, inspected_dads_chess_set: true });
    const explained = houseState({ met_lem: true, inspected_dads_chess_set: true, army_restoration_explained: true });

    expect(visibleHouseHotspotIds(ready)).toEqual(["dads-chess-set-repeat", "family-portrait", "lemicus-book-ready"]);
    expect(visibleHouseHotspotIds(explained)).toEqual(["dads-chess-set-repeat", "family-portrait", "lemicus-book-after-plan"]);
    expect(STORY_SCENES.house.next).toBeUndefined();
    expect(STORY_SCENES.house.hotspots?.find((hotspot) => hotspot.id === "lemicus-book-ready")?.action).toEqual({ type: "dialogue", dialogueId: "house-can-we-fix" });
  });

  it("sets discovery flags at the end of their first-time dialogue sequences", () => {
    const fresh = createNewAdventureProgress();
    const metLem = enterAdventureScene(fresh, STORY_SCENES["house-lem-met"]);
    const inspected = enterAdventureScene(metLem, STORY_SCENES["house-chess-set-fought"]);
    const explained = enterAdventureScene(inspected, STORY_SCENES["house-army-rule"]);

    expect(metLem.storyFlags).toEqual({ met_lem: true });
    expect(inspected.storyFlags).toEqual({ met_lem: true, inspected_dads_chess_set: true });
    expect(explained.storyFlags).toEqual({ met_lem: true, inspected_dads_chess_set: true, army_restoration_explained: true });
  });

  it("keeps first and repeat interactions distinct", () => {
    const hotspots = STORY_SCENES.house.hotspots ?? [];
    expect(hotspots.find((hotspot) => hotspot.id === "lemicus-book")?.action).toEqual({ type: "dialogue", dialogueId: "house-lem-pickup" });
    expect(hotspots.find((hotspot) => hotspot.id === "lemicus-book-repeat")?.action).toEqual({ type: "dialogue", dialogueId: "house-lem-repeat" });
    expect(hotspots.find((hotspot) => hotspot.id === "dads-chess-set")?.action).toEqual({ type: "dialogue", dialogueId: "house-chess-set-board" });
    expect(hotspots.find((hotspot) => hotspot.id === "dads-chess-set-repeat")?.action.type).toBe("inspect");
    expect(hotspots.find((hotspot) => hotspot.id === "family-portrait")?.action.type).toBe("inspect");
  });

  it("explains the army rule before entering the existing difficulty branch", () => {
    expect(STORY_SCENES["house-can-we-fix"].text).toBe("Can we fix them?");
    expect(STORY_SCENES["house-lem-maybe"].text).toBe("Maybe.");
    expect(STORY_SCENES["house-army-rule"].next).toBe("difficulty");
    expect(STORY_SCENES.difficulty.choices?.map((choice) => choice.difficulty)).toEqual(["beginner", "pieces", "some", "experienced"]);
    expect(STORY_SCENES.difficulty.choices?.[0].next).toBe("pip-awakens-intro");
    expect(STORY_SCENES.difficulty.choices?.slice(1).every((choice) => choice.next === "pieces-ready")).toBe(true);
  });
});
