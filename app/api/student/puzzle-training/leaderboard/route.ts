import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getStudentsResult } from "@/lib/data/students";
import { getSurvivalLeaderboardScores } from "@/lib/leaderboard/survivalServer";
import type { PuzzleLeaderboardData } from "@/lib/puzzle-training/leaderboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireActiveStudent();
    const [students, survivalScores] = await Promise.all([
      getStudentsResult(),
      getSurvivalLeaderboardScores()
    ]);
    // A temporary data failure must not substitute example students in the leaderboard.
    if (students.source !== "supabase") throw new Error("Student records are unavailable.");
    const avatarDisplay = await getStudentAvatarDisplayData(students.data.map((student) => student.id));
    const data: PuzzleLeaderboardData = {
      students: students.data,
      avatarItems: avatarDisplay.items,
      studentAvatars: avatarDisplay.avatars,
      survivalScores
    };
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof StudentAuthenticationError ? "Student log in required." : "The puzzle leaderboard is temporarily unavailable. Please try again." },
      { status: error instanceof StudentAuthenticationError ? 401 : 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
