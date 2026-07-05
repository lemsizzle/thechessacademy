"use client";

import { Card } from "@/components/Card";
import { SubmissionStatusBadge } from "@/components/SubmissionStatusBadge";
import { AdminSubmissionsNav } from "@/components/admin/AdminSubmissionsNav";
import { ReviewSubmissionPanel } from "@/components/admin/ReviewSubmissionPanel";
import { SubmissionRewardsPanel } from "@/components/admin/SubmissionRewardsPanel";
import { allBadges as seedBadges } from "@/data/badges";
import { pendingAwards as seedPendingAwards } from "@/data/lichessSync";
import { quests as seedQuests } from "@/data/quests";
import { studentScoreSubmissions as seedSubmissions } from "@/data/studentSubmissions";
import { studentTacticProgress as seedProgress } from "@/data/studentTacticProgress";
import { students as seedStudents } from "@/data/students";
import { createPendingAwardsFromProgress } from "@/lib/lichess";
import { persistStudentXpChange } from "@/lib/adminXpClient";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { reviewScoreSubmission } from "@/lib/submissions/reviewScoreSubmission";
import type { Badge, PendingAward, Quest, Student, StudentScoreSubmission, StudentTacticProgress, SubmissionReviewAction, SubmissionStatus, TacticTheme, XpEvent } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

const tacticThemes: Array<"All" | TacticTheme> = ["All", "Fork", "Pin", "Skewer", "Discovered Attack", "Double Attack", "Deflection", "Decoy", "Removing the Defender", "Back Rank Mate", "Mate in One"];

function addProgress(progress: StudentTacticProgress[], studentId: string, tacticTheme: TacticTheme, amount: number) {
  if (amount <= 0) return progress;
  const index = progress.findIndex((item) => item.studentId === studentId && item.tacticTheme === tacticTheme);
  if (index < 0) return [...progress, { studentId, tacticTheme, puzzlesSolved: amount, puzzleSolvedCount: amount, totalCount: amount, updatedAt: new Date().toISOString().slice(0, 10) }];
  return progress.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    const puzzleSolvedCount = (item.puzzleSolvedCount ?? item.puzzlesSolved) + amount;
    const submittedGameFoundCount = item.submittedGameFoundCount ?? 0;
    return { ...item, puzzleSolvedCount, puzzlesSolved: puzzleSolvedCount + submittedGameFoundCount, totalCount: puzzleSolvedCount + submittedGameFoundCount, updatedAt: new Date().toISOString().slice(0, 10) };
  });
}

export function AdminScoreSubmissionsTable({ adminActionToken }: { adminActionToken?: string }) {
  const [students, setStudents] = useState<Student[]>(seedStudents);
  const [badges, setBadges] = useState<Badge[]>(seedBadges);
  const [quests, setQuests] = useState<Quest[]>(seedQuests);
  const [submissions, setSubmissions] = useState<StudentScoreSubmission[]>(seedSubmissions);
  const [progress, setProgress] = useState<StudentTacticProgress[]>(seedProgress);
  const [pendingAwards, setPendingAwards] = useState<PendingAward[]>(seedPendingAwards);
  const [studentFilter, setStudentFilter] = useState("All");
  const [themeFilter, setThemeFilter] = useState<"All" | TacticTheme>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | SubmissionStatus>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [xpAwards, setXpAwards] = useState<Record<string, number>>({});
  const [progressAwards, setProgressAwards] = useState<Record<string, number>>({});

  useEffect(() => {
    const store = readAdminStore();
    setStudents(store.students ?? seedStudents);
    setBadges(store.badges ?? seedBadges);
    setQuests(store.quests ?? seedQuests);
    setSubmissions(store.studentScoreSubmissions ?? seedSubmissions);
    setProgress(store.studentTacticProgress ?? seedProgress);
    setPendingAwards(store.pendingAwards ?? seedPendingAwards);
    const authHeaders = adminActionToken ? { "x-admin-action-token": adminActionToken } : undefined;
    fetch("/api/admin/submissions", { cache: "no-store", credentials: "include", headers: authHeaders })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { scores?: StudentScoreSubmission[] } | null) => {
        if (data?.scores) setSubmissions(data.scores);
      })
      .catch(() => {
        // Local storage remains the fallback for development.
      });
    fetch("/api/admin/students", { cache: "no-store", credentials: "include", headers: authHeaders })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { students?: Student[] } | null) => {
        if (data?.students?.length) setStudents(data.students);
      })
      .catch(() => {
        // Local storage remains the fallback for development.
      });
    fetch("/api/admin/badges", { cache: "no-store", credentials: "include", headers: authHeaders })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { badges?: Badge[] } | null) => {
        if (data?.badges?.length) setBadges(data.badges);
      })
      .catch(() => {
        // Local storage remains the fallback for development.
      });
  }, [adminActionToken]);

  function save(nextSubmissions: StudentScoreSubmission[], nextStudents = students, nextProgress = progress, nextPendingAwards = pendingAwards) {
    setSubmissions(nextSubmissions);
    setStudents(nextStudents);
    setProgress(nextProgress);
    setPendingAwards(nextPendingAwards);
    updateAdminStore({ students: nextStudents, studentScoreSubmissions: nextSubmissions, studentTacticProgress: nextProgress, pendingAwards: nextPendingAwards });
  }

  function saveStudents(nextStudents: Student[]) {
    save(submissions, nextStudents);
  }

  async function review(submission: StudentScoreSubmission, action: SubmissionReviewAction) {
    const wasAlreadyApproved = submission.status === "approved";
    const xp = Math.max(0, xpAwards[submission.id] ?? 0);
    const progressAmount = Math.max(0, progressAwards[submission.id] ?? 0);
    const reviewedSubmission = reviewScoreSubmission(submission, action, notes[submission.id], xp, progressAmount);
    const nextSubmissions = submissions.map((item) => item.id === submission.id ? reviewedSubmission : item);
    try {
      const response = await fetch(`/api/admin/submissions/scores/${encodeURIComponent(submission.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(adminActionToken ? { "x-admin-action-token": adminActionToken } : {})
        },
        body: JSON.stringify({ action, teacherNote: notes[submission.id], submission, xpAwarded: xp, tacticProgressAdded: progressAmount })
      });
      const data = await response.json() as { submission?: StudentScoreSubmission; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save review.");
      if (data.submission) {
        const index = nextSubmissions.findIndex((item) => item.id === submission.id);
        if (index >= 0) nextSubmissions.splice(index, 1, data.submission);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Review saved locally, but not to Supabase.");
    }
    if (action !== "approve" || wasAlreadyApproved) {
      save(nextSubmissions);
      return;
    }
    const currentStudent = students.find((student) => student.id === submission.studentId);
    let savedTotalXp = currentStudent?.totalXp ?? 0;
    const xpReason = `Approved score: ${submission.challengeName}`;
    const xpEvent: XpEvent | undefined = xp > 0 && currentStudent ? await persistStudentXpChange(currentStudent, xp, xpReason, adminActionToken).then((result) => {
      savedTotalXp = result.student?.totalXp ?? currentStudent.totalXp + xp;
      return result.event ?? {
        id: `score-xp-${submission.id}-${Date.now()}`,
        studentId: submission.studentId,
        amount: xp,
        reason: xpReason,
        createdAt: new Date().toISOString()
      };
    }).catch((error) => {
      window.alert(error instanceof Error ? error.message : "Could not save XP.");
      throw error;
    }) : undefined;
    const nextStudents = students.map((student) => student.id === submission.studentId ? { ...student, totalXp: savedTotalXp } : student);
    const nextProgress = addProgress(progress, submission.studentId, submission.tacticTheme, progressAmount);
    const student = nextStudents.find((item) => item.id === submission.studentId);
    const newAwards = student ? createPendingAwardsFromProgress(student, nextProgress, pendingAwards) : [];
    save(nextSubmissions, nextStudents, nextProgress, [...newAwards, ...pendingAwards]);
    if (xpEvent) updateAdminStore({ xpEvents: [xpEvent, ...(readAdminStore().xpEvents ?? [])] });
  }

  const filtered = useMemo(() => submissions.filter((item) => (
    (studentFilter === "All" || item.studentId === studentFilter) &&
    (themeFilter === "All" || item.tacticTheme === themeFilter) &&
    (statusFilter === "All" || item.status === statusFilter)
  )), [statusFilter, studentFilter, submissions, themeFilter]);

  return (
    <div className="space-y-5">
      <AdminSubmissionsNav />
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Student
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
              <option value="All">All Students</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Tactic
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={themeFilter} onChange={(event) => setThemeFilter(event.target.value as "All" | TacticTheme)}>
              {tacticThemes.map((theme) => <option key={theme}>{theme}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Status
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | SubmissionStatus)}>
              <option value="All">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="needs_changes">Needs Changes</option>
            </select>
          </label>
        </div>
      </Card>

      <div className="grid gap-3">
        {filtered.map((submission) => {
          const student = students.find((item) => item.id === submission.studentId);
          return (
            <Card key={submission.id} className="p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black text-white">{student?.name ?? submission.studentId}</h2>
                    <SubmissionStatusBadge status={submission.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{submission.challengeName}: {submission.score}{submission.totalQuestions ? `/${submission.totalQuestions}` : ""} - {submission.tacticTheme}</p>
                  {submission.notes && <p className="mt-2 text-sm text-slate-400">{submission.notes}</p>}
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">XP Award On Approval
                      <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" type="number" value={xpAwards[submission.id] ?? 0} onChange={(event) => setXpAwards((items) => ({ ...items, [submission.id]: Math.max(0, Number(event.target.value) || 0) }))} />
                    </label>
                    <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Progress Points
                      <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" type="number" value={progressAwards[submission.id] ?? 0} onChange={(event) => setProgressAwards((items) => ({ ...items, [submission.id]: Math.max(0, Number(event.target.value) || 0) }))} />
                    </label>
                  </div>
                </div>
                <div className="space-y-3">
                  <ReviewSubmissionPanel
                    teacherNote={notes[submission.id] ?? submission.teacherNote ?? ""}
                    onTeacherNoteChange={(note) => setNotes((items) => ({ ...items, [submission.id]: note }))}
                    onApprove={() => review(submission, "approve")}
                    onReject={() => review(submission, "reject")}
                    onNeedsChanges={() => review(submission, "needs_changes")}
                    approveLabel="Approve Score"
                  />
                  <SubmissionRewardsPanel student={student} badges={badges} quests={quests} students={students} onStudentsChange={saveStudents} adminActionToken={adminActionToken} />
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card className="p-4 text-sm text-slate-300">No score submissions match these filters.</Card>}
      </div>
    </div>
  );
}
