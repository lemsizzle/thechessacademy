import { describe, expect, it } from "vitest";
import { STORY_SCENES } from "@/adventure/content";
import { createNewAdventureProgress } from "@/adventure/localProgress";
import { enterAdventureScene, isAdventureHotspotVisible } from "@/adventure/sceneHotspots";
import type { AdventureSceneRuntimeState } from "@/adventure/types";

const beforeMarge: AdventureSceneRuntimeState = {
  chapterComplete: false,
  completedChallengeIds: [],
  difficulty: null,
  storyFlags: {},
  visitedSceneIds: ["arrival-intro", "arrival-home", "arrival-wrong", "arrival"]
};

const afterMarge: AdventureSceneRuntimeState = {
  ...beforeMarge,
  storyFlags: { met_marge: true, learned_dad_was_taken: true },
  visitedSceneIds: [...beforeMarge.visitedSceneIds, "marge-greeting", "marge-taken"]
};

function visibleArrivalHotspotIds(state: AdventureSceneRuntimeState) {
  return (STORY_SCENES.arrival.hotspots ?? [])
    .filter((hotspot) => isAdventureHotspotVisible(hotspot, state))
    .map((hotspot) => hotspot.id)
    .sort();
}

describe("Pawnhaven Arrival", () => {
  it("starts new adventures with the three-beat first-visit narration", () => {
    const progress = createNewAdventureProgress();

    expect(progress.currentSceneId).toBe("arrival-intro");
    expect(progress.visitedSceneIds).toEqual(["arrival-intro"]);
    expect(STORY_SCENES["arrival-intro"].text).toBe("Pawnhaven.");
    expect(STORY_SCENES["arrival-intro"].next).toBe("arrival-home");
    expect(STORY_SCENES["arrival-home"].text).toBe("Home.");
    expect(STORY_SCENES["arrival-home"].next).toBe("arrival-wrong");
    expect(STORY_SCENES["arrival-wrong"].text).toBe("But something feels wrong.");
    expect(STORY_SCENES["arrival-wrong"].next).toBe("arrival");

    for (const sceneId of ["arrival-intro", "arrival-home", "arrival-wrong"]) {
      expect(STORY_SCENES[sceneId].hotspots).toBeUndefined();
      expect(STORY_SCENES[sceneId].backgroundImage).toBe("/adventure/scenes/pawnhaven-arrival.webp");
    }
  });

  it("shows exactly three contextual interactions before and after Marge's explanation", () => {
    expect(visibleArrivalHotspotIds(beforeMarge)).toEqual([
      "black-king-banner",
      "marge",
      "player-home-before"
    ]);
    expect(visibleArrivalHotspotIds(afterMarge)).toEqual([
      "black-king-banner-known",
      "marge-repeat",
      "player-home"
    ]);
  });

  it("uses the editor-measured rectangles for Marge, the banner, and home", () => {
    const hotspots = STORY_SCENES.arrival.hotspots ?? [];
    const expected = {
      marge: { x: 13.5, y: 33.5, width: 12, height: 57.5 },
      "black-king-banner": { x: 53.9, y: 6.3, width: 17.2, height: 31.8 },
      "player-home-before": { x: 62.4, y: 25.6, width: 22.2, height: 41.3 }
    };

    for (const [id, rectangle] of Object.entries(expected)) {
      const hotspot = hotspots.find((candidate) => candidate.id === id);
      expect(hotspot).toMatchObject(rectangle);
    }
  });

  it("keeps home contextual and changes the banner copy after learning about Dad", () => {
    const hotspots = STORY_SCENES.arrival.hotspots ?? [];
    const homeBefore = hotspots.find((hotspot) => hotspot.id === "player-home-before");
    const homeAfter = hotspots.find((hotspot) => hotspot.id === "player-home");
    const bannerBefore = hotspots.find((hotspot) => hotspot.id === "black-king-banner");
    const bannerAfter = hotspots.find((hotspot) => hotspot.id === "black-king-banner-known");

    expect(homeBefore?.action).toEqual({ type: "dialogue", dialogueId: "home-called-back" });
    expect(homeAfter?.action).toEqual({ type: "gotoScene", sceneId: "house" });
    expect(bannerBefore?.action).toMatchObject({
      type: "inspect",
      title: "A strange banner",
      description: "A dark banner hangs over the village. You don't remember seeing it before."
    });
    expect(bannerAfter?.action).toMatchObject({
      type: "inspect",
      title: "The Black King's banner",
      description: "The symbol belongs to the Black King. Kingpin's gang hung these throughout Pawnhaven."
    });
  });

  it("sets the two story flags at their narrative reveals and keeps repeat dialogue short", () => {
    const fresh = createNewAdventureProgress();
    const greeted = enterAdventureScene(fresh, STORY_SCENES["marge-greeting"]);
    const informed = enterAdventureScene(greeted, STORY_SCENES["marge-taken"]);

    expect(greeted.storyFlags).toEqual({ met_marge: true });
    expect(informed.storyFlags).toEqual({ met_marge: true, learned_dad_was_taken: true });
    expect(STORY_SCENES["marge-greeting"].choices?.map((choice) => choice.label)).toEqual([
      "What happened?",
      "Where's Dad?",
      "Why are those banners everywhere?"
    ]);
    expect(STORY_SCENES["marge-what-happened"].next).toBe("marge-occupation");
    expect(STORY_SCENES["marge-where-dad"].next).toBe("marge-occupation");
    expect(STORY_SCENES["marge-banners"].next).toBe("marge-occupation");
    expect(STORY_SCENES["marge-repeat"].next).toBe("arrival");
    expect(STORY_SCENES["marge-repeat"].text.length).toBeLessThan(100);
  });
});
