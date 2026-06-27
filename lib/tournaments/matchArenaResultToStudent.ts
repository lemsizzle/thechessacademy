import type { ArenaTournamentResult, Student, StudentLichessAccount } from "@/lib/types";

export function normalizeLichessUsername(username?: string) {
  return username?.trim().toLowerCase() ?? "";
}

export function matchArenaResultToStudent(result: ArenaTournamentResult, students: Student[], accounts: StudentLichessAccount[]) {
  const username = normalizeLichessUsername(result.lichessUsername);
  const account = accounts.find((item) => normalizeLichessUsername(item.lichessUsername) === username);
  const student = students.find((item) => item.id === account?.studentId)
    ?? students.find((item) => normalizeLichessUsername(item.lichessUsername) === username);

  return { ...result, studentId: student?.id, matched: Boolean(student) };
}
