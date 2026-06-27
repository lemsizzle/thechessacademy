import { Card } from "@/components/Card";
import { TacticFindingReviewCard } from "@/components/admin/TacticFindingReviewCard";
import type { GameTacticFinding, TacticTheme } from "@/lib/types";

export function TacticFindingsTable({
  findings,
  onApprove,
  onReject,
  onThemeChange,
  onTeacherNoteChange
}: {
  findings: GameTacticFinding[];
  onApprove: (finding: GameTacticFinding) => void;
  onReject: (finding: GameTacticFinding) => void;
  onThemeChange: (findingId: string, theme: TacticTheme) => void;
  onTeacherNoteChange: (findingId: string, note: string) => void;
}) {
  return (
    <Card className="p-4">
      <h2 className="font-black text-white">Tactic Findings</h2>
      <p className="mt-1 text-sm text-slate-400">AI explanations are helpers. Approve only after teacher review.</p>
      <div className="mt-4 space-y-3">
        {findings.map((finding) => (
          <TacticFindingReviewCard
            key={finding.id}
            finding={finding}
            onApprove={() => onApprove(finding)}
            onReject={() => onReject(finding)}
            onThemeChange={(theme) => onThemeChange(finding.id, theme)}
            onTeacherNoteChange={(note) => onTeacherNoteChange(finding.id, note)}
          />
        ))}
        {findings.length === 0 && <p className="text-sm text-slate-300">No tactic candidates found yet. You can add one manually below.</p>}
      </div>
    </Card>
  );
}
