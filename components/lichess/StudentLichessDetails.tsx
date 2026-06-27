"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LichessRatingCard } from "@/components/lichess/LichessRatingCard";
import { useMockAdminState } from "@/lib/useMockAdminState";
import { mockArenaTournamentResults } from "@/data/tournamentResults";
import { getStudentArenaPoints } from "@/lib/tournaments/getStudentArenaPoints";
import { readAdminStore } from "@/lib/mockStorage";

export function StudentLichessDetails({ slug, profileBasePath = "/app/students" }: { slug?: string; showSubmissionForm?: boolean; profileBasePath?: string }) {
  const { students, studentLichessAccounts, studentGameSubmissions, pendingAwards } = useMockAdminState();
  const student = slug ? students.find((item) => item.slug === slug) : students[0];

  if (!student) return <EmptyState title="No student selected" message="Open a student profile first, then choose Lichess details." />;

  const account = studentLichessAccounts.find((item) => item.studentId === student.id);
  const submissions = studentGameSubmissions.filter((item) => item.studentId === student.id && item.status === "pending");
  const awards = pendingAwards.filter((item) => item.studentId === student.id && item.status === "pending");
  const arenaPoints = getStudentArenaPoints(account, readAdminStore().arenaTournamentResults ?? mockArenaTournamentResults);

  if (!account) {
    return (
      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="font-black text-white">No Lichess Account Linked</h2>
          <p className="mt-2 text-sm text-slate-300">Connect from the student profile, then sync ratings and puzzles.</p>
          <Button className="mt-4" href={`${profileBasePath}/${student.slug}`} variant="secondary">Open Student Profile</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-black text-white">{student.name}</h2>
            <p className="text-sm text-slate-300">
              {account.lichessUsername} - {account.syncStatus} - Last rating sync {account.lastRatingSyncAt ?? "not yet"}
            </p>
          </div>
          <Button href={account.lichessProfileUrl} target="_blank" rel="noreferrer" variant="ghost">Open Lichess</Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LichessRatingCard label="Blitz" rating={account.blitzRating} games={account.blitzGames} change={account.blitzRatingChange} provisional={account.blitzProvisional} />
          <LichessRatingCard label="Rapid" rating={account.rapidRating} games={account.rapidGames} change={account.rapidRatingChange} provisional={account.rapidProvisional} />
          <LichessRatingCard label="Puzzle" rating={account.puzzleRating ?? null} games={account.puzzleGames ?? 0} />
          <LichessRatingCard label="Arena Points" rating={arenaPoints.totalPoints} games={arenaPoints.tournamentsPlayed} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Game Submissions</p>
          <p className="mt-2 text-2xl font-black text-white">{submissions.length}</p>
          <p className="mt-1 text-xs text-slate-400">Waiting in unified review queue</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Pending Awards</p>
          <p className="mt-2 text-2xl font-black text-white">{awards.length}</p>
          <p className="mt-1 text-xs text-slate-400">Approved by teacher first</p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-black text-white">Submitted Games</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          {submissions.slice(0, 5).map((submission) => <p key={submission.id}>{submission.gameUrl}</p>)}
          {submissions.length === 0 && <p>No submitted games waiting for review.</p>}
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black text-white">Submit Work</h2>
            <p className="mt-1 text-sm text-slate-400">Use the student portal for all game and puzzle score submissions.</p>
          </div>
          <Button href="/student/submit" variant="secondary">Open Submit Work</Button>
        </div>
      </Card>
    </div>
  );
}
