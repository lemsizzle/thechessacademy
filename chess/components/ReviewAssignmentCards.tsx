"use client";

import { useState } from "react";
import type { ReviewAssignment } from "@/chess/analysis/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

function assignmentStatusStyle(status: ReviewAssignment["status"]) {
  if (status === "approved") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  if (status === "returned") return "border-rose-300/30 bg-rose-300/10 text-rose-100";
  if (status === "submitted") return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
  return "border-amber-300/30 bg-amber-300/10 text-amber-100";
}

export function ReviewAssignmentCards({ initialAssignments, basePath, emptyMessage, onAssignmentUpdated }: {
  initialAssignments: ReviewAssignment[];
  basePath: "/student" | "/admin";
  emptyMessage?: string;
  onAssignmentUpdated?: (assignment: ReviewAssignment) => void;
}) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [responses, setResponses] = useState<Record<string, string>>(() => Object.fromEntries(initialAssignments.map((assignment) => [assignment.id, assignment.studentResponse])));
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  async function submitResponse(assignment: ReviewAssignment) {
    setSavingId(assignment.id);
    setError("");
    try {
      const response = await fetch(`/api/chess/review-assignments/${encodeURIComponent(assignment.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentResponse: responses[assignment.id] ?? "" })
      });
      const body = await response.json().catch(() => ({})) as { assignment?: ReviewAssignment; error?: string };
      if (!response.ok || !body.assignment) throw new Error(body.error ?? "Your answer could not be submitted.");
      setAssignments((current) => current.map((item) => item.id === assignment.id ? body.assignment! : item));
      onAssignmentUpdated?.(body.assignment);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your answer could not be submitted.");
    } finally {
      setSavingId("");
    }
  }

  if (!assignments.length) return emptyMessage ? <Card className="p-4 text-sm text-slate-400">{emptyMessage}</Card> : null;

  return <div className="space-y-3">
    {error ? <p className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100" role="alert">{error}</p> : null}
    {assignments.map((assignment) => {
      const canSubmit = assignment.status === "assigned" || assignment.status === "returned";
      return <Card key={assignment.id} className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-white">{assignment.studyTitle}</h3>
            <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${assignmentStatusStyle(assignment.status)}`}>{assignment.status}</span>
          </div>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-cyan-200">{assignment.chapterTitle ?? "Entire study"}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{assignment.prompt}</p>
          {assignment.teacherFeedback ? <div className="mt-3 rounded-md border border-cyan-300/25 bg-cyan-300/10 p-3"><p className="text-xs font-black uppercase tracking-wide text-cyan-200">Teacher feedback</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-cyan-50">{assignment.teacherFeedback}</p></div> : null}
          {canSubmit ? <label className="mt-4 block text-xs font-black uppercase tracking-wide text-slate-300">{assignment.status === "returned" ? "Revise your answer" : "Your answer"}
            <textarea aria-label={`Answer for ${assignment.studyTitle}`} value={responses[assignment.id] ?? ""} maxLength={4000} disabled={savingId === assignment.id} onChange={(event) => setResponses((current) => ({ ...current, [assignment.id]: event.target.value }))} placeholder="Explain the move, plan, or idea in your own words." className="mt-1 min-h-28 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-normal normal-case leading-6 text-white" />
          </label> : assignment.studentResponse ? <div className="mt-3 rounded-md border border-white/10 bg-white/5 p-3"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Your submitted answer</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">{assignment.studentResponse}</p></div> : null}
          {assignment.status === "submitted" ? <p className="mt-3 text-xs font-bold text-cyan-200">Submitted for teacher review.</p> : assignment.status === "approved" ? <p className="mt-3 text-xs font-bold text-emerald-200">Approved by your teacher.</p> : null}
          {assignment.teacherAnswer ? <div className="mt-3 rounded-md border border-emerald-300/25 bg-emerald-300/10 p-3"><p className="text-xs font-black uppercase tracking-wide text-emerald-200">Teacher answer</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-emerald-50">{assignment.teacherAnswer}</p></div> : assignment.hasTeacherAnswer ? <p className="mt-3 text-xs text-slate-500">{assignment.answerVisibility === "after_completion" ? "Submit your answer to reveal the teacher answer." : "The teacher answer is private."}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" href={`${basePath}/studies/${assignment.studyId}${assignment.chapterId ? `?chapter=${encodeURIComponent(assignment.chapterId)}` : ""}`}>Open review</Button>
          {basePath === "/student" && canSubmit ? <Button type="button" variant="ghost" disabled={savingId === assignment.id || !(responses[assignment.id] ?? "").trim()} onClick={() => void submitResponse(assignment)}>{savingId === assignment.id ? "Submitting…" : assignment.status === "returned" ? "Resubmit answer" : "Submit answer"}</Button> : null}
        </div>
      </div>
    </Card>})}
  </div>;
}
