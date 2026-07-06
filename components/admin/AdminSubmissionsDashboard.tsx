"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { SubmissionStatusBadge } from "@/components/SubmissionStatusBadge";
import { AdminSubmissionsNav } from "@/components/admin/AdminSubmissionsNav";
import { studentGameSubmissions as seedGameSubmissions, studentScoreSubmissions as seedScoreSubmissions } from "@/data/studentSubmissions";
import { students as seedStudents } from "@/data/students";
import { readAdminStore } from "@/lib/mockStorage";
import type { Student, StudentGameSubmission, StudentScoreSubmission, SubmissionStatus } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function AdminSubmissionsDashboard({ adminActionToken }: { adminActionToken?: string }) {
  const [students, setStudents] = useState<Student[]>(seedStudents);
  const [games, setGames] = useState<StudentGameSubmission[]>(seedGameSubmissions);
  const [scores, setScores] = useState<StudentScoreSubmission[]>(seedScoreSubmissions);

  useEffect(() => {
    const store = readAdminStore();
    setStudents(store.students ?? seedStudents);
    setGames(store.studentGameSubmissions ?? seedGameSubmissions);
    setScores(store.studentScoreSubmissions ?? seedScoreSubmissions);
    const authHeaders = adminActionToken ? { "x-admin-action-token": adminActionToken } : undefined;
    fetch("/api/admin/submissions", { cache: "no-store", credentials: "include", headers: authHeaders })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { games?: StudentGameSubmission[]; scores?: StudentScoreSubmission[] } | null) => {
        if (!data) return;
        if (data.games) setGames(data.games);
        if (data.scores) setScores(data.scores);
      })
      .catch(() => {
        // Local storage remains the fallback for development.
      });
  }, [adminActionToken]);

  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const pendingGames = games.filter((item) => item.status === "pending");
  const pendingScores = scores.filter((item) => item.status === "pending");
  const needsChanges = [...games, ...scores].filter((item) => item.status === "needs_changes").length;
  const recent = useMemo(() => [
    ...games.map((item) => ({ id: item.id, type: "Game", label: item.gameUrl, studentId: item.studentId, status: item.status, date: item.submittedAt, href: "/admin/submissions/games" })),
    ...scores.map((item) => ({ id: item.id, type: "Score", label: `${item.challengeName}: ${item.score}${item.totalQuestions ? `/${item.totalQuestions}` : ""}`, studentId: item.studentId, status: item.status, date: item.submittedAt, href: "/admin/submissions/scores" }))
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8), [games, scores]);

  function statusCount(status: SubmissionStatus) {
    return [...games, ...scores].filter((item) => item.status === status).length;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSubmissionsNav />
        <p className="text-sm text-slate-400">{statusCount("pending")} waiting for review</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Pending Games</p>
          <p className="mt-2 text-2xl font-black text-white">{pendingGames.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Pending Scores</p>
          <p className="mt-2 text-2xl font-black text-white">{pendingScores.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Needs Changes</p>
          <p className="mt-2 text-2xl font-black text-white">{needsChanges}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Total Submissions</p>
          <p className="mt-2 text-2xl font-black text-white">{games.length + scores.length}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black text-white">Student Submissions</h2>
            <p className="mt-1 text-sm text-slate-400">Review games and puzzle challenge scores before anything counts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href="/admin/submissions/games" variant="secondary">Review Games</Button>
            <Button href="/admin/submissions/scores">Review Scores</Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-black text-white">Recent Submissions</h2>
        <div className="mt-3 grid gap-2 text-sm text-slate-300">
          {recent.map((item) => (
            <a key={`${item.type}-${item.id}`} href={item.href} className="grid gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 hover:bg-white/[0.06] sm:grid-cols-[110px_1fr_auto] sm:items-center">
              <span className="font-bold text-cyan-100">{item.type}</span>
              <span>
                <span className="font-bold text-white">{studentById.get(item.studentId)?.name ?? item.studentId}</span>
                <span className="mx-2 text-slate-500">-</span>
                <span>{item.label}</span>
              </span>
              <SubmissionStatusBadge status={item.status} />
            </a>
          ))}
          {recent.length === 0 && <p>No submissions yet.</p>}
        </div>
      </Card>
    </div>
  );
}
