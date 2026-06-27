import type { ActivityEvent, ArenaTournamentResult, Badge, ClassGroup, GameAnalysisRequest, GameReviewSubmission, GameTacticFinding, LichessActivitySnapshot, LichessConnection, LichessQuestProgress, LichessSyncLog, PendingAward, PendingQuestAward, PendingTournamentAward, Quest, QuestCompletionEvent, Resource, Student, StudentGameSubmission, StudentLichessAccount, StudentScoreSubmission, StudentTacticProgress, Tournament, XpEvent } from "@/lib/types";

export const ADMIN_STORE_KEY = "quest-board-admin-state-v1";
export const ADMIN_SESSION_KEY = "quest-board-admin";

export type AdminStoreState = {
  students?: Student[];
  badges?: Badge[];
  quests?: Quest[];
  classGroups?: ClassGroup[];
  resources?: Resource[];
  manualTournaments?: Tournament[];
  importedTournaments?: Tournament[];
  arenaTournamentResults?: ArenaTournamentResult[];
  pendingTournamentAwards?: PendingTournamentAward[];
  tournamentXpEvents?: XpEvent[];
  tournamentActivityEvents?: ActivityEvent[];
  lichessQuestProgress?: LichessQuestProgress[];
  pendingQuestAwards?: PendingQuestAward[];
  questCompletionEvents?: QuestCompletionEvent[];
  lichessActivitySnapshots?: LichessActivitySnapshot[];
  questXpEvents?: XpEvent[];
  questActivityEvents?: ActivityEvent[];
  studentTacticProgress?: StudentTacticProgress[];
  lichessConnections?: LichessConnection[];
  studentLichessAccounts?: StudentLichessAccount[];
  gameReviewSubmissions?: GameReviewSubmission[];
  studentGameSubmissions?: StudentGameSubmission[];
  studentScoreSubmissions?: StudentScoreSubmission[];
  gameAnalysisRequests?: GameAnalysisRequest[];
  gameTacticFindings?: GameTacticFinding[];
  pendingAwards?: PendingAward[];
  lichessSyncLogs?: LichessSyncLog[];
  log?: string[];
};

export function readAdminStore(): AdminStoreState {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(ADMIN_STORE_KEY) ?? "{}") as AdminStoreState;
  } catch {
    return {};
  }
}

export function updateAdminStore(patch: Partial<AdminStoreState>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_STORE_KEY, JSON.stringify({ ...readAdminStore(), ...patch }));
}

export function hasAdminSession() {
  return typeof window !== "undefined" && window.localStorage.getItem(ADMIN_SESSION_KEY) === "true";
}
