import type { ClassGroup, Student } from "@/lib/types";

export const ALL_CLASSES = "All Classes";
export const UNASSIGNED_CLASS = "Unassigned";

export function getClassGroupNames(classGroups: ClassGroup[], students: Student[]) {
  const names = Array.from(new Set([
    ...classGroups.map((group) => group.name),
    ...students.map((student) => student.classGroup)
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return [
    UNASSIGNED_CLASS,
    ...names.filter((name) => name !== UNASSIGNED_CLASS)
  ];
}

export function getClassRoster(students: Student[], classGroup: string) {
  const roster = classGroup === ALL_CLASSES
    ? students
    : students.filter((student) => student.classGroup === classGroup);
  return [...roster].sort((a, b) => a.name.localeCompare(b.name));
}

export function getClassStudentCount(students: Student[], classGroup: string) {
  return classGroup === ALL_CLASSES
    ? students.length
    : students.filter((student) => student.classGroup === classGroup).length;
}
