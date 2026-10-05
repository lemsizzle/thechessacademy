import type { AnalysisTree } from "@/chess/analysis/types";
import { validateAnalysisTree } from "@/chess/analysis/tree";
import { STUDY_DRAFT_PREFIX } from "@/chess/analysis/studyDraftSession";
export { STUDY_DRAFT_PREFIX, STUDY_SESSION_EVENT, STUDY_SESSION_KEY, clearStudyDraftsOnLogout } from "@/chess/analysis/studyDraftSession";

export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const DRAFT_MAX_BYTES = 2_000_000;

export type StudyDraft = {
  schemaVersion: 1;
  id: string;
  ownerKey: string;
  studyId: string;
  chapterId: string;
  chapterTitle: string;
  baseVersion: number;
  updatedAt: number;
  tree: AnalysisTree;
};
export type DraftStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

function scope(ownerKey: string, studyId: string) {
  return `${STUDY_DRAFT_PREFIX}${encodeURIComponent(ownerKey)}:${encodeURIComponent(studyId)}:`;
}
export function draftKey(draft: Pick<StudyDraft, "ownerKey" | "studyId" | "id">) {
  return `${scope(draft.ownerKey, draft.studyId)}${encodeURIComponent(draft.id)}`;
}
export function createStudyDraft(input: Omit<StudyDraft, "schemaVersion" | "id" | "updatedAt">): StudyDraft {
  return { ...input, schemaVersion: 1, id: crypto.randomUUID(), updatedAt: Date.now() };
}

// Each edit has an immutable, unique key. A late save or another tab can only
// remove its own snapshot, never overwrite/delete a newer snapshot's key.
export function writeStudyDraft(storage: DraftStorage, draft: StudyDraft, previous?: StudyDraft | null): boolean {
  try {
    const value = JSON.stringify(draft);
    if (new TextEncoder().encode(value).length > DRAFT_MAX_BYTES) return false;
    storage.setItem(draftKey(draft), value);
    if (previous && previous.id !== draft.id && previous.ownerKey === draft.ownerKey && previous.studyId === draft.studyId && previous.chapterId === draft.chapterId) removeStudyDraft(storage, previous);
    return true;
  } catch { return false; }
}
export function removeStudyDraft(storage: DraftStorage, draft: StudyDraft): boolean {
  try { storage.removeItem(draftKey(draft)); return true; } catch { return false; }
}

export function readStudyDrafts(storage: DraftStorage, ownerKey: string, studyId: string, now = Date.now()): { drafts: StudyDraft[]; available: boolean } {
  const drafts: StudyDraft[] = [];
  try {
    const prefix = scope(ownerKey, studyId);
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => Boolean(key?.startsWith(prefix)));
    for (const key of keys) {
      try {
        const value = storage.getItem(key);
        if (!value || new TextEncoder().encode(value).length > DRAFT_MAX_BYTES) continue;
        const draft = JSON.parse(value) as StudyDraft;
        if (draft.schemaVersion !== 1 || draft.ownerKey !== ownerKey || draft.studyId !== studyId || typeof draft.id !== "string" || draftKey(draft) !== key) continue;
        if (typeof draft.chapterId !== "string" || typeof draft.chapterTitle !== "string" || draft.chapterTitle.length > 200 || !Number.isInteger(draft.baseVersion) || draft.baseVersion < 1) continue;
        if (!Number.isFinite(draft.updatedAt) || draft.updatedAt > now + 86400000) continue;
        if (now - draft.updatedAt > DRAFT_MAX_AGE_MS) { storage.removeItem(key); continue; }
        drafts.push({ ...draft, tree: validateAnalysisTree(draft.tree) });
      } catch { /* One corrupt draft must not hide the others. */ }
    }
    return { drafts: drafts.sort((a, b) => b.updatedAt - a.updatedAt), available: true };
  } catch { return { drafts: [], available: false }; }
}

export function browserDraftStorage(): DraftStorage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}
