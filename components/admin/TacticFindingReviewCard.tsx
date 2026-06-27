import { Button } from "@/components/Button";
import type { GameTacticFinding, TacticTheme } from "@/lib/types";

const tacticThemes: TacticTheme[] = ["Fork", "Pin", "Skewer", "Discovered Attack", "Double Attack", "Deflection", "Decoy", "Removing the Defender", "Back Rank Mate", "Mate in One"];

export function TacticFindingReviewCard({
  finding,
  onApprove,
  onReject,
  onThemeChange,
  onTeacherNoteChange
}: {
  finding: GameTacticFinding;
  onApprove: () => void;
  onReject: () => void;
  onThemeChange: (theme: TacticTheme) => void;
  onTeacherNoteChange: (note: string) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-white">Move {finding.moveNumber}: {finding.moveSan}</p>
            <span className="rounded bg-cyan-300/10 px-2 py-1 text-[11px] font-black uppercase text-cyan-100">{finding.confidence}</span>
            <span className="rounded bg-white/10 px-2 py-1 text-[11px] font-black uppercase text-slate-200">{finding.status.replace("_", " ")}</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">{finding.aiExplanationStudent}</p>
          <p className="mt-2 text-xs text-slate-400">{finding.aiExplanationTeacher}</p>
          {finding.cautionIfUncertain && <p className="mt-2 text-xs font-bold text-amber-100">{finding.cautionIfUncertain}</p>}
        </div>
        <div className="grid gap-2 lg:w-72">
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={finding.tacticTheme} onChange={(event) => onThemeChange(event.target.value as TacticTheme)} disabled={finding.status !== "pending_review"}>
            {tacticThemes.map((theme) => <option key={theme}>{theme}</option>)}
          </select>
          <textarea className="min-h-20 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={finding.teacherNote ?? ""} onChange={(event) => onTeacherNoteChange(event.target.value)} placeholder="Teacher note" />
          {finding.status === "pending_review" ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onApprove}>Approve</Button>
              <Button variant="ghost" onClick={onReject}>Reject</Button>
            </div>
          ) : (
            <p className="text-xs font-bold text-slate-400">Reviewed {finding.reviewedAt ?? ""}</p>
          )}
        </div>
      </div>
    </div>
  );
}
