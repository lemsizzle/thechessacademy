import { addAnalysisMove, createEmptyAnalysisTree, updateNodeAnnotations } from "@/chess/analysis/tree";
import type { PromotionPiece } from "@/chess/types";
import type { AssessmentQuestion } from "./types";

export type TeacherAssessmentQuestion = AssessmentQuestion & {
  studentAnswer: string;
  answerLabel: string;
  correct: boolean;
  explanation: string;
  solution: string[];
};

// Temporary analysis only: the student's submitted move and grade are never edited.
export function assessmentAnalysisTree(question: TeacherAssessmentQuestion, view: "position" | "student" | "solution") {
  if (!question.fen) return null;
  let tree = createEmptyAnalysisTree(question.fen);
  tree = updateNodeAnnotations(tree, tree.rootId, { comment: question.prompt });
  const studentLine = question.kind === "move" && question.studentAnswer ? [question.studentAnswer] : [];
  const lines = view === "solution" ? [question.solution, studentLine] : [studentLine, question.solution];
  for (const line of lines) {
    let parent = tree.rootId;
    for (const uci of line) {
      const next = addAnalysisMove(tree, parent, uci.slice(0, 2), uci.slice(2, 4), uci[4] as PromotionPiece | undefined, "original");
      tree = next.tree;
      parent = next.nodeId;
    }
  }
  return tree;
}
