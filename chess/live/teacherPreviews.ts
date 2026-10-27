import type { TeacherLiveGameSummary } from "./types";

export const TEACHER_PREVIEW_LIMIT = 3;

/** Preserve watched slots across moves; fill vacancies from the current list. */
export function teacherPreviewGames(games: TeacherLiveGameSummary[], preferred: string[] = []) {
  const byId = new Map(games.map(game => [game.id, game]));
  const slots = [...new Set(preferred)].slice(0, TEACHER_PREVIEW_LIMIT).map(id => byId.get(id));
  const kept = new Set(slots.flatMap(game => game ? [game.id] : []));
  const available = games.filter(game => !kept.has(game.id));
  for (let index = 0; index < TEACHER_PREVIEW_LIMIT; index++) {
    if (!slots[index]) slots[index] = available.shift();
  }
  return slots.filter((game): game is TeacherLiveGameSummary => Boolean(game));
}

export function parseTeacherPreviewIds(value: string | null) {
  return (value ?? "").split(",").filter(id => /^(computer-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)).slice(0, TEACHER_PREVIEW_LIMIT);
}
