"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { GameAnalysisRequest, GameTacticFinding, TacticTheme } from "@/lib/types";
import { useState } from "react";

const tacticThemes: TacticTheme[] = ["Fork", "Pin", "Skewer", "Discovered Attack", "Double Attack", "Deflection", "Decoy", "Removing the Defender", "Back Rank Mate", "Mate in One"];

export function ManualTacticFindingForm({ request, onAdd }: { request?: GameAnalysisRequest; onAdd: (finding: GameTacticFinding, approveNow: boolean) => void }) {
  const [moveNumber, setMoveNumber] = useState(1);
  const [moveSan, setMoveSan] = useState("Move");
  const [tacticTheme, setTacticTheme] = useState<TacticTheme>("Fork");
  const [explanation, setExplanation] = useState("Teacher added this tactic manually.");
  const [approveNow, setApproveNow] = useState(false);

  function addFinding() {
    if (!request) return;
    onAdd({
      id: `manual-finding-${request.id}-${Date.now()}`,
      analysisRequestId: request.id,
      studentId: request.studentId,
      lichessGameId: request.lichessGameId,
      moveNumber,
      moveSan,
      tacticTheme,
      confidence: "medium",
      detectionMethod: "manual_admin",
      fenBefore: "",
      fenAfter: "",
      aiExplanationTeacher: explanation,
      aiExplanationStudent: explanation,
      whyThisMoveWorks: explanation,
      suggestedBadgeProgress: `If approved, count one ${tacticTheme}.`,
      status: "pending_review",
      createdAt: new Date().toISOString().slice(0, 10)
    }, approveNow);
    setMoveNumber(1);
    setMoveSan("Move");
    setExplanation("Teacher added this tactic manually.");
  }

  return (
    <Card className="p-4">
      <h2 className="font-black text-white">Manual Finding</h2>
      <p className="mt-1 text-sm text-slate-400">Use this if the analyzer missed something you want to review or count.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Move Number
          <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" type="number" min={1} value={moveNumber} onChange={(event) => setMoveNumber(Math.max(1, Number(event.target.value) || 1))} />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Move
          <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={moveSan} onChange={(event) => setMoveSan(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Tactic
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={tacticTheme} onChange={(event) => setTacticTheme(event.target.value as TacticTheme)}>
            {tacticThemes.map((theme) => <option key={theme}>{theme}</option>)}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs font-bold uppercase text-slate-400">
          <input type="checkbox" checked={approveNow} onChange={(event) => setApproveNow(event.target.checked)} className="h-4 w-4 accent-cyan-300" />
          Approve now
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400 md:col-span-2">Explanation
          <textarea className="min-h-20 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={explanation} onChange={(event) => setExplanation(event.target.value)} />
        </label>
      </div>
      <Button className="mt-4" onClick={addFinding} disabled={!request}>Add Finding</Button>
    </Card>
  );
}
