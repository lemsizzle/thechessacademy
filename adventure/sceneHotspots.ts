import type {
  AdventureProgress,
  AdventureScene,
  AdventureSceneCondition,
  AdventureSceneHotspot,
  AdventureSceneRuntimeState
} from "@/adventure/types";

function conditionValue(condition: AdventureSceneCondition, state: AdventureSceneRuntimeState) {
  switch (condition.kind) {
    case "storyFlag":
      return state.storyFlags[condition.flag] === true;
    case "visitedScene":
      return state.visitedSceneIds.includes(condition.sceneId);
    case "completedChallenge":
      return state.completedChallengeIds.includes(condition.challengeId);
    case "difficulty":
      return state.difficulty === condition.value;
    case "chapterComplete":
      return state.chapterComplete;
  }
}

export function adventureSceneConditionsMatch(
  conditions: AdventureSceneCondition[] | undefined,
  state: AdventureSceneRuntimeState
) {
  return (conditions ?? []).every((condition) => conditionValue(condition, state) === (condition.equals ?? true));
}

export function isAdventureHotspotVisible(hotspot: AdventureSceneHotspot, state: AdventureSceneRuntimeState) {
  return adventureSceneConditionsMatch(hotspot.visibleWhen, state);
}

export function isAdventureHotspotDisabled(hotspot: AdventureSceneHotspot, state: AdventureSceneRuntimeState) {
  return Boolean(hotspot.disabledWhen?.length) && adventureSceneConditionsMatch(hotspot.disabledWhen, state);
}

export function isAdventureHotspotInBounds(hotspot: AdventureSceneHotspot) {
  return hotspot.x >= 0
    && hotspot.y >= 0
    && hotspot.width > 0
    && hotspot.height > 0
    && hotspot.x + hotspot.width <= 100
    && hotspot.y + hotspot.height <= 100;
}

export function enterAdventureScene(progress: AdventureProgress, scene: AdventureScene) {
  const visitedSceneIds = progress.visitedSceneIds.includes(scene.id)
    ? progress.visitedSceneIds
    : [...progress.visitedSceneIds, scene.id];
  const storyFlags = (scene.setsFlags ?? []).reduce<Record<string, boolean>>(
    (flags, flag) => ({ ...flags, [flag]: true }),
    progress.storyFlags
  );

  return { ...progress, started: true, currentSceneId: scene.id, visitedSceneIds, storyFlags };
}

export function isAdventureHotspotEditorEnabled(environment: string | undefined) {
  return environment === "development";
}
