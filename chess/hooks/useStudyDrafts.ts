"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalysisTree, StudyChapter } from "@/chess/analysis/types";
import { browserDraftStorage, createStudyDraft, readStudyDrafts, removeStudyDraft, studyTreeSignature, STUDY_SESSION_EVENT, STUDY_SESSION_KEY, writeStudyDraft, type StudyDraft } from "@/chess/analysis/studyDrafts";

type Pending = { draft: StudyDraft; stored: StudyDraft | null; recoveredSource?: StudyDraft };
type Callbacks = {
  onSaved: (chapter: StudyChapter) => void;
  onRestored: (chapterId: string, tree: AnalysisTree) => void;
  onCreated: (chapter: StudyChapter) => void;
};

export function useStudyDrafts(studyId: string, callbacks: Callbacks) {
  const callbacksRef = useRef(callbacks); callbacksRef.current = callbacks;
  const owner = useRef("");
  const generation = useRef(0);
  const chapters = useRef(new Map<string, StudyChapter>());
  const pending = useRef(new Map<string, Pending>());
  const inFlight = useRef(new Map<string, Promise<boolean>>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const failed = useRef(new Set<string>());
  const conflictsRef = useRef(new Set<string>());
  const copying = useRef(new Set<string>());
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [recoveries, setRecoveries] = useState<StudyDraft[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [, render] = useState(0);

  function refresh() {
    setConflicts([...conflictsRef.current]); render((n) => n + 1);
    setStatus(failed.current.size || conflictsRef.current.size ? "error" : pending.current.size || inFlight.current.size ? "saving" : "saved");
    const unprotected = [...pending.current.values()].some((entry) => entry.draft.id !== entry.stored?.id);
    setStorageWarning(unprotected ? "This browser could not save the latest recovery copy. Keep this page open until saving succeeds, or download your draft." : "");
  }
  function persist(draft: StudyDraft, previous: StudyDraft | null, recoveredSource?: StudyDraft): Pending {
    const storage = browserDraftStorage();
    const stored = storage && writeStudyDraft(storage, draft, previous) ? draft : previous;
    return { draft, stored, recoveredSource };
  }
  function remove(entry: Pending) {
    const storage = browserDraftStorage();
    if (storage && entry.stored) removeStudyDraft(storage, entry.stored);
  }
  function acknowledgeRecovery(entry: Pending, savedTree: AnalysisTree) {
    // A recovery may belong to another still-open tab. Keep its immutable
    // source until that exact content has been acknowledged by the server.
    const source = entry.recoveredSource;
    const storage = browserDraftStorage();
    if (source && storage && studyTreeSignature(source.tree) === studyTreeSignature(savedTree)) removeStudyDraft(storage, source);
  }
  function cancelTimers() { timers.current.forEach(clearTimeout); timers.current.clear(); }

  function initialize(ownerKey: string, initialChapters: StudyChapter[], editable: boolean) {
    generation.current++; cancelTimers(); pending.current.clear(); inFlight.current.clear(); failed.current.clear(); conflictsRef.current.clear();
    owner.current = ownerKey; chapters.current = new Map(initialChapters.map((chapter) => [chapter.id, chapter]));
    setSessionEnded(false); setError(""); setStatus("idle"); setConflicts([]);
    const storage = browserDraftStorage();
    const result = storage && ownerKey && editable ? readStudyDrafts(storage, ownerKey, studyId) : { drafts: [], available: !editable || Boolean(storage) };
    // A response may have been committed just before the tab crashed. Such a
    // snapshot is already on the server and does not need a recovery prompt.
    const seen = new Set<string>();
    setRecoveries(result.drafts.filter((draft) => {
      const tree = studyTreeSignature(draft.tree);
      if (studyTreeSignature(chapters.current.get(draft.chapterId)?.tree) === tree) {
        if (storage) removeStudyDraft(storage, draft);
        return false;
      }
      // Identical snapshots can remain after a crash while recovering. Keep
      // the keys for other tabs, but offer only one prompt per distinct tree.
      const signature = JSON.stringify([draft.chapterId, draft.baseVersion, tree]);
      if (seen.has(signature)) return false;
      seen.add(signature); return true;
    }));
    setStorageWarning(result.available ? "" : "Recovery storage is unavailable on this browser. Keep this page open until changes are saved online.");
  }

  async function flush(chapterId: string): Promise<boolean> {
    const running = inFlight.current.get(chapterId);
    if (running) {
      const waitingGeneration = generation.current;
      await running;
      if (generation.current !== waitingGeneration || !owner.current) return false;
      return pending.current.has(chapterId) && !failed.current.has(chapterId) ? flush(chapterId) : !pending.current.has(chapterId);
    }
    const entry = pending.current.get(chapterId);
    if (!entry) return true;
    if (!owner.current || conflictsRef.current.has(chapterId)) return false;
    clearTimeout(timers.current.get(chapterId));
    const runGeneration = generation.current;
    failed.current.delete(chapterId); setStatus("saving");
    const request = (async () => {
      try {
        const response = await fetch(`/api/chess/studies/${encodeURIComponent(studyId)}/chapters/${encodeURIComponent(chapterId)}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tree: entry.draft.tree, version: entry.draft.baseVersion })
        });
        const body = await response.json().catch(() => ({})) as { chapter?: StudyChapter; error?: string };
        if (generation.current !== runGeneration) return false;
        if (response.status === 409) conflictsRef.current.add(chapterId);
        if (!response.ok || !body.chapter) throw new Error(body.error ?? "Chapter could not be saved.");
        chapters.current.set(chapterId, body.chapter); callbacksRef.current.onSaved(body.chapter);
        acknowledgeRecovery(entry, body.chapter.tree);
        const latest = pending.current.get(chapterId);
        if (latest?.draft.id === entry.draft.id) { pending.current.delete(chapterId); remove(latest); }
        else if (latest) {
          // The response acknowledges only the sent snapshot. Rebase newer
          // edits, persist them, then send them in the next versioned request.
          pending.current.set(chapterId, persist(createStudyDraft({ ...latest.draft, baseVersion: body.chapter.version }), latest.stored, latest.recoveredSource));
        }
        setError(""); return true;
      } catch (cause) {
        if (generation.current === runGeneration) { failed.current.add(chapterId); setError(cause instanceof Error ? cause.message : "Chapter could not be saved."); }
        return false;
      } finally {
        if (generation.current === runGeneration) {
          inFlight.current.delete(chapterId); refresh();
          if (pending.current.has(chapterId) && !failed.current.has(chapterId) && !conflictsRef.current.has(chapterId)) timers.current.set(chapterId, setTimeout(() => void flush(chapterId), 200));
        }
      }
    })();
    inFlight.current.set(chapterId, request); return request;
  }

  function queue(chapterId: string, tree: AnalysisTree, recovered?: StudyDraft) {
    const chapter = chapters.current.get(chapterId);
    if (!owner.current || !chapter) return;
    const previous = pending.current.get(chapterId);
    const draft = createStudyDraft({ ownerKey: owner.current, studyId, chapterId, chapterTitle: chapter.title, tree, baseVersion: recovered?.baseVersion ?? previous?.draft.baseVersion ?? chapter.version });
    pending.current.set(chapterId, persist(draft, previous?.stored ?? null, previous?.recoveredSource ?? recovered));
    clearTimeout(timers.current.get(chapterId));
    if (draft.baseVersion !== chapter.version && !inFlight.current.has(chapterId)) conflictsRef.current.add(chapterId);
    if (!conflictsRef.current.has(chapterId)) { failed.current.delete(chapterId); timers.current.set(chapterId, setTimeout(() => void flush(chapterId), 800)); }
    refresh();
  }
  function recover(draft: StudyDraft) {
    if (draft.ownerKey !== owner.current || !chapters.current.has(draft.chapterId)) return;
    if (pending.current.has(draft.chapterId)) {
      setError("Save or discard the current chapter draft before restoring another. You can also save the other recovery as a new chapter.");
      return;
    }
    queue(draft.chapterId, draft.tree, draft); callbacksRef.current.onRestored(draft.chapterId, draft.tree);
    setRecoveries((items) => items.filter((item) => item.id !== draft.id));
  }
  function discardRecovery(draft: StudyDraft) {
    const storage = browserDraftStorage();
    if (!storage || !removeStudyDraft(storage, draft)) { setStorageWarning("The recovery copy could not be removed from browser storage."); return; }
    setRecoveries((items) => items.filter((item) => item.id !== draft.id));
  }
  async function saveCopy(draft: StudyDraft) {
    if (draft.ownerKey !== owner.current || copying.current.has(draft.id)) return;
    copying.current.add(draft.id);
    const runGeneration = generation.current;
    try {
      const response = await fetch(`/api/chess/studies/${encodeURIComponent(studyId)}/chapters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `${draft.chapterTitle.slice(0, 100)} (recovered)`, analysisTree: draft.tree, recoveryId: draft.id }) });
      const body = await response.json().catch(() => ({})) as { chapter?: StudyChapter; error?: string };
      if (generation.current !== runGeneration) return;
      if (!response.ok || !body.chapter) throw new Error(body.error ?? "Recovered chapter could not be saved.");
      chapters.current.set(body.chapter.id, body.chapter);
      const latest = pending.current.get(draft.chapterId);
      if (latest?.draft.id === draft.id) {
        acknowledgeRecovery(latest, body.chapter.tree);
        remove(latest); pending.current.delete(draft.chapterId); conflictsRef.current.delete(draft.chapterId); failed.current.delete(draft.chapterId);
        const saved = chapters.current.get(draft.chapterId);
        if (saved) callbacksRef.current.onRestored(saved.id, saved.tree);
      }
      callbacksRef.current.onCreated(body.chapter);
      const storage = browserDraftStorage(); if (storage) removeStudyDraft(storage, draft);
      setRecoveries((items) => items.filter((item) => item.id !== draft.id)); setError(""); refresh();
    } catch (cause) { if (generation.current === runGeneration) setError(cause instanceof Error ? cause.message : "Recovered chapter could not be saved."); }
    finally { copying.current.delete(draft.id); }
  }
  async function useServer(chapterId: string) {
    const runGeneration = generation.current;
    const requestedDraftId = pending.current.get(chapterId)?.draft.id;
    try {
      const response = await fetch(`/api/chess/studies/${encodeURIComponent(studyId)}`, { cache: "no-store" });
      const body = await response.json() as { chapters?: StudyChapter[]; draftOwnerKey?: string };
      if (generation.current !== runGeneration) return;
      const chapter = body.chapters?.find((item) => item.id === chapterId);
      if (!response.ok || body.draftOwnerKey !== owner.current || !chapter) throw new Error("Saved chapter could not be reloaded.");
      if (pending.current.get(chapterId)?.draft.id !== requestedDraftId) throw new Error("You made newer edits while the saved chapter was loading. Review them before discarding.");
      const latest = pending.current.get(chapterId); if (latest) remove(latest);
      clearTimeout(timers.current.get(chapterId)); pending.current.delete(chapterId); failed.current.delete(chapterId); conflictsRef.current.delete(chapterId);
      chapters.current.set(chapterId, chapter); callbacksRef.current.onRestored(chapterId, chapter.tree); callbacksRef.current.onSaved(chapter); setError(""); refresh();
    } catch (cause) { if (generation.current === runGeneration) setError(cause instanceof Error ? cause.message : "Saved chapter could not be reloaded."); }
  }

  useEffect(() => {
    function endSession() {
      generation.current++; owner.current = ""; cancelTimers(); pending.current.clear(); inFlight.current.clear();
      setRecoveries([]); setSessionEnded(true);
    }
    function storageEvent(event: StorageEvent) { if (event.key === STUDY_SESSION_KEY) endSession(); }
    function beforeUnload(event: BeforeUnloadEvent) {
      if ([...pending.current.values()].some((entry) => entry.draft.id !== entry.stored?.id)) { event.preventDefault(); event.returnValue = ""; }
    }
    function leaving(event: MouseEvent) {
      if (event.defaultPrevented || ![...pending.current.values()].some((entry) => entry.draft.id !== entry.stored?.id)) return;
      const anchor = (event.target as HTMLElement).closest?.("a[href]");
      if (anchor && !anchor.hasAttribute("download") && !window.confirm("The latest Study edits could not be saved on this device. Leave without saving them?")) { event.preventDefault(); event.stopPropagation(); }
    }
    window.addEventListener(STUDY_SESSION_EVENT, endSession); window.addEventListener("storage", storageEvent); window.addEventListener("beforeunload", beforeUnload); document.addEventListener("click", leaving, true);
    let channel: BroadcastChannel | null = null;
    try { if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(STUDY_SESSION_EVENT); } catch { /* Restricted browser; use local/storage events. */ }
    if (channel) channel.onmessage = endSession;
    return () => { generation.current++; owner.current = ""; cancelTimers(); window.removeEventListener(STUDY_SESSION_EVENT, endSession); window.removeEventListener("storage", storageEvent); window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", leaving, true); channel?.close(); };
  }, [studyId]);

  return { status, error, storageWarning, recoveries, conflicts, sessionEnded, initialize, queue, flush, recover, discardRecovery, saveCopy, useServer,
    retry: () => { for (const id of pending.current.keys()) void flush(id); },
    version: (chapter: StudyChapter) => chapters.current.get(chapter.id)?.version ?? chapter.version,
    accept: (chapter: StudyChapter) => chapters.current.set(chapter.id, chapter),
    dirty: (chapterId: string) => pending.current.has(chapterId),
    currentDraft: (chapterId: string) => pending.current.get(chapterId)?.draft,
  };
}
