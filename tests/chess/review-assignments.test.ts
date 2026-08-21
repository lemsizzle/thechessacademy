import { describe, expect, it } from "vitest";
import { parseReviewAssignmentInput, parseStudentReviewResponse, parseTeacherReviewDecision, reviewAnswerIsVisible, reviewStatusAllowsSubmission } from "@/chess/analysis/reviewAssignments";

const studentId = "123e4567-e89b-42d3-a456-426614174000";
const chapterId = "223e4567-e89b-42d3-a456-426614174000";

describe("review assignments", () => {
  it("normalizes an assignment and defaults answers to after completion", () => {
    expect(parseReviewAssignmentInput({ studentId, chapterId, prompt: "  Find Black's threat.  ", teacherAnswer: "  ...Qh2+  " })).toEqual({
      studentId,
      chapterId,
      prompt: "Find Black's threat.",
      teacherAnswer: "...Qh2+",
      answerVisibility: "after_completion"
    });
  });

  it("rejects invalid identities and empty or oversized prompts", () => {
    expect(() => parseReviewAssignmentInput({ studentId: "student", prompt: "Review" })).toThrow("Invalid student");
    expect(() => parseReviewAssignmentInput({ studentId, prompt: " " })).toThrow("Invalid review prompt");
    expect(() => parseReviewAssignmentInput({ studentId, prompt: "x".repeat(2001) })).toThrow("Invalid review prompt");
    expect(() => parseReviewAssignmentInput({ studentId, prompt: "Review", answerVisibility: "sometimes" })).toThrow("Invalid answer visibility");
    expect(() => parseReviewAssignmentInput({ studentId, prompt: "Review", teacherAnswer: "x".repeat(4001) })).toThrow("Invalid teacher answer");
  });

  it("reveals teacher answers only according to the configured gate", () => {
    expect(reviewAnswerIsVisible("admin", "teacher_only", "assigned")).toBe(true);
    expect(reviewAnswerIsVisible("student", "visible", "assigned")).toBe(true);
    expect(reviewAnswerIsVisible("student", "after_completion", "assigned")).toBe(false);
    expect(reviewAnswerIsVisible("student", "after_completion", "submitted")).toBe(true);
    expect(reviewAnswerIsVisible("student", "after_completion", "returned")).toBe(true);
    expect(reviewAnswerIsVisible("student", "teacher_only", "approved")).toBe(false);
  });

  it("validates student submissions and teacher decisions", () => {
    expect(parseStudentReviewResponse("  I would play Nf3.  ")).toBe("I would play Nf3.");
    expect(() => parseStudentReviewResponse(" ")).toThrow("Invalid student response");
    expect(() => parseStudentReviewResponse("x".repeat(4001))).toThrow("Invalid student response");
    expect(parseTeacherReviewDecision({ decision: "return", teacherFeedback: "  Explain the threat first.  " })).toEqual({ decision: "return", teacherFeedback: "Explain the threat first." });
    expect(() => parseTeacherReviewDecision({ decision: "return", teacherFeedback: "" })).toThrow("Feedback is required");
    expect(() => parseTeacherReviewDecision({ decision: "later" })).toThrow("Invalid review decision");
  });

  it("allows answers only before submission or after a return", () => {
    expect(reviewStatusAllowsSubmission("assigned")).toBe(true);
    expect(reviewStatusAllowsSubmission("returned")).toBe(true);
    expect(reviewStatusAllowsSubmission("submitted")).toBe(false);
    expect(reviewStatusAllowsSubmission("approved")).toBe(false);
  });
});
