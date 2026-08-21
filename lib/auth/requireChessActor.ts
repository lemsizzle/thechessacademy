import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";
import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";

export type ChessActor =
  | { kind: "admin" }
  | { kind: "student"; studentId: string; name: string };

export async function requireChessActor(): Promise<ChessActor> {
  const cookieStore = await cookies();
  if (await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) return { kind: "admin" };
  const student = await requireActiveStudent();
  return { kind: "student", studentId: student.studentId, name: student.name };
}
