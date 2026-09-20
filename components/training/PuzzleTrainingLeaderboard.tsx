"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import type { PuzzleLeaderboardData } from "@/lib/puzzle-training/leaderboard";

function LoadingLeaderboard() {
  return <p role="status" className="p-4 text-sm text-slate-300">Loading the puzzle leaderboard...</p>;
}

const LeaderboardBoard = dynamic(
  () => import("@/components/LeaderboardBoard").then((module) => module.LeaderboardBoard),
  { loading: LoadingLeaderboard }
);

/** Mounted only when the student opens their stats, keeping roster data out of gameplay startup. */
export function PuzzleTrainingLeaderboard({ viewerStudentId }: { viewerStudentId: string }) {
  const regionRef = useRef<HTMLElement>(null);
  const [data, setData] = useState<PuzzleLeaderboardData | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setError("");
    setData(null);
    void (async () => {
      try {
        const response = await fetch("/api/student/puzzle-training/leaderboard", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Leaderboard request failed.");
        const result = await response.json() as PuzzleLeaderboardData;
        if (!disposed) setData(result);
      } catch {
        if (!disposed) setError("The puzzle leaderboard could not be loaded. Please try again.");
      } finally {
        window.clearTimeout(timeout);
      }
    })();
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt, viewerStudentId]);

  return <section ref={regionRef} tabIndex={-1} aria-label="Survival puzzle leaderboard" className="outline-none">
    {error ? <div className="space-y-3 p-4">
      <p role="alert" className="text-sm text-rose-200">{error}</p>
      <Button type="button" variant="secondary" onClick={() => {
        // Keep focus inside the stats dialog when the retry button is replaced.
        regionRef.current?.focus();
        setAttempt((value) => value + 1);
      }}>Retry leaderboard</Button>
    </div> : !data ? <LoadingLeaderboard /> : <LeaderboardBoard
    initialStudents={data.students}
    avatarItems={data.avatarItems}
    studentAvatars={data.studentAvatars}
    survivalScores={data.survivalScores}
    initialFocus="Survival Puzzles"
    lockFocus
    heading="Survival Puzzle Leaderboard"
    profileBasePath="/student/students"
    enableCorrespondenceChallenges
    viewerStudentId={viewerStudentId}
    />}
  </section>;
}
