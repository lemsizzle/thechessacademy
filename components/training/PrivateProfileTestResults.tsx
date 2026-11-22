import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";
import { readStudentSession } from "@/lib/auth/session";
import { ProfileTestResults } from "./ProfileTestResults";

// Only show this section to the teacher or profile owner. The API independently
// checks active student access before returning any scores.
export async function PrivateProfileTestResults({ studentId }: { studentId: string }) {
  const cookieStore = await cookies();
  const teacher = await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!teacher && readStudentSession(cookieStore)?.studentId !== studentId) return null;
  return <ProfileTestResults key={studentId} studentId={studentId} />;
}
