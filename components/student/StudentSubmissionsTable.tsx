"use client";

import { Card } from "@/components/Card";
import { SubmissionStatusBadge } from "@/components/SubmissionStatusBadge";
import { studentGameSubmissions as seedGameSubmissions, studentScoreSubmissions as seedScoreSubmissions } from "@/data/studentSubmissions";
import { getCurrentStudentUser } from "@/lib/auth/getCurrentUser";
import { readAdminStore } from "@/lib/mockStorage";
import type { StudentGameSubmission, StudentScoreSubmission } from "@/lib/types";
import { useEffect, useState } from "react";

export function StudentSubmissionsTable() {
  const [games, setGames] = useState<StudentGameSubmission[]>([]);
  const [scores, setScores] = useState<StudentScoreSubmission[]>([]);

  useEffect(() => {
    const user = getCurrentStudentUser();
    const store = readAdminStore();
    setGames((store.studentGameSubmissions ?? seedGameSubmissions).filter((item) => item.studentId === user?.studentId));
    setScores((store.studentScoreSubmissions ?? seedScoreSubmissions).filter((item) => item.studentId === user?.studentId));
    fetch("/api/student/submissions", { cache: "no-store", credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { games?: StudentGameSubmission[]; scores?: StudentScoreSubmission[] } | null) => {
        if (!data) return;
        if (data.games) setGames(data.games);
        if (data.scores) setScores(data.scores);
      })
      .catch(() => {
        // Local storage remains the fallback for development.
      });
  }, []);

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <h2 className="font-black text-white">Game Submissions</h2>
        <div className="mt-3 space-y-3">
          {games.map((submission) => (
            <div key={submission.id} className="rounded-md border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <a href={submission.gameUrl} target="_blank" rel="noreferrer" className="font-bold text-cyan-100 hover:underline">{submission.gameUrl}</a>
                <SubmissionStatusBadge status={submission.status} />
              </div>
              <p className="mt-2 text-xs text-slate-400">Submitted {submission.submittedAt}</p>
              {submission.teacherNote && <p className="mt-2 text-sm text-amber-100">Teacher note: {submission.teacherNote}</p>}
              {submission.rejectionReason && <p className="mt-2 text-sm text-rose-100">Reason: {submission.rejectionReason}</p>}
            </div>
          ))}
          {games.length === 0 && <p className="text-sm text-slate-300">No game submissions yet.</p>}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-black text-white">Puzzle Score Submissions</h2>
        <div className="mt-3 space-y-3">
          {scores.map((submission) => (
            <div key={submission.id} className="rounded-md border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-white">{submission.challengeName}: {submission.score}{submission.totalQuestions ? `/${submission.totalQuestions}` : ""}</p>
                <SubmissionStatusBadge status={submission.status} />
              </div>
              <p className="mt-2 text-xs text-slate-400">Submitted {submission.submittedAt} - {submission.tacticTheme}</p>
              {submission.xpAwarded ? <p className="mt-2 text-sm text-emerald-100">XP awarded: {submission.xpAwarded}</p> : null}
              {submission.tacticProgressAdded ? <p className="mt-1 text-sm text-cyan-100">Tactic progress added: {submission.tacticProgressAdded}</p> : null}
              {submission.teacherNote && <p className="mt-2 text-sm text-amber-100">Teacher note: {submission.teacherNote}</p>}
              {submission.rejectionReason && <p className="mt-2 text-sm text-rose-100">Reason: {submission.rejectionReason}</p>}
            </div>
          ))}
          {scores.length === 0 && <p className="text-sm text-slate-300">No score submissions yet.</p>}
        </div>
      </Card>
    </div>
  );
}
