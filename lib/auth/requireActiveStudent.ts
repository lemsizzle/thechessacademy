import { cookies } from "next/headers";
import { readStudentSession } from "@/lib/auth/session";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class StudentAuthenticationError extends Error {}

export async function requireActiveStudent() {
  const session = readStudentSession(await cookies());
  if (!session || !session.onboardingCompleted || !UUID_PATTERN.test(session.studentId)) {
    throw new StudentAuthenticationError("Student log in required.");
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service access is not configured.");
  const { data, error } = await supabase
    .from("students")
    .select("id,lichess_id,lichess_username,is_active")
    .eq("id", session.studentId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new StudentAuthenticationError("Student profile no longer exists.");
  const row = data as { lichess_id: string | null; lichess_username: string | null };
  const sameLichessId = Boolean(row.lichess_id && row.lichess_id === session.lichessUserId);
  const sameUsername = Boolean(row.lichess_username && row.lichess_username.toLowerCase() === session.lichessUsername.toLowerCase());
  if (!sameLichessId && !sameUsername) throw new StudentAuthenticationError("Student session does not match this profile.");
  return session;
}
