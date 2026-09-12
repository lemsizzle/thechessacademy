import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { StudentSession } from "@/lib/types";

/** Called only after OAuth state/PKCE and the active signed Academy session are verified. */
export async function linkAcademyLichess(session: StudentSession, profile: { id: string; username: string }) {
  if ((session.authProvider !== "academy" && session.authProvider !== "supabase")) throw new Error("Academy login required.");
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Student storage unavailable.");
  const existing = await supabase.from("students").select("id,lichess_id,lichess_username")
    .eq("id", session.studentId).eq("is_active", true).maybeSingle();
  if (existing.error || !existing.data) throw new Error("Student unavailable.");
  if (existing.data.lichess_id && existing.data.lichess_id !== profile.id) throw new Error("Another Lichess account is already linked.");
  if (existing.data.lichess_username && existing.data.lichess_username.toLowerCase() !== profile.username.toLowerCase()) throw new Error("Use the Lichess account assigned by your teacher.");
  const otherId = await supabase.from("students").select("id").eq("lichess_id", profile.id).neq("id", session.studentId).maybeSingle();
  const otherName = await supabase.from("students").select("id").ilike("lichess_username", profile.username).neq("id", session.studentId).maybeSingle();
  if (otherId.error || otherName.error || otherId.data || otherName.data) throw new Error("This Lichess account is already assigned.");
  let update = supabase.from("students").update({ lichess_id: profile.id, lichess_username: profile.username })
    .eq("id", session.studentId).eq("is_active", true);
  update = existing.data.lichess_id ? update.eq("lichess_id", profile.id) : update.is("lichess_id", null);
  const result = await update.select("id").maybeSingle();
  if (result.error || !result.data) throw new Error("Lichess linking could not be completed.");
  return session.studentId;
}
