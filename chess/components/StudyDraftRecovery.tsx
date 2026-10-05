"use client";

import type { StudyChapter } from "@/chess/analysis/types";
import type { StudyDraft } from "@/chess/analysis/studyDrafts";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export function downloadStudyDraft(draft: StudyDraft) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `study-draft-${draft.id}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StudyDraftRecovery({ recoveries, chapters, onRecover, onCopy, onDiscard }: {
  recoveries: StudyDraft[]; chapters: StudyChapter[];
  onRecover: (draft: StudyDraft) => void; onCopy: (draft: StudyDraft) => Promise<void>; onDiscard: (draft: StudyDraft) => void;
}) {
  if (!recoveries.length) return null;
  return <section role="region" aria-label="Study recovery"><Card className="p-4">
    <h3 className="font-black text-cyan-100">Unsaved work on this device</h3>
    <p className="mt-1 text-sm text-slate-300">Choose a draft to recover. Browser copies are kept for up to 30 days and removed when you log out.</p>
    <div className="mt-3 space-y-3">{recoveries.map((draft) => {
      const chapter = chapters.find((item) => item.id === draft.chapterId);
      const changed = chapter?.version !== draft.baseVersion;
      return <div key={draft.id} className="rounded-lg border border-white/10 p-3">
        <p className="break-words font-bold">{draft.chapterTitle}</p><p className="mt-1 text-xs text-slate-400">{new Date(draft.updatedAt).toLocaleString()}</p>
        {changed && <p className="mt-2 text-sm text-amber-100">The saved chapter has changed or was deleted. Save a recovered copy to keep both versions.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {chapter && <Button className="min-h-11" onClick={() => onRecover(draft)}>{changed ? "Review draft" : "Restore draft"}</Button>}
          <Button className="min-h-11" variant="secondary" onClick={() => void onCopy(draft)}>Save recovered copy</Button>
          <Button className="min-h-11" variant="ghost" onClick={() => downloadStudyDraft(draft)}>Download draft</Button>
          <Button className="min-h-11" variant="ghost" onClick={() => { if (window.confirm("Discard this recovery copy?")) onDiscard(draft); }}>Discard draft</Button>
        </div>
      </div>;
    })}</div>
  </Card></section>;
}
