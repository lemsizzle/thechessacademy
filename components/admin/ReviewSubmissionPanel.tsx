"use client";

import { Button } from "@/components/Button";

export function ReviewSubmissionPanel({
  teacherNote,
  onTeacherNoteChange,
  onApprove,
  onReject,
  onNeedsChanges,
  approveLabel = "Approve"
}: {
  teacherNote: string;
  onTeacherNoteChange: (note: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onNeedsChanges: () => void;
  approveLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <textarea
        className="min-h-20 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
        value={teacherNote}
        onChange={(event) => onTeacherNoteChange(event.target.value)}
        placeholder="Teacher note"
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onApprove}>{approveLabel}</Button>
        <Button variant="ghost" onClick={onNeedsChanges}>Needs Changes</Button>
        <Button variant="ghost" onClick={onReject}>Reject</Button>
      </div>
    </div>
  );
}
