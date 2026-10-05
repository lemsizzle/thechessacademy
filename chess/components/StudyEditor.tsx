"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisTree, StudyChapter } from "@/chess/analysis/types";
import { AnalysisWorkspace } from "@/chess/components/AnalysisWorkspace";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AddGameChapterDialog } from "@/chess/components/AddGameChapterDialog";
import { AddPositionChapterDialog } from "@/chess/components/AddPositionChapterDialog";
import { StudyMembersDialog } from "@/chess/components/StudyMembersDialog";
import { StudyAssignmentsDialog } from "@/chess/components/StudyAssignmentsDialog";
import { StudyReviewAssignments } from "@/chess/components/StudyReviewAssignments";
import { GuidedExerciseProgress } from "@/chess/components/GuidedExerciseProgress";
import { useStudyDrafts } from "@/chess/hooks/useStudyDrafts";
import { StudyDraftRecovery, downloadStudyDraft } from "@/chess/components/StudyDraftRecovery";

type StudyData = { id: string; title: string; description: string; visibility: string; ownerKind: string; accessRole: "owner" | "editor" | "viewer"; updatedAt: string };


export function StudyEditor({ studyId, basePath, initialChapterId }: { studyId: string; basePath: "/student" | "/admin"; initialChapterId?: string }) {
  const router = useRouter();
  const [study, setStudy] = useState<StudyData | null>(null);
  const [chapters, setChapters] = useState<StudyChapter[]>([]);
  const [activeChapterId, setActiveChapterId] = useState("");
  const [error, setError] = useState("");
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [addGameOpen, setAddGameOpen] = useState(false);
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const drafts = useStudyDrafts(studyId, {
    onSaved: (chapter) => setChapters((items) => items.map((item) => item.id === chapter.id ? { ...item, version: chapter.version, updatedAt: chapter.updatedAt } : item)),
    onRestored: (chapterId, tree) => {
      setChapters((items) => items.map((item) => item.id === chapterId ? { ...item, tree } : item));
      setActiveChapterId(chapterId); setWorkspaceRevision((value) => value + 1);
    },
    onCreated: (chapter) => { setChapters((items) => [...items, chapter]); setActiveChapterId(chapter.id); }
  });
  const saveStatus = drafts.status;
  const visibleError = error || drafts.error;

  useEffect(() => {
    let cancelled = false;
    setStudy(null);
    fetch(`/api/chess/studies/${encodeURIComponent(studyId)}`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => ({})) as { study?: StudyData; chapters?: StudyChapter[]; draftOwnerKey?: string; error?: string };
      if (!response.ok || !body.study || !body.chapters || !body.draftOwnerKey) throw new Error(body.error ?? "Study could not be loaded.");
      if (cancelled) return;
      drafts.initialize(body.draftOwnerKey, body.chapters, body.study.accessRole !== "viewer");
      setStudy(body.study); setChapters(body.chapters);
      setActiveChapterId(body.chapters.some((chapter) => chapter.id === initialChapterId) ? initialChapterId! : body.chapters[0]?.id ?? "");
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Study could not be loaded."); });
    return () => { cancelled = true; };
  }, [initialChapterId, studyId]);

  const active = chapters.find((chapter) => chapter.id === activeChapterId) ?? chapters[0];
  const editable = study?.accessRole !== "viewer";

  function queueTree(chapterId: string, tree: AnalysisTree) {
    setChapters((items) => items.map((item) => item.id === chapterId ? { ...item, tree } : item));
    drafts.queue(chapterId, tree);
  }

  async function addChapter(duplicateChapterId?: string) {
    if (duplicateChapterId && drafts.dirty(duplicateChapterId)) { setError("Save or recover the chapter before duplicating it."); return; }
    const response = await fetch(`/api/chess/studies/${studyId}/chapters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ duplicateChapterId }) });
    const body = await response.json().catch(() => ({})) as { chapter?: StudyChapter; error?: string };
    if (!response.ok || !body.chapter) { setError(body.error ?? "Chapter could not be created."); return; }
    drafts.accept(body.chapter);
    setChapters((items) => [...items, body.chapter!]);
    setActiveChapterId(body.chapter.id);
  }

  async function renameChapter(chapter: StudyChapter) {
    if (drafts.dirty(chapter.id)) return;
    const title = window.prompt("Chapter title", chapter.title)?.trim();
    if (!title || title === chapter.title) return;
    const response = await fetch(`/api/chess/studies/${studyId}/chapters/${chapter.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, version: drafts.version(chapter) }) });
    const body = await response.json().catch(() => ({})) as { chapter?: StudyChapter; error?: string };
    if (!response.ok || !body.chapter) { setError(body.error ?? "Chapter could not be renamed."); return; }
    drafts.accept(body.chapter);
    setChapters((items) => items.map((item) => item.id === chapter.id ? body.chapter! : item));
  }

  async function removeChapter(chapter: StudyChapter) {
    if (drafts.dirty(chapter.id)) return;
    if (!window.confirm(`Delete “${chapter.title}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/chess/studies/${studyId}/chapters/${chapter.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setError(body.error ?? "Chapter could not be deleted."); return; }
    setChapters((items) => items.filter((item) => item.id !== chapter.id));
    setActiveChapterId((current) => current === chapter.id ? chapters.find((item) => item.id !== chapter.id)?.id ?? "" : current);
  }

  async function moveChapter(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= chapters.length) return;
    const next = [...chapters];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setChapters(next);
    const response = await fetch(`/api/chess/studies/${studyId}/chapters`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapterIds: next.map((item) => item.id) }) });
    if (!response.ok) setError((await response.json().catch(() => ({})) as { error?: string }).error ?? "Chapter order could not be saved.");
  }

  async function renameStudy() {
    if (!study) return;
    const title = window.prompt("Study title", study.title)?.trim();
    if (!title || title === study.title) return;
    const response = await fetch(`/api/chess/studies/${studyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (!response.ok) { setError((await response.json().catch(() => ({})) as { error?: string }).error ?? "Study could not be renamed."); return; }
    setStudy({ ...study, title });
  }

  async function removeStudy() {
    if (!study || !window.confirm(`Delete “${study.title}” and all its chapters?`)) return;
    const response = await fetch(`/api/chess/studies/${studyId}`, { method: "DELETE" });
    if (!response.ok) { setError((await response.json().catch(() => ({})) as { error?: string }).error ?? "Study could not be deleted."); return; }
    router.push(`${basePath}/studies`);
  }

  if (drafts.sessionEnded) return <Card className="p-6">Your session ended. Sign in again to reopen this study.</Card>;
  if (error && !study) return <Card className="p-6 text-rose-100">{error} <Button className="ml-3" variant="ghost" href={`${basePath}/studies`}>Back</Button></Card>;
  if (!study || !active) return <Card className="p-6 text-sm text-slate-300">Loading study chapters…</Card>;

  return <div className="space-y-4">
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-black uppercase text-cyan-200">{study.accessRole} · {study.visibility}</p><h2 className="text-2xl font-black text-white">{study.title}</h2><p className="mt-1 text-sm text-slate-400">{study.description || "A Chess Academy study."}</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="ghost" href={`${basePath}/studies`}>Library</Button>{basePath === "/admin" && study.accessRole === "owner" ? <><Button type="button" variant="ghost" onClick={() => setMembersOpen(true)}>Manage Access</Button><Button type="button" variant="secondary" onClick={() => setAssignmentsOpen(true)}>Assign Review</Button></> : null}{editable ? <Button type="button" variant="ghost" onClick={renameStudy}>Rename</Button> : null}{study.accessRole === "owner" ? <Button type="button" variant="ghost" onClick={removeStudy}>Delete</Button> : null}</div>
      </div>
      {visibleError && <p role="alert" className="mt-3 rounded-md border border-rose-300/30 bg-rose-300/10 p-2 text-xs text-rose-100">{visibleError}</p>}
      {saveStatus === "error" && <Button type="button" className="mt-2" variant="secondary" onClick={drafts.retry}>Retry saving</Button>}
      <div aria-label="Study chapters" className="scrollbar-soft mt-4 flex gap-2 overflow-x-auto pb-2">
        {chapters.map((chapter) => <button key={chapter.id} type="button" aria-pressed={chapter.id === active.id} className={`min-h-11 max-w-64 shrink-0 truncate rounded-md border px-4 text-sm font-bold ${chapter.id === active.id ? "border-cyan-200/50 bg-cyan-300/12 text-white" : "border-white/10 text-slate-300"}`} onClick={() => setActiveChapterId(chapter.id)}>{chapter.title}</button>)}
      </div>
      {editable && <div className="mt-2 flex flex-wrap items-start gap-2">
        <Button className="min-h-11" type="button" variant="ghost" onClick={() => setAddGameOpen(true)}>+ Completed Game</Button>
        <Button className="min-h-11" type="button" variant="ghost" onClick={() => setAddPositionOpen(true)}>+ PGN / FEN</Button>
        <Button className="min-h-11" type="button" variant="ghost" onClick={() => void addChapter()}>+ Blank Chapter</Button>
        <Button className="min-h-11" type="button" variant="ghost" disabled={drafts.dirty(active.id)} onClick={() => void addChapter(active.id)}>Duplicate</Button>
        <details className="relative min-w-56" onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
          <summary className="flex min-h-11 cursor-pointer items-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-bold text-white">Chapter actions</summary>
          <div className="absolute left-0 z-30 mt-1 w-56 rounded-lg border border-white/15 bg-slate-950 p-1 shadow-xl" onClick={(event) => { if ((event.target as HTMLElement).closest("button:not(:disabled)")) { const menu = event.currentTarget.closest("details"); menu?.removeAttribute("open"); menu?.querySelector("summary")?.focus({ preventScroll: true }); } }}>
            <button type="button" disabled={chapters.indexOf(active) === 0} className="min-h-11 w-full rounded px-3 text-left text-sm hover:bg-white/10 disabled:opacity-40" onClick={() => void moveChapter(chapters.indexOf(active), -1)}>Move chapter left</button>
            <button type="button" disabled={chapters.indexOf(active) === chapters.length - 1} className="min-h-11 w-full rounded px-3 text-left text-sm hover:bg-white/10 disabled:opacity-40" onClick={() => void moveChapter(chapters.indexOf(active), 1)}>Move chapter right</button>
            <button type="button" disabled={drafts.dirty(active.id)} className="min-h-11 w-full rounded px-3 text-left text-sm hover:bg-white/10 disabled:opacity-40" onClick={() => void renameChapter(active)}>Rename chapter</button>
            <button type="button" disabled={drafts.dirty(active.id)} className="min-h-11 w-full rounded px-3 text-left text-sm text-rose-200 hover:bg-white/10 disabled:opacity-40" onClick={() => void removeChapter(active)}>Delete chapter</button>
          </div>
        </details>
      </div>}
    </Card>
    <StudyDraftRecovery recoveries={drafts.recoveries} chapters={chapters} onRecover={drafts.recover} onCopy={drafts.saveCopy} onDiscard={drafts.discardRecovery} />
    {drafts.storageWarning && <Card className="p-4"><p role="alert" className="text-sm text-amber-100">{drafts.storageWarning}</p>{drafts.currentDraft(active.id) && <Button className="mt-2 min-h-11" onClick={() => downloadStudyDraft(drafts.currentDraft(active.id)!)}>Download draft</Button>}</Card>}
    {drafts.conflicts.includes(active.id) && <Card className="p-4"><p role="alert" className="text-sm text-amber-100">This chapter changed elsewhere. Your edits have not overwritten the saved chapter.</p><div className="mt-3 flex flex-wrap gap-2"><Button className="min-h-11" onClick={() => { const draft = drafts.currentDraft(active.id); if (draft) void drafts.saveCopy(draft); }}>Save draft as new chapter</Button><Button className="min-h-11" variant="ghost" onClick={() => { if (window.confirm("Discard this local draft and load the latest saved chapter?")) void drafts.useServer(active.id); }}>Use saved chapter</Button></div></Card>}
    {basePath === "/student" ? <StudyReviewAssignments studyId={studyId} /> : null}
    {basePath === "/admin" ? <GuidedExerciseProgress studyId={studyId} /> : null}
    <AnalysisWorkspace key={`${active.id}:${workspaceRevision}`} initialTree={active.tree} title={active.title} subtitle={`${active.tree.nodes[active.tree.rootId].childrenIds.length ? "Game line with variations" : "Blank analysis board"} · chapter ${chapters.indexOf(active) + 1} of ${chapters.length}`} editable={editable} saveStatus={saveStatus} saveMessage={saveStatus === "saved" ? "All changes saved" : visibleError} onTreeChange={(tree) => queueTree(active.id, tree)} canManageReferenceEvaluations={basePath === "/admin" && editable} canManageGuidedExercises={basePath === "/admin" && editable} guidedStudentMode={basePath === "/student"} guidedExerciseContext={{ studyId, chapterId: active.id }} actions={<Button variant="ghost" href={`/api/chess/studies/${encodeURIComponent(studyId)}/chapters/${encodeURIComponent(active.id)}/pgn`}>Export PGN</Button>} />
    {addGameOpen && <AddGameChapterDialog studyId={studyId} onClose={() => setAddGameOpen(false)} onAdded={(chapter) => {
      drafts.accept(chapter);
      setChapters((items) => [...items, chapter]);
      setActiveChapterId(chapter.id);
      setAddGameOpen(false);
    }} />}
    {addPositionOpen && <AddPositionChapterDialog studyId={studyId} onClose={() => setAddPositionOpen(false)} onAdded={(chapter) => {
      drafts.accept(chapter);
      setChapters((items) => [...items, chapter]);
      setActiveChapterId(chapter.id);
      setAddPositionOpen(false);
    }} />}
    {membersOpen && <StudyMembersDialog studyId={studyId} onClose={() => setMembersOpen(false)} onChanged={() => setStudy((current) => current ? { ...current, visibility: "shared" } : current)} />}
    {assignmentsOpen && <StudyAssignmentsDialog studyId={studyId} chapters={chapters} onClose={() => setAssignmentsOpen(false)} onAssigned={() => setStudy((current) => current ? { ...current, visibility: "shared" } : current)} />}
  </div>;
}
