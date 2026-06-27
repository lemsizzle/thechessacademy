"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { lichessConnections as seedConnections, pendingAwards as seedPendingAwards } from "@/data/lichessSync";
import { studentTacticProgress as seedProgress } from "@/data/studentTacticProgress";
import { readAdminStore } from "@/lib/mockStorage";
import { syncStudentLichessEverything } from "@/lib/studentLichessFullSync";
import type { LichessConnection, PendingAward, Student, StudentTacticProgress } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function LichessStudentConnectPanel({ student, profileBasePath = "/app/students" }: { student: Student; profileBasePath?: string }) {
  const [progress, setProgress] = useState<StudentTacticProgress[]>([]);
  const [connection, setConnection] = useState<LichessConnection | undefined>();
  const [pendingAwards, setPendingAwards] = useState<PendingAward[]>([]);
  const [message, setMessage] = useState("Connect Lichess here. Students can refresh stats, quests, and badges from Lichess Progress after logging in.");

  useEffect(() => {
    const store = readAdminStore();
    const storedProgress = store.studentTacticProgress ?? seedProgress;
    const storedConnections = store.lichessConnections ?? seedConnections;
    const storedAwards = store.pendingAwards ?? seedPendingAwards;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("lichess");

    setProgress(storedProgress);
    setConnection(storedConnections.find((item) => item.studentId === student.id));
    setPendingAwards(storedAwards.filter((award) => award.studentId === student.id && award.status === "pending"));

    if (status === "connected") {
      setMessage("Lichess connected. Syncing your academy progress now.");
      void syncLichess();
    }
    if (status === "mock") setMessage("Lichess connection could not finish, but mock sync is ready for testing.");
    if (status === "error") setMessage("Lichess connection was not completed. Try connecting again.");
  }, [student.id]);

  const topProgress = useMemo(() => (
    progress
      .filter((item) => item.studentId === student.id)
      .sort((a, b) => b.puzzlesSolved - a.puzzlesSolved)
      .slice(0, 3)
  ), [progress, student.id]);

  async function syncLichess() {
    try {
      const result = await syncStudentLichessEverything();
      const store = readAdminStore();
      setProgress(store.studentTacticProgress ?? seedProgress);
      setConnection((store.lichessConnections ?? seedConnections).find((item) => item.studentId === student.id));
      setPendingAwards((store.pendingAwards ?? seedPendingAwards).filter((award) => award.studentId === student.id && award.status === "pending"));
      setMessage(result.message);
    } catch {
      setMessage("Sync did not finish. Try again, or ask your teacher to sync from the admin page.");
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-black text-white">Lichess Connection</h2>
          <p className="text-sm text-slate-300">{message}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href={`/api/auth/lichess/start?student=${encodeURIComponent(student.slug)}&returnTo=${encodeURIComponent(`${profileBasePath}/${student.slug}`)}`} variant="secondary">
            Connect Lichess
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase text-slate-400">Username</p>
          <p className="mt-1 font-black text-white">{student.lichessUsername ?? student.slug}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase text-slate-400">Last Sync</p>
          <p className="mt-1 font-black text-white">{connection?.lastSyncedAt ?? "Not yet"}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase text-slate-400">Teacher Review</p>
          <p className="mt-1 font-black text-white">{pendingAwards.length} pending</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-300">
        {topProgress.map((item) => <p key={`${item.studentId}-${item.tacticTheme}`}>{item.tacticTheme}: {item.puzzlesSolved} puzzles</p>)}
        {topProgress.length === 0 && <p>No synced puzzle progress yet.</p>}
      </div>
    </Card>
  );
}
