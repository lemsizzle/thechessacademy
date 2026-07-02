import { parseNdjson } from "@/lib/lichess/parseNdjson";
import { getRetryAfterSeconds, LichessRateLimitError } from "@/lib/lichess/rateLimit";
import type { LichessQuestPuzzleActivity } from "@/lib/types";

type RawPuzzleActivity = {
  date?: number | string;
  win?: boolean;
  puzzle?: { id?: string; themes?: string[] };
};

export async function fetchStudentPuzzleActivityForWindow(accessToken: string, start: Date, end: Date) {
  const params = new URLSearchParams({
    since: String(start.getTime()),
    before: String(end.getTime()),
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
    if (!activity.puzzle?.id) return [];
    return [{
      puzzleId: activity.puzzle.id,
      date: new Date(activity.date ?? Date.now()).toISOString(),
      win: activity.win === true,
      themes: activity.puzzle.themes ?? []
    }];
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
