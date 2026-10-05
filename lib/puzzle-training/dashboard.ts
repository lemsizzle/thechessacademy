import { puzzleThemeOptions } from "@/lib/puzzle-training/types";

export const DASHBOARD_PERIODS = ["7", "30", "90", "all"] as const;
export type DashboardPeriod = typeof DASHBOARD_PERIODS[number];
export const DASHBOARD_VIEWS = ["overview", "improve", "strengths", "themes", "openings", "history", "replay"] as const;
export type DashboardView = typeof DASHBOARD_VIEWS[number];
export const DASHBOARD_PAGE_SIZE = 12;
export const MIN_THEME_SAMPLE = 5;

export type DashboardQuery = {
  period: DashboardPeriod;
  view: DashboardView;
  theme: string;
  opening: string;
  outcome: "all" | "clean" | "helped" | "missed";
  page: number;
};

export type DashboardAttempt = {
  id: string;
  puzzleId: string;
  attemptedAt: string;
  solved: boolean;
  clean: boolean;
  seconds: number;
  mode: string;
  rating: number | null;
  themes: string[];
  openings: string[];
  active: boolean;
};

export type DashboardSkill = {
  id: string;
  name: string;
  played: number;
  clean: number;
  accuracy: number;
  averageRating: number | null;
  toReplay: number;
};

export type PuzzleDashboardData = {
  query: DashboardQuery;
  played: number;
  uniquePuzzles: number;
  solved: number;
  clean: number;
  accuracy: number;
  solvedLevel: number | null;
  seconds: number;
  toReplay: number;
  replayQueue: string[];
  themes: DashboardSkill[];
  openings: DashboardSkill[];
  history: (DashboardAttempt & { needsReplay: boolean })[];
  historyCount: number;
  pageCount: number;
  replayAvailable: boolean;
};

export function parseDashboardQuery(params: Record<string, string | string[] | undefined>): DashboardQuery {
  const scalar = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  return {
    period: DASHBOARD_PERIODS.includes(scalar("period") as DashboardPeriod) ? scalar("period") as DashboardPeriod : "30",
    view: DASHBOARD_VIEWS.includes(scalar("view") as DashboardView) ? scalar("view") as DashboardView : "overview",
    theme: /^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(scalar("theme")) ? scalar("theme") : "",
    opening: scalar("opening").slice(0, 160),
    outcome: ["clean", "helped", "missed"].includes(scalar("outcome")) ? scalar("outcome") as DashboardQuery["outcome"] : "all",
    page: /^\d{1,6}$/.test(scalar("page")) ? Math.max(1, Number(scalar("page"))) : 1
  };
}

export function dashboardSince(period: DashboardPeriod, now: number) {
  return period === "all" ? null : new Date(now - Number(period) * 86_400_000).toISOString();
}

export function dashboardHref(query: DashboardQuery, changes: Partial<DashboardQuery> = {}) {
  const next = { ...query, page: 1, ...changes };
  const params = new URLSearchParams({ period: next.period, view: next.view });
  if (next.theme) params.set("theme", next.theme);
  if (next.opening) params.set("opening", next.opening);
  if (next.outcome !== "all") params.set("outcome", next.outcome);
  if (next.page > 1) params.set("page", String(next.page));
  return `/student/training/dashboard?${params}`;
}

export function puzzleReplayHref(puzzleId: string, query: DashboardQuery) {
  const params = new URLSearchParams({ period: query.period });
  if (query.theme) params.set("theme", query.theme);
  if (query.opening) params.set("opening", query.opening);
  return `/student/training/replay/${encodeURIComponent(puzzleId)}?${params}`;
}

export function nextReplayPuzzleId(queue: readonly string[], currentId: string) {
  const index = queue.indexOf(currentId);
  return queue[index + 1] ?? null;
}

export function puzzleTagName(tag: string) {
  return puzzleThemeOptions.find((option) => option.id === tag)?.name
    ?? tag.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

export function puzzleDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${rounded}s`;
  if (rounded < 3600) return `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
  return `${Math.floor(rounded / 3600)}h ${Math.floor((rounded % 3600) / 60)}m`;
}

const percent = (part: number, total: number) => total ? Math.round(part * 100 / total) : 0;

/** All aggregates use original attempts, never dashboard replays. Latest attempt controls replay status. */
export function buildPuzzleDashboard(
  attempts: readonly DashboardAttempt[],
  cleared: ReadonlyMap<string, string>,
  query: DashboardQuery,
  now = Date.now(),
  replayAvailable = true
): PuzzleDashboardData {
  const since = dashboardSince(query.period, now);
  const rows = attempts.filter((row) => {
    const time = Date.parse(row.attemptedAt);
    return Number.isFinite(time) && time <= now && (!since || time >= Date.parse(since));
  }).sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt) || b.id.localeCompare(a.id));
  const latest = new Map<string, DashboardAttempt>();
  for (const row of rows) if (!latest.has(row.puzzleId)) latest.set(row.puzzleId, row);
  const replayIds = new Set([...latest.values()].filter((row) => {
    const clearedAt = Date.parse(cleared.get(row.puzzleId) ?? "");
    return row.active && !row.clean && (!Number.isFinite(clearedAt) || clearedAt < Date.parse(row.attemptedAt));
  }).map((row) => row.puzzleId));

  function skills(kind: "themes" | "openings"): DashboardSkill[] {
    const groups = new Map<string, DashboardAttempt[]>();
    for (const row of rows) for (const tag of new Set(row[kind])) {
      if (!tag) continue;
      const group = groups.get(tag) ?? [];
      group.push(row);
      groups.set(tag, group);
    }
    return [...groups].map(([id, group]) => {
      const clean = group.filter((row) => row.clean).length;
      const rated = group.filter((row) => row.rating !== null);
      return {
        id, name: puzzleTagName(id), played: group.length, clean,
        accuracy: percent(clean, group.length),
        averageRating: rated.length ? Math.round(rated.reduce((sum, row) => sum + row.rating!, 0) / rated.length) : null,
        toReplay: new Set(group.filter((row) => replayIds.has(row.puzzleId)).map((row) => row.puzzleId)).size
      };
    }).sort((a, b) => b.played - a.played || a.name.localeCompare(b.name));
  }

  const cleanRows = rows.filter((row) => row.clean);
  const cleanRated = cleanRows.filter((row) => row.rating !== null);
  const history = (query.view === "replay" ? [...latest.values()].filter((row) => replayIds.has(row.puzzleId)) : rows)
    .filter((row) => (!query.theme || row.themes.includes(query.theme))
      && (!query.opening || row.openings.includes(query.opening))
      && (query.outcome === "all" || (query.outcome === "clean" ? row.clean : query.outcome === "helped" ? row.solved && !row.clean : !row.solved)));
  const pageCount = Math.max(1, Math.ceil(history.length / DASHBOARD_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  // Navigation spans every page, skips clean/retired puzzles, and keeps theme/opening filters.
  const replayQueue = [...latest.values()].filter((row) => replayIds.has(row.puzzleId)
    && (!query.theme || row.themes.includes(query.theme))
    && (!query.opening || row.openings.includes(query.opening))).map((row) => row.puzzleId);
  return {
    query: { ...query, page }, played: rows.length, uniquePuzzles: latest.size,
    solved: rows.filter((row) => row.solved).length, clean: cleanRows.length,
    accuracy: percent(cleanRows.length, rows.length),
    solvedLevel: cleanRated.length ? Math.round(cleanRated.reduce((sum, row) => sum + row.rating!, 0) / cleanRated.length) : null,
    seconds: rows.reduce((sum, row) => sum + row.seconds, 0), toReplay: replayIds.size, replayQueue,
    themes: skills("themes"), openings: skills("openings"),
    history: history.slice((page - 1) * DASHBOARD_PAGE_SIZE, page * DASHBOARD_PAGE_SIZE).map((row) => ({ ...row, needsReplay: replayIds.has(row.puzzleId) })),
    historyCount: history.length, pageCount, replayAvailable
  };
}
