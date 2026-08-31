import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADVENTURE_CHALLENGES,
  ADVENTURE_ENCOUNTER_START_SCENES,
  STORY_SCENES
} from "@/adventure/content";
import { createNewAdventureProgress } from "@/adventure/localProgress";
import {
  enterAdventureScene,
  isAdventureHotspotDisabled,
  isAdventureHotspotEditorEnabled,
  isAdventureHotspotInBounds,
  isAdventureHotspotVisible
} from "@/adventure/sceneHotspots";
import { AdventureSceneImage, containedArtworkRect } from "@/components/adventure/AdventureSceneImage";
import type { AdventureScene, AdventureSceneRuntimeState } from "@/adventure/types";

const runtimeState: AdventureSceneRuntimeState = {
  chapterComplete: false,
  completedChallengeIds: [],
  difficulty: null,
  storyFlags: {},
  visitedSceneIds: ["arrival"]
};

describe("Adventure scene hotspots", () => {
  it("keeps every hotspot inside percentage bounds and every action target valid", () => {
    for (const scene of Object.values(STORY_SCENES)) {
      const ids = (scene.hotspots ?? []).map((hotspot) => hotspot.id);
      expect(new Set(ids).size, `${scene.id} should not repeat a hotspot id`).toBe(ids.length);

      for (const hotspot of scene.hotspots ?? []) {
        expect(isAdventureHotspotInBounds(hotspot), `${scene.id}/${hotspot.id} should fit the artwork`).toBe(true);
        switch (hotspot.action.type) {
          case "gotoScene":
            expect(STORY_SCENES[hotspot.action.sceneId]).toBeDefined();
            break;
          case "dialogue":
            expect(STORY_SCENES[hotspot.action.dialogueId]).toBeDefined();
            break;
          case "startChallenge":
            expect(ADVENTURE_CHALLENGES[hotspot.action.challengeId]).toBeDefined();
            break;
          case "startEncounter":
            expect(STORY_SCENES[ADVENTURE_ENCOUNTER_START_SCENES[hotspot.action.encounterId]]).toBeDefined();
            break;
          case "inspect":
            expect(hotspot.action.title.length).toBeGreaterThan(0);
            expect(hotspot.action.description.length).toBeGreaterThan(0);
            break;
        }
      }
    }
  });

  it("wires interactive artwork into the four requested Chapter 1 locations", () => {
    for (const sceneId of ["arrival", "house", "rookus-intro", "boss-setup"]) {
      expect(STORY_SCENES[sceneId].backgroundImage).toMatch(/^\/adventure\/scenes\//);
      expect(STORY_SCENES[sceneId].backgroundAlt).toBeTruthy();
      expect(STORY_SCENES[sceneId].hotspots?.length).toBeGreaterThanOrEqual(2);
      expect(existsSync(join(process.cwd(), "public", STORY_SCENES[sceneId].backgroundImage?.slice(1) ?? ""))).toBe(true);
    }
  });

  it("uses existing progress facts for visible and disabled conditions", () => {
    const chessBefore = STORY_SCENES.house.hotspots?.find((hotspot) => hotspot.id === "dads-chess-set");
    const chessRepeat = STORY_SCENES.house.hotspots?.find((hotspot) => hotspot.id === "dads-chess-set-repeat");
    const homeBefore = STORY_SCENES.arrival.hotspots?.find((hotspot) => hotspot.id === "player-home-before");
    const homeAfter = STORY_SCENES.arrival.hotspots?.find((hotspot) => hotspot.id === "player-home");
    const roadForward = STORY_SCENES["rookus-intro"].hotspots?.find((hotspot) => hotspot.id === "road-forward");
    if (!chessBefore || !chessRepeat || !homeBefore || !homeAfter || !roadForward) throw new Error("Expected conditioned sample hotspots");

    expect(isAdventureHotspotVisible(chessBefore, runtimeState)).toBe(true);
    expect(isAdventureHotspotVisible(chessRepeat, runtimeState)).toBe(false);
    expect(isAdventureHotspotVisible(chessBefore, { ...runtimeState, storyFlags: { inspected_dads_chess_set: true } })).toBe(false);
    expect(isAdventureHotspotVisible(chessRepeat, { ...runtimeState, storyFlags: { inspected_dads_chess_set: true } })).toBe(true);
    expect(isAdventureHotspotVisible(homeBefore, runtimeState)).toBe(true);
    expect(isAdventureHotspotVisible(homeAfter, runtimeState)).toBe(false);
    expect(isAdventureHotspotVisible(homeBefore, { ...runtimeState, storyFlags: { learned_dad_was_taken: true } })).toBe(false);
    expect(isAdventureHotspotVisible(homeAfter, { ...runtimeState, storyFlags: { learned_dad_was_taken: true } })).toBe(true);
    expect(isAdventureHotspotDisabled(roadForward, runtimeState)).toBe(true);
    expect(isAdventureHotspotDisabled(roadForward, { ...runtimeState, completedChallengeIds: ["fundamentals-combat"] })).toBe(false);
  });

  it("records visits and scene flags through the existing progress transition", () => {
    const progress = createNewAdventureProgress();
    const entered = enterAdventureScene(progress, STORY_SCENES["marge-greeting"]);
    expect(entered.currentSceneId).toBe("marge-greeting");
    expect(entered.visitedSceneIds).toContain("marge-greeting");
    expect(entered.storyFlags.met_marge).toBe(true);
  });

  it("maps hotspots to the contained artwork instead of letterbox bars", () => {
    expect(containedArtworkRect(1600, 900)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(containedArtworkRect(1000, 1000)).toEqual({ x: 21.875, y: 0, width: 56.25, height: 100 });
    const wideArtwork = containedArtworkRect(2000, 800);
    expect(wideArtwork.x).toBe(0);
    expect(wideArtwork.width).toBe(100);
    expect(wideArtwork.y).toBeCloseTo(14.4444, 4);
    expect(wideArtwork.height).toBeCloseTo(71.1111, 4);
  });

  it("renders accessible controls, a no-art fallback, and no production editor", () => {
    const scene: AdventureScene = {
      id: "test-scene",
      background: "road",
      speaker: "Narrator",
      portrait: "narrator",
      text: "Test",
      hotspots: [{ id: "inspect", label: "Inspect the sign", x: 10, y: 10, width: 20, height: 20, action: { type: "inspect", title: "Sign", description: "A sign." } }]
    };
    const markup = renderToStaticMarkup(createElement(AdventureSceneImage, {
      scene,
      runtimeState,
      interactionLocked: true,
      developerTools: false,
      portrait: createElement("span", null, "portrait"),
      avatar: createElement("span", null, "avatar"),
      onAction: () => undefined
    }));

    expect(markup).toContain("data-scene-fallback=\"true\"");
    expect(markup).toContain("data-hotspot-id=\"inspect\"");
    expect(markup).toContain("aria-label=\"Inspect the sign\"");
    expect(markup).toContain("disabled=\"\"");
    expect(markup).not.toContain("Edit hotspots");
  });

  it("gates hotspot authoring helpers to development", () => {
    expect(isAdventureHotspotEditorEnabled("development")).toBe(true);
    expect(isAdventureHotspotEditorEnabled("production")).toBe(false);
    expect(isAdventureHotspotEditorEnabled(undefined)).toBe(false);
  });
});
