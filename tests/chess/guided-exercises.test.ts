import { describe, expect, it } from "vitest";
import { aggregateGuidedAttempts, parseGuidedAttemptInput } from "@/chess/analysis/guidedExercises";

const chapterId = "10000000-0000-4000-8000-000000000001";

describe("guided exercise attempt persistence", () => {
  it("normalizes a valid board move payload", () => {
    expect(parseGuidedAttemptInput({ chapterId, nodeId: "root", move: { from: "e2", to: "e4" } })).toEqual({
      chapterId, nodeId: "root", move: { from: "e2", to: "e4", promotion: undefined }
    });
  });

  it("rejects malformed position and move identifiers", () => {
    expect(() => parseGuidedAttemptInput({ chapterId: "chapter", nodeId: "root", move: { from: "e2", to: "e4" } })).toThrow("chapter");
    expect(() => parseGuidedAttemptInput({ chapterId, nodeId: "", move: { from: "e2", to: "e4" } })).toThrow("position");
    expect(() => parseGuidedAttemptInput({ chapterId, nodeId: "root", move: { from: "e2", to: "e9" } })).toThrow("move");
  });

  it("summarizes retries and first-try solves per student position", () => {
    const base = { studentId: "student-a", studentName: "Ari", chapterId, chapterTitle: "Center", nodeId: "root", prompt: "Find the move." };
    const progress = aggregateGuidedAttempts([
      { ...base, id: "1", correct: false, attemptedAt: "2026-08-21T01:00:00.000Z" },
      { ...base, id: "2", correct: true, attemptedAt: "2026-08-21T01:01:00.000Z" },
      { ...base, id: "3", studentId: "student-b", studentName: "Bea", correct: true, attemptedAt: "2026-08-21T01:02:00.000Z" }
    ]);
    expect(progress.find((row) => row.studentId === "student-a")).toMatchObject({ totalAttempts: 2, incorrectAttempts: 1, solved: true, firstTrySolved: false });
    expect(progress.find((row) => row.studentId === "student-b")).toMatchObject({ totalAttempts: 1, incorrectAttempts: 0, solved: true, firstTrySolved: true });
  });
});
