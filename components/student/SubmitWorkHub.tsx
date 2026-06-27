"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { SubmitGameForm } from "@/components/student/SubmitGameForm";
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
            <p className="mt-1 text-sm text-slate-400">Games and puzzle scores both go to the teacher review queue before XP or progress is awarded.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/20 p-1 text-xs font-bold sm:w-72">
            <Button className="px-3 py-2" variant={mode === "score" ? "secondary" : "ghost"} onClick={() => setMode("score")}>Puzzle Score</Button>
            <Button className="px-3 py-2" variant={mode === "game" ? "secondary" : "ghost"} onClick={() => setMode("game")}>Game</Button>
          </div>
        </div>
      </Card>
      {mode === "game" ? <SubmitGameForm compact /> : <SubmitScoreForm compact />}
    </div>
  );
}
