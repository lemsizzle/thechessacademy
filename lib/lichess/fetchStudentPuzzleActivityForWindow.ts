import { parseNdjson } from "@/lib/lichess/parseNdjson";
import { getRetryAfterSeconds, LichessRateLimitError } from "@/lib/lichess/rateLimit";
import type { LichessQuestPuzzleActivity } from "@/lib/types";

type RawPuzzleActivity = {
  date?: number | string;
  win?: boolean;
  puzzle?: { id?: string; themes?: string[] };
};

function mapPuzzleActivity(activity: RawPuzzleActivity): LichessQuestPuzzleActivity | null {
  if (!activity.puzzle?.id) return null;
  return {
    puzzleId: activity.puzzle.id,
    date: new Date(activity.date ?? Date.now()).toISOString(),
    win: activity.win === true,
    themes: activity.puzzle.themes ?? []
  };
}

async function fetchPuzzlePage(accessToken: string, before: Date) {
  const params = new URLSearchParams({
    before: String(before.getTime()),
    max: "100"
  });
  const response = await fetch(`https://lichess.org/api/puzzle/activity?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/x-ndjson" },
    cache: "no-store"
  });
  if (!response.ok) {
    if (response.status === 429) {
      throw new LichessRateLimitError("Lichess rate limit reached for puzzle activity. Try again after the cooldown.", getRetryAfterSeconds(response.headers));
    }
    throw new Error(`Lichess puzzle activity failed with ${response.status}.`);
  }
  return parseNdjson<RawPuzzleActivity>(await response.text()).flatMap((activity) => {
    const mapped = mapPuzzleActivity(activity);
    return mapped ? [mapped] : [];
  });
}

export async function fetchStudentPuzzleActivityForWindow(accessToken: string, start: Date, end: Date) {
  const requestEnd = new Date(Math.min(end.getTime(), Date.now() + 2 * 60_000));
  const activities: LichessQuestPuzzleActivity[] = [];
  let before = requestEnd;

  for (let page = 0; page < 5; page += 1) {
    const pageActivities = await fetchPuzzlePage(accessToken, before);
    if (!pageActivities.length) break;
    activities.push(...pageActivities);

    const oldest = Math.min(...pageActivities.map((activity) => new Date(activity.date).getTime()));
    if (!Number.isFinite(oldest) || oldest <= start.getTime()) break;
    before = new Date(oldest - 1);
  }

  return Array.from(new Map(activities.map((activity) => [activity.puzzleId, activity])).values())
    .filter((activity) => {
      const time = new Date(activity.date).getTime();
      return time >= start.getTime() && time <= requestEnd.getTime();
    });
}

export function createMockStudentPuzzleActivityForWindow(start: Date, end: Date): LichessQuestPuzzleActivity[] {
  const step = Math.max(60_000, Math.floor((end.getTime() - start.getTime()) / 61));
  return Array.from({ length: 60 }, (_, index) => ({
    puzzleId: `mock-puzzle-${index}`,
    date: new Date(start.getTime() + (index + 1) * step).toISOString(),
    win: index < 51,
    themes: index % 2 === 0 ? ["fork"] : ["pin"]
  }));
}
