import "server-only";
import { after } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { detectGameAchievements, type AchievementGame } from "./detect";
import type { RawLichessGame } from "@/lib/lichess/fetchStudentGamesForWindow";
import { lichessAchievementInput } from "./lichess";

function client() { const c=getSupabaseServiceClient();if(!c)throw new Error("Achievement storage unavailable");return c; }
type Scan = { source_id:string;internal_game_id:string|null;payload:AchievementGame|null };
const active = new Map<string,Promise<void>>();

export function processPendingGameAchievements(studentId:string) {
  const pending=active.get(studentId);if(pending)return pending;
  const task=drain(studentId).finally(()=>active.delete(studentId));
  active.set(studentId,task);return task;
}
async function drain(studentId:string) {
  const db=client();
  // Bounded work, ordered to preserve match streaks. Failed jobs remain pending.
  const {data,error}=await db.from("game_achievement_scans").select("source_id,internal_game_id,payload")
    .eq("student_id",studentId).is("processed_at",null).order("completed_at").order("source_id").limit(12);
  if(error)throw new Error(error.message);
  for(const scan of (data??[]) as Scan[]) {
    let input=scan.payload;
    if(scan.internal_game_id) {
      const {data:game,error:gameError}=await db.from("internal_chess_games").select("initial_fen,moves,player_color,winner_color,result_reason,time_control")
        .eq("id",scan.internal_game_id).eq("player_id",studentId).single();
      if(gameError)throw new Error(gameError.message);
      input={initialFen:game.initial_fen,moves:game.moves,color:game.player_color==="white"?"w":"b",winner:game.winner_color===null?null:game.winner_color==="white"?"w":"b",reason:game.result_reason,
        incrementMs:game.time_control?.incrementMs,clocksMs:game.moves.map((m:{clockAfterMs?:number})=>m.clockAfterMs??null)};
    }
    if(!input)throw new Error("Achievement game data missing");
    let hits;
    try { hits=detectGameAchievements(input); }
    catch {
      // Deterministically invalid replays must not block every later game. A rejected
      // game breaks a streak; transient database failures still remain retryable.
      const {error:rejectError}=await db.from("game_achievement_scans").update({processed_at:new Date().toISOString(),payload:null,won:false,validation_error:"Invalid legal move history"})
        .eq("student_id",studentId).eq("source_id",scan.source_id).is("processed_at",null);
      if(rejectError)throw new Error(rejectError.message);
      console.error("Invalid achievement replay",scan.source_id);
      continue;
    }
    const {error:awardError}=await db.rpc("complete_game_achievement_scan",{p_student_id:studentId,p_source_id:scan.source_id,p_hits:hits});
    if(awardError)throw new Error(awardError.message);
  }
}

export function scheduleGameAchievements(studentIds:string[]) {
  // Queue rows were committed with the game. This work never delays a move reply.
  after(async()=>{
    for(const id of new Set(studentIds)) {
      try { await processPendingGameAchievements(id); }
      catch(error) { console.error("Game achievement scan pending",error instanceof Error?error.message:String(error)); }
    }
  });
}

export function scheduleLichessAchievements(studentId:string,username:string,games:RawLichessGame[]) {
  after(async()=>{
    try { await enqueueLichessAchievements(studentId,username,games); }
    catch(error) { console.error("Lichess achievements pending",error instanceof Error?error.message:String(error)); }
  });
}

export async function enqueueLichessAchievements(studentId:string,username:string,games:RawLichessGame[]) {
  const db=client();
  const {data:release,error}=await db.from("game_achievement_release").select("launched_at").eq("singleton",true).single();
  if(error)throw new Error(error.message);
  const since=new Date(release.launched_at).getTime();
  const rows=games.flatMap(game=>{
    if(!game.createdAt || game.createdAt<since)return [];
    const payload=lichessAchievementInput(game,username);if(!payload)return [];
    const opponent=game.players?.[payload.color==="w"?"black":"white"];
    const opponentId=opponent?.user?.id??opponent?.user?.name??opponent?.userId??opponent?.name;
    // Anonymous opponents must not accidentally share a streak identity.
    return [{student_id:studentId,source_id:`lichess:${game.id}`,started_at:new Date(game.createdAt).toISOString(),completed_at:new Date(game.lastMoveAt!).toISOString(),
      opponent_key:`lichess:${opponentId?.toLowerCase()??game.id}`,won:payload.winner===payload.color,payload}];
  });
  if(rows.length) {
    const {error:writeError}=await db.from("game_achievement_scans").upsert(rows,{onConflict:"student_id,source_id",ignoreDuplicates:true});
    if(writeError)throw new Error(writeError.message);
  }
  await processPendingGameAchievements(studentId);
}
