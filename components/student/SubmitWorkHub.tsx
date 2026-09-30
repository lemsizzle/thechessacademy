"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StudentSubmissionsTable } from "@/components/student/StudentSubmissionsTable";
import { SubmitScoreForm } from "@/components/student/SubmitScoreForm";
import { useState } from "react";

type SubmitMode = "game" | "score";

export function SubmitWorkHub({ initialMode = "score" }: { initialMode?: SubmitMode }) {
  const [mode, setMode] = useState<SubmitMode>(initialMode);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black text-white">Submit Work</h2>
            <p className="mt-1 text-sm text-slate-400">Send work to your teacher, then track the review status on this same page.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/20 p-1 text-xs font-bold sm:w-72">
            <Button className="px-3 py-2" variant={mode === "score" ? "secondary" : "ghost"} onClick={() => setMode("score")}>Puzzle Score</Button>
            <Button className="px-3 py-2" variant={mode === "game" ? "secondary" : "ghost"} onClick={() => setMode("game")}>Game</Button>
          </div>
        </div>
      </Card>
      {mode === "game" ? <Card className="p-4"><h2 className="font-black text-white">Review your Chess Quest games</h2><p className="my-3 text-sm text-slate-300">Games played here are saved automatically. Open your history to analyze a game; your teacher can review your recent games too.</p><Button href="/student/play/history">Open game history</Button></Card> : <SubmitScoreForm compact />}
      <StudentSubmissionsTable />
    </div>
  );
}
