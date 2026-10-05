import { describe, expect, it } from "vitest";
import { addAnalysisMove, createEmptyAnalysisTree } from "@/chess/analysis/tree";
import { createStudyDraft, DRAFT_MAX_AGE_MS, draftKey, readStudyDrafts, removeStudyDraft, studyTreeSignature, STUDY_DRAFT_PREFIX, writeStudyDraft, type DraftStorage } from "@/chess/analysis/studyDrafts";

class MemoryStorage implements DraftStorage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const makeDraft = (ownerKey = "student:one", studyId = "study") => createStudyDraft({ ownerKey, studyId, chapterId: "chapter", chapterTitle: "Practice", baseVersion: 3, tree: createEmptyAnalysisTree() });

describe("durable Study draft storage", () => {
  it("recognizes an acknowledged tree after a jsonb object-key reorder", () => {
    const original = createEmptyAnalysisTree();
    const tree = addAnalysisMove(original, original.rootId, "e2", "e4").tree;
    const roundTrip = JSON.parse(JSON.stringify(tree, (_key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).reverse()) : value));
    expect(JSON.stringify(tree)).not.toBe(JSON.stringify(roundTrip));
    expect(studyTreeSignature(roundTrip)).toBe(studyTreeSignature(tree));
    roundTrip.nodes[tree.rootId].comment = "Different analysis";
    expect(studyTreeSignature(roundTrip)).not.toBe(studyTreeSignature(tree));
  });
  it("keeps meaningful variation ordering distinct", () => {
    const original = createEmptyAnalysisTree();
    const first = addAnalysisMove(original, original.rootId, "e2", "e4").tree;
    const tree = addAnalysisMove(first, first.rootId, "d2", "d4").tree;
    const reordered = structuredClone(tree); reordered.nodes[tree.rootId].childrenIds.reverse();
    expect(studyTreeSignature(reordered)).not.toBe(studyTreeSignature(tree));
  });
  it("recovers a validated tree only for the authenticated owner and study", () => {
    const storage = new MemoryStorage(); const draft = makeDraft();
    expect(writeStudyDraft(storage, draft)).toBe(true);
    expect(readStudyDrafts(storage, "student:one", "study").drafts).toEqual([draft]);
    expect(readStudyDrafts(storage, "student:two", "study").drafts).toEqual([]);
    expect(readStudyDrafts(storage, "student:one", "another").drafts).toEqual([]);
    expect(readStudyDrafts(storage, "admin", "study").drafts).toEqual([]);
  });
  it("keeps separate tabs' snapshots and a late acknowledgement cannot delete newer work", () => {
    const storage = new MemoryStorage(); const first = makeDraft(); const otherTab = makeDraft(); const newer = makeDraft();
    writeStudyDraft(storage, first); writeStudyDraft(storage, otherTab); writeStudyDraft(storage, newer, first);
    removeStudyDraft(storage, first);
    expect(new Set(readStudyDrafts(storage, first.ownerKey, first.studyId).drafts.map((d) => d.id))).toEqual(new Set([otherTab.id, newer.id]));
  });
  it("keeps the previous snapshot when a quota failure prevents the next write", () => {
    const storage = new MemoryStorage(); const first = makeDraft(); writeStudyDraft(storage, first);
    storage.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
    expect(writeStudyDraft(storage, makeDraft(), first)).toBe(false);
    expect(readStudyDrafts(storage, first.ownerKey, first.studyId).drafts).toEqual([first]);
  });
  it("handles storage denied and oversized snapshots without throwing", () => {
    const storage = new MemoryStorage(); const huge = makeDraft(); huge.tree.nodes[huge.tree.rootId].comment = "x".repeat(2_000_000);
    expect(writeStudyDraft(storage, huge)).toBe(false);
    storage.key = () => { throw new Error("denied"); }; storage.values.set("unused", "value");
    expect(readStudyDrafts(storage, "student:one", "study")).toEqual({ drafts: [], available: false });
  });
  it("expires old drafts without touching unrelated browser data", () => {
    const storage = new MemoryStorage(); const draft = makeDraft(); draft.updatedAt -= DRAFT_MAX_AGE_MS + 1;
    writeStudyDraft(storage, draft); storage.setItem("other-feature", "keep");
    expect(readStudyDrafts(storage, draft.ownerKey, draft.studyId).drafts).toEqual([]);
    expect(storage.getItem(draftKey(draft))).toBeNull(); expect(storage.getItem("other-feature")).toBe("keep");
  });
  it.each(["bad-json", "wrong-owner", "invalid-tree", "invalid-version", "wrong-key", "future-timestamp"])("ignores %s without losing a valid sibling", (problem) => {
    const storage = new MemoryStorage(); const valid = makeDraft(); const invalid = makeDraft();
    writeStudyDraft(storage, valid); const key = draftKey(invalid);
    if (problem === "wrong-owner") invalid.ownerKey = "student:two";
    if (problem === "invalid-tree") invalid.tree.nodes[invalid.tree.rootId].fen = "invalid";
    if (problem === "invalid-version") invalid.baseVersion = 0;
    if (problem === "future-timestamp") invalid.updatedAt += 2 * 86400000;
    storage.setItem(problem === "wrong-key" ? `${STUDY_DRAFT_PREFIX}student%3Aone:study:wrong` : key, problem === "bad-json" ? "{" : JSON.stringify(invalid));
    expect(readStudyDrafts(storage, valid.ownerKey, valid.studyId).drafts).toEqual([valid]);
  });
  it("never removes a different owner's prior snapshot on replacement", () => {
    const storage = new MemoryStorage(); const other = makeDraft("student:two"); writeStudyDraft(storage, other);
    writeStudyDraft(storage, makeDraft(), other);
    expect(readStudyDrafts(storage, "student:two", "study").drafts).toEqual([other]);
  });
});
