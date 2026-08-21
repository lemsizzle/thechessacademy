import {
  CHESS_HISTORY_MODES,
  CHESS_HISTORY_RESULTS,
  type ChessHistoryFilters,
  type ChessHistoryMode,
  type ChessHistoryResult,
  type ChessHistorySummary
} from "@/chess/history/types";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 30;
const MAX_PAGE = 10_000;

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function parseChessHistoryFilters(searchParams: URLSearchParams): ChessHistoryFilters {
  const requestedMode = searchParams.get("mode");
  const requestedResult = searchParams.get("result");

  return {
    mode: CHESS_HISTORY_MODES.includes(requestedMode as ChessHistoryMode)
      ? requestedMode as ChessHistoryMode
      : "all",
    result: CHESS_HISTORY_RESULTS.includes(requestedResult as ChessHistoryResult)
      ? requestedResult as ChessHistoryResult
      : "all",
    page: positiveInteger(searchParams.get("page"), 1, MAX_PAGE),
    pageSize: positiveInteger(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  };
}

export function createChessHistorySummary(counts: Omit<ChessHistorySummary, "winRate">): ChessHistorySummary {
  return {
    ...counts,
    winRate: counts.total > 0 ? Math.round((counts.wins / counts.total) * 100) : 0
  };
}
