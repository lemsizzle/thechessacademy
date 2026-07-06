"use client";

import { Card } from "@/components/Card";
import { SubmissionStatusBadge } from "@/components/SubmissionStatusBadge";
import { AdminSubmissionsNav } from "@/components/admin/AdminSubmissionsNav";
import { ReviewSubmissionPanel } from "@/components/admin/ReviewSubmissionPanel";
import { SubmissionRewardsPanel } from "@/components/admin/SubmissionRewardsPanel";
import { allBadges as seedBadges } from "@/data/badges";
import { quests as seedQuests } from "@/data/quests";
import { studentGameSubmissions as seedSubmissions } from "@/data/studentSubmissions";
import { students as seedStudents } from "@/data/students";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { reviewGameSubmission } from "@/lib/submissions/reviewGameSubmission";
import type { Badge, Quest, Student, StudentGameSubmission, SubmissionReviewAction, SubmissionStatus } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export function AdminGameSubmissionsTable({ adminActionToken }: { adminActionToken?: string }) {
  const [students, setStudents] = useState<Student[]>(seedStudents);
  const [badges, setBadges] = useState<Badge[]>(seedBadges);
  const [quests, setQuests] = useState<Quest[]>(seedQuests);
  const [submissions, setSubmissions] = useState<StudentGameSubmission[]>(seedSubmissions);
  const [studentFilter, setStudentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | SubmissionStatus>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const store = readAdminStore();
    setStudents(store.students ?? seedStudents);
    setBadges(store.badges ?? seedBadges);
    setQuests(store.quests ?? seedQuests);
    setSubmissions(store.studentGameSubmissions ?? seedSubmissions);
    const authHeaders = adminActionToken ? { "x-admin-action-token": adminActionToken } : undefined;
    fetch("/api/admin/submissions", { cache: "no-store", credentials: "include", headers: authHeaders })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { games?: StudentGameSubmission[] } | null) => {
        if (data?.games) setSubmissions(data.games);
      })
      .catch(() => {
        // Local storage remains the fallback for development.
      });
  }, [adminActionToken]);

  function save(next: StudentGameSubmission[]) {
    setSubmissions(next);
    updateAdminStore({ studentGameSubmissions: next });
  }

  function saveStudents(nextStudents: Student[]) {
    setStudents(nextStudents);
    updateAdminStore({ students: nextStudents });
  }

  async function review(submission: StudentGameSubmission, action: SubmissionReviewAction) {
    const reviewed = reviewGameSubmission(submission, action, notes[submission.id]);
    save(submissions.map((item) => item.id === submission.id ? reviewed : item));
    try {
      const response = await fetch(`/api/admin/submissions/games/${encodeURIComponent(submission.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(adminActionToken ? { "x-admin-action-token": adminActionToken } : {})
        },
        body: JSON.stringify({ action, teacherNote: notes[submission.id], submission })
      });
      const data = await response.json() as { submission?: StudentGameSubmission; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save review.");
      if (data.submission) save(submissions.map((item) => item.id === submission.id ? data.submission! : item));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Review saved locally, but not to Supabase.");
    }
  }

  const filtered = useMemo(() => submissions.filter((item) => (
    (studentFilter === "All" || item.studentId === studentFilter) &&
    (statusFilter === "All" || item.status === statusFilter)
  )), [statusFilter, studentFilter, submissions]);

  return (
    <div className="space-y-5">
      <AdminSubmissionsNav />
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Student
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
              <option value="All">All Students</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
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
              <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black text-white">{student?.name ?? submission.studentId}</h2>
                    <SubmissionStatusBadge status={submission.status} />
                  </div>
                  <a className="mt-2 block w-fit text-sm font-bold text-cyan-100 hover:underline" href={submission.gameUrl} target="_blank" rel="noreferrer">{submission.gameUrl}</a>
                  <p className="mt-2 text-sm text-slate-300">Played as {submission.playedAs}. {submission.gameType || "Game type not listed"}.</p>
                  {submission.notes && <p className="mt-2 text-sm text-slate-400">{submission.notes}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <Link className="rounded border border-white/10 bg-white/5 px-2 py-1 text-slate-200" href={`/admin/game-analyzer?url=${encodeURIComponent(submission.gameUrl)}&student=${encodeURIComponent(submission.studentId)}`}>Send to Game Analyzer</Link>
                  </div>
                </div>
                <div className="space-y-3">
                  <ReviewSubmissionPanel
                    teacherNote={notes[submission.id] ?? submission.teacherNote ?? ""}
                    onTeacherNoteChange={(note) => setNotes((items) => ({ ...items, [submission.id]: note }))}
                    onApprove={() => review(submission, "approve")}
                    onReject={() => review(submission, "reject")}
                    onNeedsChanges={() => review(submission, "needs_changes")}
                    approveLabel="Approve Only"
                  />
                  <SubmissionRewardsPanel student={student} badges={badges} quests={quests} students={students} onStudentsChange={saveStudents} adminActionToken={adminActionToken} />
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card className="p-4 text-sm text-slate-300">No game submissions match these filters.</Card>}
      </div>
    </div>
  );
}
