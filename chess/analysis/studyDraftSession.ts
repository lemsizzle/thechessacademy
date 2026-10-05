// Kept separate from tree validation so navigation/auth pages stay lightweight.
export const STUDY_DRAFT_PREFIX = "chessquest:study-draft:v1:";
export const STUDY_SESSION_EVENT = "chessquest:study-session-ended";
export const STUDY_SESSION_KEY = "chessquest:study-session-event";

export function clearStudyDraftsOnLogout() {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => Boolean(key?.startsWith(STUDY_DRAFT_PREFIX)));
    keys.forEach((key) => storage.removeItem(key));
    storage.setItem(STUDY_SESSION_KEY, crypto.randomUUID());
  } catch { /* Logout still succeeds with unavailable browser storage. */ }
  window.dispatchEvent(new Event(STUDY_SESSION_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(STUDY_SESSION_EVENT);
      channel.postMessage("ended"); channel.close();
    } catch { /* Restricted browser; local and storage events remain available. */ }
  }
}
