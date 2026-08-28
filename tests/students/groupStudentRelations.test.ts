import { describe, expect, it } from "vitest";
import { groupStudentRelations } from "@/lib/students/groupStudentRelations";

describe("groupStudentRelations", () => {
  it("groups rows in their original order without creating entries for missing students", () => {
    const rows = [
      { student_id: "student-b", value: "first-b" },
      { student_id: "student-a", value: "first-a" },
      { student_id: "student-b", value: "second-b" }
    ];

    const grouped = groupStudentRelations(rows);

    expect(grouped.get("student-a")?.map((row) => row.value)).toEqual(["first-a"]);
    expect(grouped.get("student-b")?.map((row) => row.value)).toEqual(["first-b", "second-b"]);
    expect(grouped.has("student-c")).toBe(false);
  });
});
