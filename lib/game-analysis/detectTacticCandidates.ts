import type { GameTacticFinding, StudentColor, TacticConfidence, TacticTheme } from "@/lib/types";
import type { ReplayedMove } from "@/lib/game-analysis/replayGame";

function signalForMove(move: ReplayedMove): { tacticTheme: TacticTheme; confidence: TacticConfidence; reason: string } | null {
  if (move.isCheckmate) {
    return { tacticTheme: "Mate in One", confidence: "high", reason: "The move appears to end the game with checkmate." };
  }
  if (move.piece === "n" && move.isCheck && move.captured) {
    return { tacticTheme: "Fork", confidence: "medium", reason: "A knight capture with check is often a fork candidate." };
  }
  if (move.isCheck && move.captured) {
    return { tacticTheme: "Double Attack", confidence: "medium", reason: "The move captures while giving check, which can be a forcing tactic." };
  }
  if (move.isCheck) {
    return { tacticTheme: "Double Attack", confidence: "low", reason: "The move gives check and may create a forcing tactic." };
  }
  if (move.captured) {
    return { tacticTheme: "Removing the Defender", confidence: "low", reason: "The move captures material and may remove an important defender." };
  }
  return null;
}

export function detectTacticCandidates({
  analysisRequestId,
  studentId,
  gameId,
  studentColor,
  moves
}: {
  analysisRequestId: string;
  studentId: string;
  gameId: string;
  studentColor: Exclude<StudentColor, "auto">;
  moves: ReplayedMove[];
}) {
  return moves.flatMap((move): GameTacticFinding[] => {
    if (move.color !== studentColor) return [];
    const signal = signalForMove(move);
    if (!signal) return [];
    return [{
      id: `finding-${analysisRequestId}-${move.moveNumber}-${move.uci}-${signal.tacticTheme.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      analysisRequestId,
      studentId,
      lichessGameId: gameId,
      moveNumber: move.moveNumber,
      moveSan: move.san,
      moveUci: move.uci,
      tacticTheme: signal.tacticTheme,
      confidence: signal.confidence,
      detectionMethod: "rule_based",
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      aiExplanationTeacher: signal.reason,
      aiExplanationStudent: signal.reason,
      whyThisMoveWorks: signal.reason,
      cautionIfUncertain: signal.confidence === "low" ? "This is a weak signal. Review the position before counting it." : undefined,
      status: "pending_review",
      createdAt: new Date().toISOString().slice(0, 10)
    }];
  }).slice(0, 8);
}
