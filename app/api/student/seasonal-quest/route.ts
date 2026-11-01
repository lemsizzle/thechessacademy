import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { HALLOWEEN_HUNT, SEASONAL_BOT_HUNTS } from "@/lib/quests/seasonalBotHunts";

export async function GET(request?: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { studentId } = await requireActiveStudent();
    const questId = request ? new URL(request.url).searchParams.get("questId") ?? HALLOWEEN_HUNT.id : HALLOWEEN_HUNT.id;
    if (!SEASONAL_BOT_HUNTS.some((hunt) => hunt.id === questId)) return NextResponse.json({ error: "Unknown seasonal quest." }, { status: 404, headers });
    const { data, error } = questId === HALLOWEEN_HUNT.id
      ? await getSupabaseAdminClient().rpc("halloween_2026_progress", { p_student_id: studentId })
      : await getSupabaseAdminClient().rpc("seasonal_bot_hunt_progress", { p_student_id: studentId, p_quest_id: questId });
    if (error || !data) throw new Error(error?.message ?? "Seasonal quest is not configured.");
    return NextResponse.json(data, { headers });
  } catch (error) {
    return NextResponse.json({ error: "Could not load your seasonal quest. Try again." }, {
      status: error instanceof StudentAuthenticationError ? 401 : 500, headers
    });
  }
}
