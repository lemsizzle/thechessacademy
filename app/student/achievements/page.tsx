import { requireStudentPage } from "@/lib/auth/requireStudentPage";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { GameAchievementCollection, type AchievementAward } from "@/components/GameAchievementCollection";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { processPendingGameAchievements } from "@/lib/badges/gameAchievements/server";
export const dynamic="force-dynamic";
export default async function AchievementsPage() {
  const student=await requireStudentPage();
  let unavailable=false;
  let awards:AchievementAward[]=[];
  let launchedAt:string|null=null;
  try {
    await processPendingGameAchievements(student.studentId);
    const db=getSupabaseServiceClient();if(!db)throw new Error("Storage unavailable");
    const [earned,release]=await Promise.all([
      db.from("student_badges").select("badge_id,awarded_at,achievement_evidence").eq("student_id",student.studentId),
      db.from("game_achievement_release").select("launched_at").eq("singleton",true).single()
    ]);
    if(earned.error||release.error)throw new Error("Collection unavailable");
    awards=(earned.data??[]) as AchievementAward[];launchedAt=release.data.launched_at;
  } catch { unavailable=true; }
  return <StudentPortalShell title="Game Achievements" subtitle="Little discoveries. Lasting trophies.">
    {unavailable && <p role="status" className="mb-4 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-amber-100">Your earned status is temporarily unavailable. Your badges are safe; refresh to try again.</p>}
    {!unavailable && <GameAchievementCollection awards={awards} launchedAt={launchedAt} />}
  </StudentPortalShell>;
}
