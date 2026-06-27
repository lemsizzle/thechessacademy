"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { GameMetadataCard } from "@/components/admin/GameMetadataCard";
import { ManualTacticFindingForm } from "@/components/admin/ManualTacticFindingForm";
import { TacticFindingsTable } from "@/components/admin/TacticFindingsTable";
import { pendingAwards as seedPendingAwards } from "@/data/lichessSync";
import { students as seedStudents } from "@/data/students";
import { studentTacticProgress as seedProgress } from "@/data/studentTacticProgress";
import { approveTacticFinding } from "@/lib/game-analysis/approveTacticFinding";
import { rejectTacticFinding } from "@/lib/game-analysis/rejectTacticFinding";
import { readAdminStore, updateAdminStore, type AdminStoreState } from "@/lib/mockStorage";
import type { GameAnalysisRequest, GameTacticFinding, LichessGame, PendingAward, Student, StudentColor, StudentTacticProgress, TacticTheme } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

function writeStore(patch: AdminStoreState) {
  updateAdminStore(patch);
}

export function GameAnalyzerForm() {
  const [students, setStudents] = useState<Student[]>(seedStudents);
  const [studentId, setStudentId] = useState(seedStudents[0]?.id ?? "");
  const [studentColor, setStudentColor] = useState<StudentColor>("auto");
  const [url, setUrl] = useState("");
  const [game, setGame] = useState<LichessGame | undefined>();
  const [mode, setMode] = useState<"connected" | "mock">("mock");
  const [analysisRequest, setAnalysisRequest] = useState<GameAnalysisRequest | undefined>();
  const [findings, setFindings] = useState<GameTacticFinding[]>([]);
  const [progress, setProgress] = useState<StudentTacticProgress[]>(seedProgress);
  const [pendingAwards, setPendingAwards] = useState<PendingAward[]>(seedPendingAwards);
  const [message, setMessage] = useState("Paste a Lichess game URL, choose the student, then analyze.");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const store = readAdminStore();
    const storedStudents = store.students ?? seedStudents;
    setStudents(storedStudents);
    setStudentId(storedStudents[0]?.id ?? "");
    setProgress(store.studentTacticProgress ?? seedProgress);
    setPendingAwards(store.pendingAwards ?? seedPendingAwards);
    setFindings(store.gameTacticFindings ?? []);
  }, []);

  const selectedStudent = useMemo(() => students.find((student) => student.id === studentId), [studentId, students]);
  const visibleFindings = analysisRequest ? findings.filter((finding) => finding.analysisRequestId === analysisRequest.id) : findings.slice(0, 8);

  function saveAnalysis(nextRequest: GameAnalysisRequest | undefined, nextFindings: GameTacticFinding[]) {
    const store = readAdminStore();
    const requests = nextRequest ? [nextRequest, ...(store.gameAnalysisRequests ?? []).filter((item) => item.id !== nextRequest.id)] : store.gameAnalysisRequests ?? [];
    const otherFindings = (store.gameTacticFindings ?? []).filter((item) => nextRequest ? item.analysisRequestId !== nextRequest.id : true);
    writeStore({ gameAnalysisRequests: requests, gameTacticFindings: [...nextFindings, ...otherFindings] });
  }

  async function analyzeGame() {
    if (!selectedStudent) {
      setMessage("Choose a student first.");
      return;
    }
    setIsLoading(true);
    setMessage("Analyzing game. AI explanations may use mock fallback if no API key is set.");
    try {
      const response = await fetch("/api/lichess/game/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          studentId: selectedStudent.id,
          studentUsername: selectedStudent.lichessUsername ?? selectedStudent.slug,
          studentColor
        })
      });
      const result = await response.json() as {
        error?: string;
        mode?: "connected" | "mock";
        message?: string;
        game?: LichessGame;
        analysisRequest?: GameAnalysisRequest;
        findings?: GameTacticFinding[];
        usedMockAi?: boolean;
      };
      if (!response.ok || result.error || !result.game || !result.analysisRequest) {
        setMessage(result.error ?? "Analysis failed.");
        return;
      }
      const nextFindings = result.findings ?? [];
      setGame(result.game);
      setMode(result.mode ?? "mock");
      setAnalysisRequest(result.analysisRequest);
      setFindings((items) => [...nextFindings, ...items.filter((item) => item.analysisRequestId !== result.analysisRequest!.id)]);
      saveAnalysis(result.analysisRequest, nextFindings);
      setMessage(`${result.message ?? "Analysis complete."} Found ${nextFindings.length} candidate${nextFindings.length === 1 ? "" : "s"}.${result.usedMockAi ? " Mock AI explanations are being used." : ""}`);
    } catch {
      setMessage("Analysis failed. Check the URL and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateFinding(findingId: string, patch: Partial<GameTacticFinding>) {
    setFindings((items) => {
      const next = items.map((item) => item.id === findingId ? { ...item, ...patch } : item);
      saveAnalysis(analysisRequest, analysisRequest ? next.filter((item) => item.analysisRequestId === analysisRequest.id) : next);
      return next;
    });
  }

  function approveFinding(finding: GameTacticFinding) {
    const student = students.find((item) => item.id === finding.studentId);
    if (!student || finding.status !== "pending_review") return;
    const duplicateApproved = findings.some((item) => (
      item.id !== finding.id &&
      item.studentId === finding.studentId &&
      item.lichessGameId === finding.lichessGameId &&
      item.moveNumber === finding.moveNumber &&
      item.tacticTheme === finding.tacticTheme &&
      item.status === "approved"
    ));
    if (duplicateApproved) {
      updateFinding(finding.id, {
        status: "ignored",
        reviewedAt: new Date().toISOString().slice(0, 10),
        reviewedBy: "Teacher",
        rejectionReason: "Duplicate approved tactic for the same game, move, and theme."
      });
      return;
    }
    const result = approveTacticFinding({ finding, student, progress, pendingAwards });
    const nextPendingAwards = [...result.newAwards, ...pendingAwards];
    setProgress(result.progress);
    setPendingAwards(nextPendingAwards);
    writeStore({ studentTacticProgress: result.progress, pendingAwards: nextPendingAwards });
    updateFinding(finding.id, {
      status: "approved",
      reviewedAt: new Date().toISOString().slice(0, 10),
      reviewedBy: "Teacher",
      teacherNote: finding.teacherNote || "Approved from Game Analyzer."
    });
    void fetch("/api/game-analysis/approve-finding", { method: "POST" });
  }

  function rejectFinding(finding: GameTacticFinding) {
    updateFinding(finding.id, rejectTacticFinding(finding, finding.teacherNote || "Rejected after teacher review."));
    void fetch("/api/game-analysis/reject-finding", { method: "POST" });
  }

  function addManualFinding(finding: GameTacticFinding, approveNow: boolean) {
    const nextFinding = approveNow ? { ...finding, status: "approved" as const, reviewedAt: new Date().toISOString().slice(0, 10), reviewedBy: "Teacher" } : finding;
    const nextFindings = [nextFinding, ...findings];
    setFindings(nextFindings);
    saveAnalysis(analysisRequest, analysisRequest ? nextFindings.filter((item) => item.analysisRequestId === analysisRequest.id) : nextFindings);
    if (approveNow) approveFinding({ ...finding, status: "pending_review" });
    void fetch("/api/game-analysis/manual-finding", { method: "POST" });
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-black text-white">Lichess Game Tactic Analyzer</h2>
            <p className="mt-1 text-sm text-slate-400">{message}</p>
          </div>
          <Button onClick={analyzeGame} disabled={isLoading}>{isLoading ? "Analyzing..." : "Analyze Game"}</Button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px_160px]">
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Lichess Game URL
            <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://lichess.org/abcdefgh" />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Student
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Student Color
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={studentColor} onChange={(event) => setStudentColor(event.target.value as StudentColor)}>
              <option value="auto">Auto</option>
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
          </label>
        </div>
      </Card>

      {game && <GameMetadataCard game={game} mode={mode} />}
      <TacticFindingsTable
        findings={visibleFindings}
        onApprove={approveFinding}
        onReject={rejectFinding}
        onThemeChange={(findingId: string, theme: TacticTheme) => updateFinding(findingId, { tacticTheme: theme })}
        onTeacherNoteChange={(findingId: string, note: string) => updateFinding(findingId, { teacherNote: note })}
      />
      <ManualTacticFindingForm request={analysisRequest} onAdd={addManualFinding} />
    </div>
  );
}
