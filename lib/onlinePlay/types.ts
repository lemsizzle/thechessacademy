import { TIME_CONTROLS } from "@/chess/game/timeControls";
import type { LiveGameSummary } from "@/chess/live/types";

export const ONLINE_CLOCKS = TIME_CONTROLS.filter((clock) => clock.initialMs !== null);
export type OnlineStudent = { id: string; name: string; busy: boolean };
export type DirectChallenge = {
  id: string; challengerId: string; recipientId: string; opponentName: string;
  timeControlId: string; status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  expiresAt: string; gameId: string | null;
};
export type ResumableLiveGame = Pick<LiveGameSummary, "id" | "status" | "gameMode" | "viewerColor" | "opponent" | "activeColor" | "arenaTournamentId">;
export type OnlinePlayState = { students: OnlineStudent[]; incoming: DirectChallenge[]; outgoing: DirectChallenge[]; busy: boolean; activeGames?: ResumableLiveGame[] };
export const EMPTY_ONLINE_PLAY: OnlinePlayState = { students: [], incoming: [], outgoing: [], busy: false, activeGames: [] };
export function challengeIsPending(challenge: DirectChallenge, now = Date.now()) {
  return challenge.status === "pending" && Date.parse(challenge.expiresAt) > now;
}
export function onlineChallengeLabel(student: OnlineStudent, state: OnlinePlayState, now = Date.now()) {
  if (student.busy) return "Playing";
  if (state.busy) return "Finish your game";
  if (state.incoming.some((c) => c.challengerId === student.id && challengeIsPending(c, now))) return "Incoming challenge";
  if (state.outgoing.some((c) => c.recipientId === student.id && challengeIsPending(c, now))) return "Challenge sent";
  return "Challenge";
}
