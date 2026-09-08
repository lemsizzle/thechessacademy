import { NextRequest, NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SurvivalRoundRewards } from "@/lib/puzzle-training/roundRewards";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const { studentId } = await requireActiveStudent();
    const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
    if (!UUID_PATTERN.test(sessionId)) {
      return NextResponse.json({ error: "A valid round is required." }, { status: 400, headers });
    }
    const { data, error } = await getSupabaseAdminClient().rpc("get_survival_round_rewards", {
      p_student_id: studentId,
      p_session_id: sessionId
    });
    if (error || !data) throw new Error("Round rewards lookup failed.");
    return NextResponse.json(data as SurvivalRoundRewards, { headers });
  } catch (error) {
    if (error instanceof StudentAuthenticationError) {
      return NextResponse.json({ error: "Please log in to view your rewards." }, { status: 401, headers });
    }
    console.error("Survival round rewards unavailable", error);
    return NextResponse.json({ error: "Could not load your rewards. Please try again." }, { status: 500, headers });
  }
}
