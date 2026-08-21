"use client";

import { useEffect, useState } from "react";
import type { ReviewAnswerVisibility, ReviewAssignment, StudyChapter } from "@/chess/analysis/types";
import type { Student } from "@/lib/types";
import { Button } from "@/components/Button";

function assignmentStatusStyle(status: ReviewAssignment["status"]) {
  if (status === "approved") return "text-emerald-300";
  if (status === "returned") return "text-rose-300";
  if (status === "submitted") return "text-cyan-300";
  return "text-amber-300";
}

export function StudyAssignmentsDialog({ studyId, chapters, onAssigned, onClose }: {
  studyId: string;
  chapters: StudyChapter[];
  onAssigned: () => void;
  onClose: () => void;
}) {
  const [assignments, setAssignments] = useState<ReviewAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [teacherAnswer, setTeacherAnswer] = useState("");
  const [answerVisibility, setAnswerVisibility] = useState<ReviewAnswerVisibility>("after_completion");
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/chess/review-assignments?studyId=${encodeURIComponent(studyId)}`, { cache: "no-store" }),
      fetch("/api/admin/students", { cache: "no-store" })
    ]).then(async ([assignmentResponse, studentResponse]) => {
      const assignmentBody = await assignmentResponse.json().catch(() => ({})) as { assignments?: ReviewAssignment[]; error?: string };
      const studentBody = await studentResponse.json().catch(() => ({})) as { students?: Student[]; error?: string };
      if (!assignmentResponse.ok) throw new Error(assignmentBody.error ?? "Review assignments could not be loaded.");
      if (!studentResponse.ok) throw new Error(studentBody.error ?? "Student roster could not be loaded.");
      if (cancelled) return;
      const loadedAssignments = assignmentBody.assignments ?? [];
      setAssignments(loadedAssignments);
      setFeedbacks(Object.fromEntries(loadedAssignments.map((assignment) => [assignment.id, assignment.teacherFeedback])));
      setStudents(studentBody.students ?? []);
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Review assignments could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studyId]);

  const selectedStudentId = students.some((student) => student.id === studentId) ? studentId : students[0]?.id ?? "";

  async function createAssignment() {
    if (!selectedStudentId || !prompt.trim()) return;
    setSaving("create");
    setError("");
    try {
      const response = await fetch("/api/chess/review-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyId, studentId: selectedStudentId, chapterId: chapterId || null, prompt, teacherAnswer, answerVisibility })
      });
      const body = await response.json().catch(() => ({})) as { assignment?: ReviewAssignment; error?: string };
      if (!response.ok || !body.assignment) throw new Error(body.error ?? "Review could not be assigned.");
      setAssignments((current) => [body.assignment!, ...current]);
      setFeedbacks((current) => ({ ...current, [body.assignment!.id]: "" }));
      setPrompt("");
      setTeacherAnswer("");
      onAssigned();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review could not be assigned.");
    } finally { setSaving(""); }
  }

  async function reviewAssignment(assignment: ReviewAssignment, decision: "approve" | "return" | "reset") {
    if (decision === "reset" && !window.confirm(`Reset ${assignment.studentName}'s response and feedback?`)) return;
    setSaving(assignment.id);
    setError("");
    try {
      const response = await fetch(`/api/chess/review-assignments/${encodeURIComponent(assignment.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, teacherFeedback: feedbacks[assignment.id] ?? "" })
      });
      const body = await response.json().catch(() => ({})) as { assignment?: ReviewAssignment; error?: string };
      if (!response.ok || !body.assignment) throw new Error(body.error ?? "The review decision could not be saved.");
      setAssignments((current) => current.map((item) => item.id === assignment.id ? body.assignment! : item));
      setFeedbacks((current) => ({ ...current, [assignment.id]: body.assignment!.teacherFeedback }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The review decision could not be saved."); }
    finally { setSaving(""); }
  }

  async function removeAssignment(assignment: ReviewAssignment) {
    if (!window.confirm(`Remove this review assignment for ${assignment.studentName}?`)) return;
    setSaving(assignment.id);
    setError("");
    try {
      const response = await fetch(`/api/chess/review-assignments/${encodeURIComponent(assignment.id)}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Review assignment could not be removed.");
      setAssignments((current) => current.filter((item) => item.id !== assignment.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review assignment could not be removed."); }
    finally { setSaving(""); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="study-reviews-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-cyan-200/25 bg-slate-950 p-5 shadow-2xl">
      <h2 id="study-reviews-title" className="text-2xl font-black text-white">Assign student review</h2>
      <p className="mt-1 text-sm text-slate-400">Give a student the whole study or one chapter, add a prompt, and choose when the teacher answer appears.</p>

      <div className="mt-4 grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-300">Student
          <select aria-label="Student" value={selectedStudentId} disabled={loading || Boolean(saving)} onChange={(event) => setStudentId(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-normal normal-case text-white">
            {students.length ? students.map((student) => <option key={student.id} value={student.id}>{student.name}{student.lichessUsername ? ` (@${student.lichessUsername})` : ""}</option>) : <option value="">No active students</option>}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-300">Scope
          <select aria-label="Review scope" value={chapterId} disabled={loading || Boolean(saving)} onChange={(event) => setChapterId(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-normal normal-case text-white">
            <option value="">Entire study</option>
            {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2 text-xs font-bold uppercase tracking-wide text-slate-300">Review prompt
          <textarea aria-label="Review prompt" value={prompt} maxLength={2000} disabled={Boolean(saving)} onChange={(event) => setPrompt(event.target.value)} placeholder="Example: Find the first move where your plan could improve." className="mt-1 min-h-24 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-normal normal-case text-white" />
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-300">Teacher answer (optional)
          <textarea aria-label="Teacher answer" value={teacherAnswer} maxLength={4000} disabled={Boolean(saving)} onChange={(event) => setTeacherAnswer(event.target.value)} placeholder="Explain the key idea or answer." className="mt-1 min-h-24 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-normal normal-case text-white" />
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-300">Show answer
          <select aria-label="Show teacher answer" value={answerVisibility} disabled={Boolean(saving)} onChange={(event) => setAnswerVisibility(event.target.value as ReviewAnswerVisibility)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-normal normal-case text-white">
            <option value="after_completion">After student submits</option>
            <option value="visible">Immediately</option>
            <option value="teacher_only">Teacher only</option>
          </select>
        </label>
        <div className="sm:col-span-2 flex justify-end"><Button type="button" disabled={!selectedStudentId || !prompt.trim() || Boolean(saving)} onClick={() => void createAssignment()}>{saving === "create" ? "Assigning…" : "Assign review"}</Button></div>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
        {loading ? <p className="p-4 text-sm text-slate-400">Loading assignments…</p> : assignments.length ? assignments.map((assignment) => <div key={assignment.id} className="border-b border-white/5 p-4 last:border-b-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-black text-white">{assignment.studentName} <span className={assignmentStatusStyle(assignment.status)}>· {assignment.status}</span></p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-cyan-200">{assignment.chapterTitle ?? "Entire study"}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{assignment.prompt}</p>
              {assignment.teacherAnswer ? <p className="mt-2 text-xs text-slate-500">Teacher answer: {assignment.teacherAnswer}</p> : null}
              <div className="mt-3 rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Student response</p>
                <p className={`mt-1 whitespace-pre-wrap text-sm leading-6 ${assignment.studentResponse ? "text-slate-200" : "italic text-slate-500"}`}>{assignment.studentResponse || "No response submitted yet."}</p>
              </div>
              {assignment.status === "submitted" ? <label className="mt-3 block text-xs font-black uppercase tracking-wide text-slate-300">Feedback
                <textarea aria-label={`Feedback for ${assignment.studentName}`} value={feedbacks[assignment.id] ?? ""} maxLength={4000} disabled={Boolean(saving)} onChange={(event) => setFeedbacks((current) => ({ ...current, [assignment.id]: event.target.value }))} placeholder="Optional for approval; required when returning for revision." className="mt-1 min-h-24 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-normal normal-case leading-6 text-white" />
              </label> : assignment.teacherFeedback ? <div className="mt-3 rounded-md border border-cyan-300/25 bg-cyan-300/10 p-3"><p className="text-xs font-black uppercase tracking-wide text-cyan-200">Teacher feedback</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-cyan-50">{assignment.teacherFeedback}</p></div> : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {assignment.status === "submitted" ? <><Button type="button" disabled={Boolean(saving)} onClick={() => void reviewAssignment(assignment, "approve")}>Approve</Button><Button type="button" variant="secondary" disabled={Boolean(saving) || !(feedbacks[assignment.id] ?? "").trim()} onClick={() => void reviewAssignment(assignment, "return")}>Return for revision</Button></> : null}
              {assignment.status === "returned" || assignment.status === "approved" ? <Button type="button" variant="ghost" disabled={Boolean(saving)} onClick={() => void reviewAssignment(assignment, "reset")}>Reset assignment</Button> : null}
              <Button type="button" variant="ghost" disabled={Boolean(saving)} onClick={() => void removeAssignment(assignment)}>Remove</Button>
            </div>
          </div>
        </div>) : <p className="p-4 text-sm text-slate-400">No review assignments yet.</p>}
      </div>

      {error ? <p className="mt-3 rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100" role="alert">{error}</p> : null}
      <div className="mt-5 flex justify-end"><Button type="button" variant="ghost" onClick={onClose}>Close</Button></div>
    </section>
  </div>;
}
