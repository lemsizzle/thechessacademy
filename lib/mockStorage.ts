import type { ActivityEvent, ArenaTournamentResult, Badge, ClassGroup, GameAnalysisRequest, GameReviewSubmission, GameTacticFinding, LichessActivitySnapshot, LichessConnection, LichessQuestProgress, LichessSyncLog, PendingAward, PendingQuestAward, PendingTournamentAward, Quest, QuestCompletionEvent, Resource, Student, StudentGameSubmission, StudentLichessAccount, StudentQuestAttempt, StudentScoreSubmission, StudentTacticProgress, Tournament, XpEvent } from "@/lib/types";

import { archiveAdminStorage, readAdminStorageArchive } from "@/lib/adminStorageBackup";

export const ADMIN_STORE_KEY = "quest-board-admin-state-v1";
export const ADMIN_SESSION_KEY = "quest-board-admin";
export const ADMIN_STORE_UPDATED_EVENT = "quest-board-admin-store-updated";
let unsavedState: AdminStoreState | undefined;
let compactReady = false;
let recovery: Promise<void> | undefined;
export function hasUnsavedAdminState() { return unsavedState !== undefined; }

export function compactAdminStore(state: AdminStoreState): AdminStoreState {
  // These raw game/puzzle snapshots are write-only cache copies. Quest decisions
  // use server records; keep local drafts, class settings, rewards and submissions.
  const { lichessActivitySnapshots: _snapshots, ...settings } = state;
  return settings;
}

export function recoverAdminStorage() {
  if (typeof window === "undefined") return Promise.resolve();
  if (compactReady) { updateAdminStore({}); return Promise.resolve(); }
  if (recovery) return recovery;
  recovery = (async () => {
    const saved = window.localStorage.getItem(ADMIN_STORE_KEY);
    await archiveAdminStorage(saved, JSON.stringify(readAdminStore()));
    compactReady = true;
    // Read again after the asynchronous backup so edits made meanwhile survive.
    updateAdminStore({});
  })().catch(error => { recovery = undefined; throw error; });
  return recovery;
}

export async function downloadAdminBackup() {
  const original = await readAdminStorageArchive().catch(() => null);
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), state: readAdminStore(), originalArchive: original }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `chessquest-teacher-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
  const merged = { ...readAdminStore(), ...patch };
  const next = compactReady ? compactAdminStore(merged) : merged;
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
