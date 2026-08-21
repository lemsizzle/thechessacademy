export const DAILY_PUZZLE_TIME_ZONE = "Asia/Bangkok";
export const DAILY_PUZZLE_XP = 10;
export const DAILY_PUZZLE_COINS = 10;

export function academyPuzzleDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DAILY_PUZZLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function dailyPuzzlePivot(puzzleDate: string) {
  let hash = 2166136261;
  for (let index = 0; index < puzzleDate.length; index += 1) {
    hash = Math.imul(hash ^ puzzleDate.charCodeAt(index), 16777619) >>> 0;
  }
  return hash / 0x1_0000_0000;
}
