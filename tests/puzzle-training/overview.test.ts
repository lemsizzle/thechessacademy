import { describe, expect, it } from "vitest";
import {
  getStudentSurvivalPersonalRecords,
  summarizePuzzleAttempts
} from "@/lib/puzzle-training/overview";

describe("puzzle training overview data", () => {
  it("summarizes attempts, solved puzzles, accuracy, and active time", () => {
    expect(summarizePuzzleAttempts([
      { solved: true, elapsedSeconds: 28.4 },
      { solved: false, elapsedSeconds: 14.4 },
      { solved: true, elapsedSeconds: -5 },
      { solved: true, elapsedSeconds: Number.NaN }
    ])).toEqual({
      attempts: 4,
      solved: 3,
      accuracy: 75,
      elapsedSeconds: 43
    });
  });

  it("returns zeroes when no puzzle attempts have been recorded", () => {
    expect(summarizePuzzleAttempts([])).toEqual({
      attempts: 0,
      solved: 0,
      accuracy: 0,
      elapsedSeconds: 0
    });
  });

  it("keeps only one student's Survival records in theme order", () => {
    const records = getStudentSurvivalPersonalRecords([
      { studentId: "student-a", theme: "pin", weekScore: 4, monthScore: 8, allTimeScore: 12 },
      { studentId: "student-b", theme: "mixed", weekScore: 20, monthScore: 20, allTimeScore: 20 },
      { studentId: "student-a", theme: "mixed", weekScore: 7, monthScore: 9, allTimeScore: 13 },
      { studentId: "student-a", theme: "fork", weekScore: 3, monthScore: 6, allTimeScore: 10 }
    ], "student-a");

    expect(records.map((record) => record.theme)).toEqual(["mixed", "fork", "pin"]);
    expect(records[0]).toEqual({ theme: "mixed", weekScore: 7, monthScore: 9, allTimeScore: 13 });
  });
});
