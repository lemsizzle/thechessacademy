import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { studentId } = await requireActiveStudent();
    const { data, error } = await getSupabaseAdminClient().rpc("halloween_2026_progress", { p_student_id: studentId });
    if (error) throw new Error(error.message);
    return NextResponse.json(data, { headers });
  } catch (error) {
    return NextResponse.json({ error: "Could not load your Halloween quest. Try again." }, {
      status: error instanceof StudentAuthenticationError ? 401 : 500, headers
    });
  }
}
