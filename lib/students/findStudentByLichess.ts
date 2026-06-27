import { studentLichessAccounts } from "@/data/lichessSync";
import { students } from "@/data/students";
import type { Student } from "@/lib/types";

export function findStudentByLichess(lichessUserId: string, lichessUsername: string): Student | null {
  const userId = lichessUserId.toLowerCase();
  const username = lichessUsername.toLowerCase();
  const linked = studentLichessAccounts.find((account) => (
    account.lichessUserId.toLowerCase() === userId ||
    account.lichessUsername.toLowerCase() === username
  ));
  if (linked) return students.find((student) => student.id === linked.studentId) ?? null;
  return students.find((student) => student.lichessUsername?.toLowerCase() === username || student.slug.toLowerCase() === username) ?? null;
}
