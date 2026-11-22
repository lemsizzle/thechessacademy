import { describe, it, expect } from "vitest";
import { assessmentAnalysisTree, type TeacherAssessmentQuestion } from "@/lib/assessment/teacherReview";
import { SKILLS_FORM_B } from "@/lib/assessment/questions";
import { Chess } from "chess.js";

describe("teacher assessment analysis", () => {
  it("preserves original positions, answers, and legal solution lines for every question", () => {
    for (const source of SKILLS_FORM_B) {
      const question: TeacherAssessmentQuestion = { ...source, studentAnswer: source.acceptedMoves.at(-1)!, answerLabel: "answer", correct: true };
      const before = JSON.stringify(question);
      for (const view of ["position", "student", "solution"] as const) {
        const tree = assessmentAnalysisTree(question, view)!;
        expect(tree.nodes[tree.rootId].fen).toBe(new Chess(source.fen).fen());
        const first = tree.nodes[tree.nodes[tree.rootId].mainChildId!];
        expect(first.uci).toBe(view === "solution" ? source.solution[0] : question.studentAnswer);
        for (const node of Object.values(tree.nodes)) {
          if (!node.parentId) continue;
          const chess = new Chess(tree.nodes[node.parentId].fen);
          chess.move(node.san!);
          expect(node.fen).toBe(chess.fen());
        }
      }
      expect(JSON.stringify(question)).toBe(before);
    }
  });
  it("retains wrong moves as a separate branch, accepts blanks, and handles original text questions", () => {
    const source = SKILLS_FORM_B[0];
    const wrong = new Chess(source.fen).moves({verbose:true}).find(move => !source.acceptedMoves.includes(move.from + move.to))!;
    const question: TeacherAssessmentQuestion = {...source, studentAnswer: wrong.from + wrong.to, answerLabel: "answer", correct:false};
    const tree = assessmentAnalysisTree(question,"student")!;
    expect(tree.nodes[tree.rootId].childrenIds).toHaveLength(2);
    expect(tree.nodes[tree.nodes[tree.rootId].mainChildId!].uci).toBe(question.studentAnswer);
    expect(assessmentAnalysisTree({...question,studentAnswer:""},"position")).not.toBeNull();
    expect(assessmentAnalysisTree({...question,fen:undefined},"position")).toBeNull();
  });
});
