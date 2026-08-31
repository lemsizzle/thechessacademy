import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADVENTURE_CHALLENGES, CHALLENGE_NEXT_SCENE, KNOWLEDGE_ENTRIES, STORY_SCENES } from "@/adventure/content";
import { applyAdventureChallengeCompletion, createNewAdventureProgress } from "@/adventure/localProgress";
import { enterAdventureScene, isAdventureHotspotVisible } from "@/adventure/sceneHotspots";
import type { AdventureSceneRuntimeState } from "@/adventure/types";

function pipState(completed = false): AdventureSceneRuntimeState {
  return {
    chapterComplete: false,
    completedChallengeIds: completed ? ["learn-pawn"] : [],
    difficulty: "beginner",
    storyFlags: completed ? { met_pip: true, learned_pawn_movement: true, pawns_restored: true } : { met_pip: true },
    visitedSceneIds: ["pip-awakens"]
  };
}

describe("Scene 3 · Pip Awakens", () => {
  it("routes only Complete Beginner through Pip Awakens", () => {
    const choices = STORY_SCENES.difficulty.choices ?? [];
    expect(choices[0]).toMatchObject({ difficulty: "beginner", next: "pip-awakens-intro" });
    expect(choices.slice(1).map((choice) => choice.difficulty)).toEqual(["pieces", "some", "experienced"]);
    expect(choices.slice(1).every((choice) => choice.next === "pieces-ready")).toBe(true);
  });

  it("uses the final WebP and editor-measured, non-overlapping targets", () => {
    const scene = STORY_SCENES["pip-awakens"];
    expect(scene.backgroundImage).toBe("/adventure/scenes/pip-awakens.webp");
    expect(scene.hideArtworkOverlays).toBe(true);
    expect(existsSync(join(process.cwd(), "public/adventure/scenes/pip-awakens.webp"))).toBe(true);

    const hotspots = scene.hotspots ?? [];
    expect(hotspots.find((hotspot) => hotspot.id === "pip-before-training")).toMatchObject({ x: 55.8, y: 41.8, width: 13.7, height: 29 });
    expect(hotspots.find((hotspot) => hotspot.id === "lem-before-training")).toMatchObject({ x: 8.5, y: 60, width: 23.5, height: 37 });
    expect(hotspots.find((hotspot) => hotspot.id === "army-before-training")).toMatchObject({ x: 43.2, y: 52.2, width: 13.9, height: 19 });
    expect(hotspots.filter((hotspot) => isAdventureHotspotVisible(hotspot, pipState())).map((hotspot) => hotspot.label).sort()).toEqual(["Inspect Dad's army", "Talk to Lem", "Talk to Pip"]);
  });

  it("locks exploration behind the short first-entry conversation and records met_pip", () => {
    const sequence = ["pip-awakens-intro", "pip-awakens-stirs", "pip-awakens-boast", "pip-awakens-cracked", "pip-awakens-counts"];
    expect(sequence.every((sceneId) => !(STORY_SCENES[sceneId].hotspots?.length))).toBe(true);
    expect(STORY_SCENES["pip-awakens-boast"].text).toBe("I CAN STILL FIGHT!");
    expect(STORY_SCENES["pip-awakens-cracked"].text).toBe("You are cracked in three places.");
    expect(STORY_SCENES["pip-awakens-counts"].text).toBe("Still counts.");
    expect(STORY_SCENES["pip-awakens-counts"].next).toBe("pip-awakens");

    const metPip = enterAdventureScene(createNewAdventureProgress(), STORY_SCENES["pip-awakens-counts"]);
    expect(metPip.storyFlags.met_pip).toBe(true);
  });

  it("offers Pawn Training from Pip without blocking the other interactions", () => {
    expect(STORY_SCENES["pip-awakens"].next).toBeUndefined();
    expect(STORY_SCENES["pip-lesson-offer"].text).toBe("Come on! Let's get moving!");
    expect(STORY_SCENES["pip-lesson-offer"].choices).toEqual([
      { label: "Learn how Pawns move", next: "learn-pawn-intro" },
      { label: "Look around first", next: "pip-awakens" }
    ]);
    expect(STORY_SCENES["learn-pawn-intro"].next).toBe("learn-pawn");
    expect(STORY_SCENES["learn-pawn"].challengeId).toBe("learn-pawn");
  });

  it("retains all eight Lichess Pawn exercises", () => {
    const challenge = ADVENTURE_CHALLENGES["learn-pawn"];
    expect(challenge.title).toBe("Pawn Training");
    expect(challenge.puzzles.map((puzzle) => puzzle.id)).toEqual([
      "pawn-1", "pawn-2", "pawn-3", "pawn-4", "pawn-5", "pawn-6", "pawn-7", "pawn-8"
    ]);
    expect(challenge.puzzles.map((puzzle) => puzzle.starTrail?.parMoves)).toEqual([4, 8, 4, 8, 8, 7, 3, 9]);
    expect(challenge.puzzles.every((puzzle) => puzzle.starTrail?.piece === "pawn")).toBe(true);
    expect(challenge.puzzles[0].concept).toContain("final rank");
    expect(challenge.puzzles[2].concept).toContain("capture one square diagonally");
    expect(challenge.puzzles[6].concept).toContain("two clear squares");
  });

  it("sets restoration flags, unlocks Knowledge, and applies the local reward only once", () => {
    const challenge = ADVENTURE_CHALLENGES["learn-pawn"];
    const first = applyAdventureChallengeCompletion(createNewAdventureProgress(), challenge);
    const repeated = applyAdventureChallengeCompletion(first, challenge);

    expect(first.completedChallengeIds).toContain("learn-pawn");
    expect(first.unlockedKnowledgeIds).toContain("pawn");
    expect(first.storyFlags).toMatchObject({ learned_pawn_movement: true, pawns_restored: true });
    expect(first.prototypeCoins).toBe(5);
    expect(repeated.prototypeCoins).toBe(5);
    expect(repeated.completedChallengeIds.filter((id) => id === "learn-pawn")).toHaveLength(1);
  });

  it("returns to the scene for a brief restoration, then points to Rook training", () => {
    expect(CHALLENGE_NEXT_SCENE["learn-pawn"]).toBe("pawns-restored");
    expect(STORY_SCENES["pawns-restored"].restoration).toEqual({ title: "PAWNS RESTORED", durationMs: 1800 });
    expect(STORY_SCENES["pawns-restored"].next).toBe("pawns-restored-pip");
    expect(STORY_SCENES["pawns-restored-pip"].next).toBe("pawns-restored-lem");
    expect(STORY_SCENES["pawns-restored-lem"].next).toBe("learn-rook-intro");
  });

  it("switches all three revisit interactions instead of replaying the introduction", () => {
    const scene = STORY_SCENES["pip-awakens"];
    const before = (scene.hotspots ?? []).filter((hotspot) => isAdventureHotspotVisible(hotspot, pipState(false))).map((hotspot) => hotspot.id).sort();
    const after = (scene.hotspots ?? []).filter((hotspot) => isAdventureHotspotVisible(hotspot, pipState(true))).map((hotspot) => hotspot.id).sort();
    expect(before).toEqual(["army-before-training", "lem-before-training", "pip-before-training"]);
    expect(after).toEqual(["army-after-training", "lem-after-training", "pip-after-training"]);
    expect(STORY_SCENES["pip-lem-after"].text).toContain("Roger and Ricky");
  });

  it("unlocks a replayable Pawn page with all four rules", () => {
    const pawns = KNOWLEDGE_ENTRIES.find((entry) => entry.id === "pawn");
    expect(pawns?.practiceChallengeId).toBe("learn-pawn");
    expect(pawns?.detail).toContain("one square forward");
    expect(pawns?.detail).toContain("may move two");
    expect(pawns?.detail).toContain("diagonally forward");
    expect(pawns?.detail).toContain("cannot move backward");
  });
});
