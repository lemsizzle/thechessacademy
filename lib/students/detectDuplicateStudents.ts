import type { Student } from "@/lib/types";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function detectDuplicateStudents(students: Student[]) {
  const pairs: Array<{ student: Student; possibleDuplicate: Student; reason: string }> = [];
  for (let index = 0; index < students.length; index += 1) {
    for (let next = index + 1; next < students.length; next += 1) {
      const left = students[index];
      const right = students[next];
      if (normalize(left.name) === normalize(right.name)) {
        pairs.push({ student: left, possibleDuplicate: right, reason: "Same display name" });
      } else if (left.classGroup === right.classGroup && normalize(left.name).includes(normalize(right.name).slice(0, 4))) {
        pairs.push({ student: left, possibleDuplicate: right, reason: "Similar name in same class" });
      }
    }
  }
  return pairs;
}
