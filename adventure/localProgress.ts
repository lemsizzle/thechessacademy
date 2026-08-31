import type { AdventureChallenge, AdventureProgress } from "@/adventure/types";

const STORAGE_KEY = "chess-academy:adventure:chapter-one:v1";
const VERSION = 4;

const LEGACY_SCENE_REDIRECTS: Record<string, string> = {
  "rookus-defend": "rookus-capture",
  "rookus-attack": "rookus-capture",
  "castler-castle": "castler-check",
  "nate-stalemate": "nate-mate"
};

export function createNewAdventureProgress(): AdventureProgress {
  return {
    version: VERSION,
    started: true,
    currentSceneId: "arrival-intro",
    difficulty: null,
    completedChallengeIds: [],
    unlockedKnowledgeIds: ["lem"],
    inventory: {},
    puzzleRatings: {},
    prototypeCoins: 0,
    chapterComplete: false,
    visitedSceneIds: ["arrival-intro"],
    storyFlags: {}
  };
}

function isProgress(value: unknown): value is AdventureProgress {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AdventureProgress>;
  return candidate.version === VERSION
    && typeof candidate.started === "boolean"
    && typeof candidate.currentSceneId === "string"
    && Array.isArray(candidate.completedChallengeIds)
    && Array.isArray(candidate.unlockedKnowledgeIds)
    && typeof candidate.inventory === "object"
    && typeof candidate.puzzleRatings === "object"
    && Array.isArray(candidate.visitedSceneIds)
    && typeof candidate.storyFlags === "object";
}

type VersionThreeProgress = Omit<AdventureProgress, "storyFlags" | "visitedSceneIds" | "version"> & { version: 3 };
type VersionTwoProgress = Omit<VersionThreeProgress, "version"> & { version: 2 };
type VersionOneProgress = Omit<VersionThreeProgress, "puzzleRatings" | "version"> & { version: 1 };

function isVersionThreeProgress(value: unknown): value is VersionThreeProgress {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AdventureProgress>;
  return candidate.version === 3
    && typeof candidate.started === "boolean"
    && typeof candidate.currentSceneId === "string"
    && Array.isArray(candidate.completedChallengeIds)
    && Array.isArray(candidate.unlockedKnowledgeIds)
    && typeof candidate.inventory === "object"
    && typeof candidate.puzzleRatings === "object";
}

function isVersionTwoProgress(value: unknown): value is VersionTwoProgress {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AdventureProgress>;
  return candidate.version === 2
    && typeof candidate.started === "boolean"
    && typeof candidate.currentSceneId === "string"
    && Array.isArray(candidate.completedChallengeIds)
    && Array.isArray(candidate.unlockedKnowledgeIds)
    && typeof candidate.inventory === "object"
    && typeof candidate.puzzleRatings === "object";
}

function isLegacyProgress(value: unknown): value is VersionOneProgress {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AdventureProgress>;
  return candidate.version === 1
    && typeof candidate.started === "boolean"
    && typeof candidate.currentSceneId === "string"
    && Array.isArray(candidate.completedChallengeIds)
    && Array.isArray(candidate.unlockedKnowledgeIds)
    && typeof candidate.inventory === "object";
}

function migrateProgress(progress: VersionThreeProgress | VersionTwoProgress | VersionOneProgress): AdventureProgress {
  const currentSceneId = LEGACY_SCENE_REDIRECTS[progress.currentSceneId] ?? progress.currentSceneId;
  return {
    ...progress,
    version: VERSION,
    currentSceneId,
    puzzleRatings: "puzzleRatings" in progress ? progress.puzzleRatings : {},
    visitedSceneIds: [currentSceneId],
    storyFlags: {}
  };
}

export function loadAdventureProgress(): AdventureProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (isProgress(parsed)) return parsed;
    if (isVersionThreeProgress(parsed)) return migrateProgress(parsed);
    if (isVersionTwoProgress(parsed)) return migrateProgress(parsed);
    if (isLegacyProgress(parsed)) return migrateProgress(parsed);
    return null;
  } catch {
    return null;
  }
}

export function saveAdventureProgress(progress: AdventureProgress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function clearAdventureProgress() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Apply one local challenge completion without duplicating rewards on replay. */
export function applyAdventureChallengeCompletion(progress: AdventureProgress, challenge: AdventureChallenge) {
  const alreadyComplete = progress.completedChallengeIds.includes(challenge.id);
  const reward = alreadyComplete ? undefined : challenge.reward;
  const itemAmount = reward?.itemAmount ?? 1;
  const unlockedKnowledgeIds = [...new Set([...progress.unlockedKnowledgeIds, ...challenge.knowledgeIds])];
  const storyFlags = (challenge.completionFlags ?? []).reduce<Record<string, boolean>>(
    (flags, flag) => ({ ...flags, [flag]: true }),
    progress.storyFlags
  );

  return {
    ...progress,
    completedChallengeIds: alreadyComplete ? progress.completedChallengeIds : [...progress.completedChallengeIds, challenge.id],
    unlockedKnowledgeIds,
    prototypeCoins: progress.prototypeCoins + (reward?.coins ?? 0),
    inventory: reward?.item
      ? { ...progress.inventory, [reward.item]: (progress.inventory[reward.item] ?? 0) + itemAmount }
      : progress.inventory,
    storyFlags
  };
}
