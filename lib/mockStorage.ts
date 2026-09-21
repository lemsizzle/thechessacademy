import type { ActivityEvent, ArenaTournamentResult, Badge, ClassGroup, GameAnalysisRequest, GameReviewSubmission, GameTacticFinding, LichessActivitySnapshot, LichessConnection, LichessQuestProgress, LichessSyncLog, PendingAward, PendingQuestAward, PendingTournamentAward, Quest, QuestCompletionEvent, Resource, Student, StudentGameSubmission, StudentLichessAccount, StudentQuestAttempt, StudentScoreSubmission, StudentTacticProgress, Tournament, XpEvent } from "@/lib/types";

export const ADMIN_STORE_KEY = "quest-board-admin-state-v1";
export const ADMIN_SESSION_KEY = "quest-board-admin";
export const ADMIN_STORE_UPDATED_EVENT = "quest-board-admin-store-updated";
let unsavedState: AdminStoreState | undefined;
export function hasUnsavedAdminState() { return unsavedState !== undefined; }

export type AdminStoreState = {
  students?: Student[];
  badges?: Badge[];
  quests?: Quest[];
  classGroups?: ClassGroup[];
  xpEvents?: XpEvent[];
  resources?: Resource[];
  manualTournaments?: Tournament[];
  importedTournaments?: Tournament[];
  arenaTournamentResults?: ArenaTournamentResult[];
  pendingTournamentAwards?: PendingTournamentAward[];
  tournamentXpEvents?: XpEvent[];
  tournamentActivityEvents?: ActivityEvent[];
  lichessQuestProgress?: LichessQuestProgress[];
  studentQuestAttempts?: StudentQuestAttempt[];
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
  if (unsavedState) return unsavedState;

  try {
    return JSON.parse(window.localStorage.getItem(ADMIN_STORE_KEY) ?? "{}") as AdminStoreState;
  } catch {
    return {};
  }
}

export function updateAdminStore(patch: Partial<AdminStoreState>) {
  if (typeof window === "undefined") return;
  const next = { ...readAdminStore(), ...patch };
  try {
    window.localStorage.setItem(ADMIN_STORE_KEY, JSON.stringify(next));
    unsavedState = undefined;
  } catch {
    // Preserve edits for this tab without crashing every page using the shared cache.
    // Never delete the previously saved state or unrelated browser data to make room.
    unsavedState = next;
  }
  window.dispatchEvent(new CustomEvent(ADMIN_STORE_UPDATED_EVENT));
}

export function hasAdminSession() {
  try { return typeof window !== "undefined" && window.localStorage.getItem(ADMIN_SESSION_KEY) === "true"; }
  catch { return false; }
}
