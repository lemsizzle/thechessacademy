export type GameAchievementEvidence = { sourceId:string;ply:number;fen?:string;completedAt:string };
export function achievementGameLink(evidence?:GameAchievementEvidence) {
  if(!evidence || !Number.isSafeInteger(evidence.ply) || evidence.ply<0)return null;
  if(/^academy:[0-9a-f-]{36}$/i.test(evidence.sourceId))return `/student/play/game/${evidence.sourceId.slice(8)}/analysis?ply=${evidence.ply}`;
  if(/^lichess:[a-zA-Z0-9]{8}$/.test(evidence.sourceId))return `https://lichess.org/${evidence.sourceId.slice(8)}#${evidence.ply}`;
  return null;
}
