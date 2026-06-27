"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { gameReviewSubmissions as seedSubmissions } from "@/data/gameReviewSubmissions";
import { pendingAwards as seedPendingAwards } from "@/data/lichessSync";
import { studentTacticProgress as seedProgress } from "@/data/studentTacticProgress";
import { students as seedStudents } from "@/data/students";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { createPendingAwardsFromProgress } from "@/lib/lichess";
import type { GameReviewSubmission, GameReviewSubmissionStatus, GameReviewSubmissionType, PendingAward, Student, StudentTacticProgress, TacticTheme } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

function incrementTacticProgress(progress: StudentTacticProgress[], studentId: string, tacticTheme: TacticTheme) {
  const today = new Date().toISOString().slice(0, 10);
  const index = progress.findIndex((item) => item.studentId === studentId && item.tacticTheme === tacticTheme);
  if (index < 0) {
    return [...progress, { studentId, tacticTheme, puzzlesSolved: 1, puzzleSolvedCount: 0, submittedGameFoundCount: 1, totalCount: 1, updatedAt: today }];
  }
  return progress.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    const puzzleSolvedCount = item.puzzleSolvedCount ?? item.puzzlesSolved;
    const submittedGameFoundCount = (item.submittedGameFoundCount ?? 0) + 1;
    return {
      ...item,
      puzzleSolvedCount,
      submittedGameFoundCount,
      totalCount: puzzleSolvedCount + submittedGameFoundCount,
      puzzlesSolved: puzzleSolvedCount + submittedGameFoundCount,
      updatedAt: today
    };
  });
}

export function GameReviewQueue() {
  const [students, setStudents] = useState<Student[]>(seedStudents);
  const [submissions, setSubmissions] = useState<GameReviewSubmission[]>(seedSubmissions);
  const [progress, setProgress] = useState<StudentTacticProgress[]>(seedProgress);
  const [pendingAwards, setPendingAwards] = useState<PendingAward[]>(seedPendingAwards);
  const [studentFilter, setStudentFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState<"All" | GameReviewSubmissionType>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | GameReviewSubmissionStatus>("pending_review");
  const [teacherNotes, setTeacherNotes] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const store = readAdminStore();
    setStudents(store.students ?? seedStudents);
    setSubmissions(store.gameReviewSubmissions ?? seedSubmissions);
    setProgress(store.studentTacticProgress ?? seedProgress);
    setPendingAwards(store.pendingAwards ?? seedPendingAwards);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    updateAdminStore({
      students,
      gameReviewSubmissions: submissions,
      studentTacticProgress: progress,
      pendingAwards
    });
  }, [loaded, pendingAwards, progress, students, submissions]);

  const filtered = useMemo(() => submissions.filter((submission) => (
    (studentFilter === "All" || submission.studentId === studentFilter) &&
    (typeFilter === "All" || submission.requestType === typeFilter) &&
    (statusFilter === "All" || submission.status === statusFilter)
  )), [statusFilter, studentFilter, submissions, typeFilter]);

  function updateSubmission(submissionId: string, patch: Partial<GameReviewSubmission>) {
    setSubmissions((items) => items.map((item) => item.id === submissionId ? { ...item, ...patch } : item));
  }

  function approveTactic(submission: GameReviewSubmission) {
    if (!submission.tacticTheme) return;
    const student = students.find((item) => item.id === submission.studentId);
    if (!student) return;
    const nextProgress = incrementTacticProgress(progress, submission.studentId, submission.tacticTheme);
    const newAwards = createPendingAwardsFromProgress(student, nextProgress, pendingAwards);
    setProgress(nextProgress);
    setPendingAwards((items) => [...newAwards, ...items]);
    updateSubmission(submission.id, {
      status: "approved",
      reviewedAt: new Date().toISOString().slice(0, 10),
      teacherNote: teacherNotes[submission.id] || "Approved as a tactic found in a submitted game."
    });
  }

  function markAnalysed(submission: GameReviewSubmission) {
    updateSubmission(submission.id, {
      status: "analysed",
      reviewedAt: new Date().toISOString().slice(0, 10),
      teacherNote: teacherNotes[submission.id] || "Analysis reviewed by teacher."
    });
  }

  function rejectSubmission(submission: GameReviewSubmission) {
    updateSubmission(submission.id, {
      status: "rejected",
      reviewedAt: new Date().toISOString().slice(0, 10),
      teacherNote: teacherNotes[submission.id] || "Not counted this time."
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Pending</p>
          <p className="mt-2 text-2xl font-black text-white">{submissions.filter((item) => item.status === "pending_review").length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Tactic Reviews</p>
          <p className="mt-2 text-2xl font-black text-white">{submissions.filter((item) => item.requestType === "tactic_review").length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Analysis Requests</p>
          <p className="mt-2 text-2xl font-black text-white">{submissions.filter((item) => item.requestType === "analysis_request").length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Pending Awards</p>
          <p className="mt-2 text-2xl font-black text-white">{pendingAwards.filter((item) => item.status === "pending").length}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-black text-white">Game Review Queue</h2>
            <p className="mt-1 text-sm text-slate-400">Students submit a Lichess link, tactic and move number, or ask for full game analysis.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Student
              <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
                <option value="All">All Students</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Type
              <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "All" | GameReviewSubmissionType)}>
                <option>All</option>
                <option value="tactic_review">Tactic Review</option>
                <option value="analysis_request">Game Analysis</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Status
              <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | GameReviewSubmissionStatus)}>
                <option>All</option>
                <option value="pending_review">Pending</option>
                <option value="approved">Approved</option>
                <option value="analysed">Analysed</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          </div>
        </div>
      </Card>

      <div className="grid gap-3">
        {filtered.map((submission) => (
          <Card key={submission.id} className="p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-white">{submission.studentName}</h3>
                  <span className="rounded bg-white/10 px-2 py-1 text-[11px] font-black uppercase text-slate-200">
                    {submission.requestType === "tactic_review" ? "Tactic Review" : "Game Analysis"}
                  </span>
                  <span className="rounded bg-cyan-300/10 px-2 py-1 text-[11px] font-black uppercase text-cyan-100">{submission.status.replace("_", " ")}</span>
                </div>
                <a className="mt-2 block w-fit text-sm font-bold text-cyan-100 hover:underline" href={submission.gameUrl} target="_blank" rel="noreferrer">{submission.gameUrl}</a>
                {submission.requestType === "tactic_review" && (
                  <p className="mt-2 text-sm text-slate-300">
                    Tactic: <span className="font-bold text-white">{submission.tacticTheme}</span> · Move #{submission.moveNumber}
                  </p>
                )}
                <p className="mt-2 text-sm text-slate-300">{submission.studentNote || "No student note."}</p>
                {submission.teacherNote && <p className="mt-2 text-xs text-amber-100">Teacher note: {submission.teacherNote}</p>}
              </div>
              <div className="space-y-3">
                <textarea
                  className="min-h-24 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                  value={teacherNotes[submission.id] ?? submission.teacherNote ?? ""}
                  onChange={(event) => setTeacherNotes((notes) => ({ ...notes, [submission.id]: event.target.value }))}
                  placeholder="Teacher note"
                />
                {submission.status === "pending_review" ? (
                  <div className="flex flex-wrap gap-2">
                    {submission.requestType === "tactic_review" && <Button variant="secondary" onClick={() => approveTactic(submission)}>Approve Tactic</Button>}
                    {submission.requestType === "analysis_request" && <Button variant="secondary" onClick={() => markAnalysed(submission)}>Mark Analysed</Button>}
                    <Button variant="ghost" onClick={() => rejectSubmission(submission)}>Reject</Button>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-slate-400">Reviewed {submission.reviewedAt ?? ""}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <Card className="p-4 text-sm text-slate-300">No game submissions match these filters.</Card>}
      </div>
    </div>
  );
}
