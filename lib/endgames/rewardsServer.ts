import "server-only";
import { Chess } from "chess.js";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { endgameCandidateFromSeed } from "./generator";
import { replayEndgame } from "./practice";
import { EndgameInputError, readEndgameRewardToken } from "./rewardToken";

export function verifyEndgameCompletion(studentId: string, body: Record<string, unknown>) {
  const session = readEndgameRewardToken(body.token, studentId);
  if (!Number.isInteger(body.candidateIndex) || Number(body.candidateIndex) < 0 || Number(body.candidateIndex) >= 20 || !Array.isArray(body.moves) || body.moves.length < 1 || body.moves.length > 1000 || typeof body.assisted !== "boolean") throw new EndgameInputError("Invalid endgame completion.");
  const fen = endgameCandidateFromSeed(session.topicId, session.seed, Number(body.candidateIndex), session.version === 2 ? session.difficulty : "standard");
  try {
    const game = replayEndgame(fen, body.moves);
    if (!game.isCheckmate() || game.turn() === new Chess(fen).turn()) throw new Error("Not a player win");
  } catch { throw new EndgameInputError("Finish this generated position with checkmate to earn the reward."); }
  return session;
}

export async function saveEndgameReward(studentId: string, body: Record<string, unknown>) {
  const complete = body.action === "complete";
  const session = complete ? verifyEndgameCompletion(studentId, body) : readEndgameRewardToken(body.token, studentId);
  const db = getSupabaseServiceClient();
  if (!db) throw new Error("Rewards are unavailable.");
  const { data, error } = await db.rpc("save_endgame_training_reward", {
    p_student_id: studentId, p_attempt_id: session.id, p_topic_id: session.topicId,
    p_complete: complete, p_assisted: !complete || body.assisted === true
  });
  if (error || !data) throw new Error("Could not save the practice reward.");
  return data as { rewardXp: number; awarded: boolean; assisted: boolean };
}
