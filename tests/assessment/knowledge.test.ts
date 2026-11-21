import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { KNOWLEDGE_FORM_A, publicQuestions, assessmentKey, validateAssessmentAnswers } from "@/lib/assessment/questions";
import { assessmentReview } from "@/lib/assessment/server";
import { LEGACY_ASSESSMENT_SECTIONS as ASSESSMENT_SECTIONS, LEGACY_ASSESSMENT_VERSION, knowledgePercent } from "@/lib/assessment/types";

const position = (id: string) => new Chess(KNOWLEDGE_FORM_A.find(q => q.id === id)!.fen!);
describe("fixed knowledge assessment", () => {
  it("has 30 uniquely keyed questions with balanced topics and no answers in the public projection", () => {
    expect(KNOWLEDGE_FORM_A).toHaveLength(30);
    expect(new Set(KNOWLEDGE_FORM_A.map(q => q.id)).size).toBe(30);
    for (const section of ASSESSMENT_SECTIONS) expect(KNOWLEDGE_FORM_A.filter(q => q.section === section)).toHaveLength(5);
    for (const q of KNOWLEDGE_FORM_A) { expect(q.options).toHaveLength(4); expect(q.options.some(o => o.id === q.answer)).toBe(true); if (q.fen) expect(() => new Chess(q.fen)).not.toThrow(); }
    expect(publicQuestions(LEGACY_ASSESSMENT_VERSION).every(q => !("answer" in q) && !("explanation" in q))).toBe(true);
  });
  it("validates the diagram's legal moves, fork, pin, and refutation", () => {
    expect(position("r5").isStalemate()).toBe(true);
    expect(position("v1").moves()).toContain("Rxb4");
    expect(position("v2").moves()).toContain("Ne6");
    expect(position("v3").moves()).not.toContain("Bxh6");
    expect(position("v4").isAttacked("c4", "b")).toBe(true);
    expect(position("v4").isAttacked("e4", "b")).toBe(true);
    expect(position("v5").moves()).toContain("Kd1");
    for (const move of ["h3", "Ra2", "Ke2"]) expect(position("v5").moves()).not.toContain(move);
    const fork = position("c3"); fork.move("Nc7+"); fork.move("Kd7"); expect(fork.move("Nxa8").captured).toBe("q");
    expect(position("t2").moves({verbose:true}).filter(m => m.from === "e7")).toHaveLength(0);
    const trap = position("c4"); trap.move("Nf7"); expect(trap.move("Kxf7").captured).toBe("n");
  });
  it("distinguishes checkmate from stalemate and validates rook underpromotion", () => {
    const mate = position("c2"); mate.move("Qg7#"); expect(mate.isCheckmate()).toBe(true);
    const stalemate = position("c2"); stalemate.move("Qf7"); expect(stalemate.isStalemate()).toBe(true);
    const queen = position("e5"); queen.move({from:"c7",to:"c8",promotion:"q"}); expect(queen.isStalemate()).toBe(true);
    const rook = position("e5"); rook.move({from:"c7",to:"c8",promotion:"r"}); expect(rook.isGameOver()).toBe(false);
    for (const promotion of ["n","b"]) { const game = position("e5"); game.move({from:"c7",to:"c8",promotion}); expect(game.isInsufficientMaterial()).toBe(true); }
  });
  it("rejects invalid input and reports scores, blanks, and incorrect choices", () => {
    expect(validateAssessmentAnswers({ r1: "b", r2: "" },LEGACY_ASSESSMENT_VERSION)).toEqual({r1:"b",r2:""});
    for (const input of [null, [], {foo:"a"}, {r1:"x"}, {r1:3}]) expect(() => validateAssessmentAnswers(input,LEGACY_ASSESSMENT_VERSION)).toThrow();
    expect(knowledgePercent(30)).toBe(100); expect(knowledgePercent(20)).toBe(67);
    const key=assessmentKey(LEGACY_ASSESSMENT_VERSION) as Record<string,string>;
    const wrong = KNOWLEDGE_FORM_A.find(q => q.id === "r2")!.options.find(o => o.id !== key.r2)!.id;
    const review = assessmentReview({answers:{...key,r1:"",r2:wrong}});
    expect(review.filter(r => r.correct)).toHaveLength(28);
    expect(review.every(r => r.explanation.length > 20)).toBe(true);
  });
});
