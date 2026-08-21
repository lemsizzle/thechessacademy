"use client";

import { useEffect, useRef, useState } from "react";
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

type StudyData = { id: string; title: string; description: string; visibility: string; ownerKind: string; accessRole: "owner" | "editor" | "viewer"; updatedAt: string };
type PendingSave = { tree: AnalysisTree; version: number };

export function StudyEditor({ studyId, basePath, initialChapterId }: { studyId: string; basePath: "/student" | "/admin"; initialChapterId?: string }) {
  const router = useRouter();
  const [study, setStudy] = useState<StudyData | null>(null);
  const [chapters, setChapters] = useState<StudyChapter[]>([]);
  const [activeChapterId, setActiveChapterId] = useState("");
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [addGameOpen, setAddGameOpen] = useState(false);
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const pendingRef = useRef(new Map<string, PendingSave>());
  const timersRef = useRef(new Map<string, number>());
  const inFlightRef = useRef(new Set<string>());
  const versionsRef = useRef(new Map<string, number>());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chess/studies/${encodeURIComponent(studyId)}`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => ({})) as { study?: StudyData; chapters?: StudyChapter[]; error?: string };
      if (!response.ok || !body.study || !body.chapters) throw new Error(body.error ?? "Study could not be loaded.");
      if (cancelled) return;
      setStudy(body.study);
      setChapters(body.chapters);
      setActiveChapterId(body.chapters.some((chapter) => chapter.id === initialChapterId) ? initialChapterId! : body.chapters[0]?.id ?? "");
      versionsRef.current = new Map(body.chapters.map((chapter) => [chapter.id, chapter.version]));
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Study could not be loaded."); });
    return () => {
      cancelled = true;
      for (const timer of timersRef.current.values()) window.clearTimeout(timer);
    };
  }, [initialChapterId, studyId]);

  const active = chapters.find((chapter) => chapter.id === activeChapterId) ?? chapters[0];
  const editable = study?.accessRole !== "viewer";

  async function flush(chapterId: string) {
    if (inFlightRef.current.has(chapterId)) return;
    const pending = pendingRef.current.get(chapterId);
    if (!pending) return;
    pendingRef.current.delete(chapterId);
    inFlightRef.current.add(chapterId);
    setSaveStatus("saving");
    try {
      const version = versionsRef.current.get(chapterId) ?? pending.version;
      const response = await fetch(`/api/chess/studies/${studyId}/chapters/${chapterId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tree: pending.tree, version })
      });
      const body = await response.json().catch(() => ({})) as { chapter?: StudyChapter; error?: string };
      if (!response.ok || !body.chapter) throw new Error(body.error ?? "Chapter could not be saved.");
      versionsRef.current.set(chapterId, body.chapter.version);
      setChapters((items) => items.map((item) => item.id === chapterId ? { ...item, version: body.chapter!.version, updatedAt: body.chapter!.updatedAt } : item));
      setSaveStatus("saved");
    } catch (cause) {
      setSaveStatus("error");
      setError(cause instanceof Error ? cause.message : "Chapter could not be saved.");
    } finally {
      inFlightRef.current.delete(chapterId);
      if (pendingRef.current.has(chapterId)) timersRef.current.set(chapterId, window.setTimeout(() => void flush(chapterId), 200));
    }
  }

  function queueTree(chapterId: string, tree: AnalysisTree) {
    setChapters((items) => items.map((item) => item.id === chapterId ? { ...item, tree } : item));
    pendingRef.current.set(chapterId, { tree, version: versionsRef.current.get(chapterId) ?? 1 });
    const current = timersRef.current.get(chapterId);
    if (current) window.clearTimeout(current);
    timersRef.current.set(chapterId, window.setTimeout(() => void flush(chapterId), 800));
    setSaveStatus("saving");
  }

  async function addChapter(duplicateChapterId?: string) {
    const response = await fetch(`/api/chess/studies/${studyId}/chapters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ duplicateChapterId }) });
    const body = await response.json().catch(() => ({})) as { chapter?: StudyChapter; error?: string };
    if (!response.ok || !body.chapter) { setError(body.error ?? "Chapter could not be created."); return; }
    versionsRef.current.set(body.chapter.id, body.chapter.version);
    setChapters((items) => [...items, body.chapter!]);
    setActiveChapterId(body.chapter.id);
  }

  async function renameChapter(chapter: StudyChapter) {
    const title = window.prompt("Chapter title", chapter.title)?.trim();
    if (!title || title === chapter.title) return;
    const response = await fetch(`/api/chess/studies/${studyId}/chapters/${chapter.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, version: versionsRef.current.get(chapter.id) ?? chapter.version }) });
    const body = await response.json().catch(() => ({})) as { chapter?: StudyChapter; error?: string };
    if (!response.ok || !body.chapter) { setError(body.error ?? "Chapter could not be renamed."); return; }
    versionsRef.current.set(chapter.id, body.chapter.version);
    setChapters((items) => items.map((item) => item.id === chapter.id ? body.chapter! : item));
  }

  async function removeChapter(chapter: StudyChapter) {
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

  if (error && !study) return <Card className="p-6 text-rose-100">{error} <Button className="ml-3" variant="ghost" href={`${basePath}/studies`}>Back</Button></Card>;
  if (!study || !active) return <Card className="p-6 text-sm text-slate-300">Loading study chapters…</Card>;

  return <div className="space-y-4">
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-black uppercase text-cyan-200">{study.accessRole} · {study.visibility}</p><h2 className="text-2xl font-black text-white">{study.title}</h2><p className="mt-1 text-sm text-slate-400">{study.description || "A Chess Academy study."}</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="ghost" href={`${basePath}/studies`}>Library</Button>{basePath === "/admin" && study.accessRole === "owner" ? <><Button type="button" variant="ghost" onClick={() => setMembersOpen(true)}>Manage Access</Button><Button type="button" variant="secondary" onClick={() => setAssignmentsOpen(true)}>Assign Review</Button></> : null}{editable ? <Button type="button" variant="ghost" onClick={renameStudy}>Rename</Button> : null}{study.accessRole === "owner" ? <Button type="button" variant="ghost" onClick={removeStudy}>Delete</Button> : null}</div>
      </div>
      {error && <p className="mt-3 rounded-md border border-rose-300/30 bg-rose-300/10 p-2 text-xs text-rose-100">{error}</p>}
      <div className="scrollbar-soft mt-4 flex gap-2 overflow-x-auto pb-1">
        {chapters.map((chapter, index) => <div key={chapter.id} className={`flex shrink-0 items-center rounded-md border ${chapter.id === active.id ? "border-cyan-200/50 bg-cyan-300/12" : "border-white/10 bg-white/5"}`}>
          <button type="button" className="px-3 py-2 text-sm font-bold text-white" onClick={() => setActiveChapterId(chapter.id)}>{chapter.title}</button>
          {editable && <div className="flex border-l border-white/10 px-1 text-xs"><button title="Move chapter left" className="p-1 text-slate-400 hover:text-white" onClick={() => void moveChapter(index, -1)}>←</button><button title="Move chapter right" className="p-1 text-slate-400 hover:text-white" onClick={() => void moveChapter(index, 1)}>→</button><button title="Rename chapter" className="p-1 text-slate-400 hover:text-white" onClick={() => void renameChapter(chapter)}>✎</button><button title="Delete chapter" className="p-1 text-slate-400 hover:text-rose-200" onClick={() => void removeChapter(chapter)}>×</button></div>}
        </div>)}
        {editable && <><Button type="button" variant="ghost" onClick={() => setAddGameOpen(true)}>+ Completed Game</Button><Button type="button" variant="ghost" onClick={() => setAddPositionOpen(true)}>+ PGN / FEN</Button><Button type="button" variant="ghost" onClick={() => void addChapter()}>+ Blank Chapter</Button><Button type="button" variant="ghost" onClick={() => void addChapter(active.id)}>Duplicate</Button></>}
      </div>
    </Card>
    {basePath === "/student" ? <StudyReviewAssignments studyId={studyId} /> : null}
    {basePath === "/admin" ? <GuidedExerciseProgress studyId={studyId} /> : null}
    <AnalysisWorkspace key={active.id} initialTree={active.tree} title={active.title} subtitle={`${active.tree.nodes[active.tree.rootId].childrenIds.length ? "Game line with variations" : "Blank analysis board"} · chapter ${chapters.indexOf(active) + 1} of ${chapters.length}`} editable={editable} saveStatus={saveStatus} saveMessage={saveStatus === "saved" ? "All changes saved" : error} onTreeChange={(tree) => queueTree(active.id, tree)} canManageReferenceEvaluations={basePath === "/admin" && editable} canManageGuidedExercises={basePath === "/admin" && editable} guidedStudentMode={basePath === "/student"} guidedExerciseContext={{ studyId, chapterId: active.id }} actions={<Button variant="ghost" href={`/api/chess/studies/${encodeURIComponent(studyId)}/chapters/${encodeURIComponent(active.id)}/pgn`}>Export PGN</Button>} />
    {addGameOpen && <AddGameChapterDialog studyId={studyId} onClose={() => setAddGameOpen(false)} onAdded={(chapter) => {
      versionsRef.current.set(chapter.id, chapter.version);
      setChapters((items) => [...items, chapter]);
      setActiveChapterId(chapter.id);
      setAddGameOpen(false);
    }} />}
    {addPositionOpen && <AddPositionChapterDialog studyId={studyId} onClose={() => setAddPositionOpen(false)} onAdded={(chapter) => {
      versionsRef.current.set(chapter.id, chapter.version);
      setChapters((items) => [...items, chapter]);
      setActiveChapterId(chapter.id);
      setAddPositionOpen(false);
    }} />}
    {membersOpen && <StudyMembersDialog studyId={studyId} onClose={() => setMembersOpen(false)} onChanged={() => setStudy((current) => current ? { ...current, visibility: "shared" } : current)} />}
    {assignmentsOpen && <StudyAssignmentsDialog studyId={studyId} chapters={chapters} onClose={() => setAssignmentsOpen(false)} onAssigned={() => setStudy((current) => current ? { ...current, visibility: "shared" } : current)} />}
  </div>;
}
