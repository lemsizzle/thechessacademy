import "server-only";

import type {
  CorrespondenceChallenge,
  CorrespondenceChallengeAction,
  CorrespondenceChallengeStatus,
  CorrespondenceInbox,
  CorrespondenceParty
} from "@/chess/correspondence/types";
import type { LiveGamePlayer, LiveGameRecord, LiveGameSummary } from "@/chess/live/types";
import { livePlayerColor } from "@/chess/live/rules";
import { persistRecentCorrespondenceCompletions, settleCorrespondenceDeadlines } from "@/chess/persistence/liveGameServer";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SEEN_IDS = 100;

type ChallengeRow = {
  id: string;
  challenger_id: string;
  recipient_id: string;
  status: CorrespondenceChallengeStatus;
  expires_at: string;
  recipient_seen_at: string | null;
  accepted_game_id: string | null;
  created_at: string;
};

type StudentRow = {
  id: string;
  display_name: string | null;
  lichess_username: string | null;
  public_slug: string | null;
};

export class CorrespondenceServerError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function serviceClient() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new CorrespondenceServerError("Correspondence games are not configured.", 503);
  return supabase;
}

export function validCorrespondenceId(value: unknown, label = "ID") {
  const id = String(value ?? "");
  if (!UUID_PATTERN.test(id)) throw new CorrespondenceServerError(`Invalid ${label}.`);
  return id;
}

export function parseCorrespondenceChallengeInput(value: unknown) {
  const body = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return { recipientStudentId: validCorrespondenceId(body.recipientStudentId, "student ID") };
}

export function parseCorrespondenceAction(value: unknown): CorrespondenceChallengeAction {
  const body = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  if (body.action === "accept" || body.action === "reject" || body.action === "cancel") return body.action;
  throw new CorrespondenceServerError("Choose accept, reject, or cancel.");
}

export function parseCorrespondenceSeenInput(value: unknown) {
  if (value === null || value === undefined) return null;
  const body = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  if (body.challengeIds === undefined || body.challengeIds === null) return null;
  if (!Array.isArray(body.challengeIds) || body.challengeIds.length > MAX_SEEN_IDS) {
    throw new CorrespondenceServerError(`Choose no more than ${MAX_SEEN_IDS} challenges.`);
  }
  const ids = body.challengeIds.map((id) => validCorrespondenceId(id, "challenge ID"));
  if (new Set(ids).size !== ids.length) throw new CorrespondenceServerError("Challenge IDs must be unique.");
  return ids;
}

function rpcStatus(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("not found")) return 404;
  if (lower.includes("only the") || lower.includes("not allowed") || lower.includes("another student")) return 403;
  if (lower.includes("already") || lower.includes("limit") || lower.includes("active games") || lower.includes("active academy") || lower.includes("expired") || lower.includes("no longer")) return 409;
  return 400;
}

function rpcError(error: { message?: string } | null, fallback: string): never {
  const message = error?.message || fallback;
  throw new CorrespondenceServerError(message, rpcStatus(message));
}

async function partyDisplay(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return { parties: new Map<string, CorrespondenceParty>() };
  const [studentResult, avatarDisplay] = await Promise.all([
    serviceClient()
      .from("students")
      .select("id,display_name,lichess_username,public_slug")
      .in("id", uniqueIds),
    getStudentAvatarDisplayData(uniqueIds).catch(() => null)
  ]);
  if (studentResult.error) throw new CorrespondenceServerError(studentResult.error.message, 500);
  const parties = new Map<string, CorrespondenceParty>();
  for (const row of (studentResult.data ?? []) as StudentRow[]) {
    parties.set(row.id, {
      id: row.id,
      name: row.display_name || row.lichess_username || "Student",
      ...(row.public_slug ? { slug: row.public_slug } : {}),
      ...(avatarDisplay?.avatars[row.id] ? { avatar: avatarDisplay.avatars[row.id] } : {})
    });
  }
  return { parties };
}

function requiredParty(parties: Map<string, CorrespondenceParty>, id: string) {
  return parties.get(id) ?? { id, name: "Student" };
}

function mapChallenge(row: ChallengeRow, parties: Map<string, CorrespondenceParty>): CorrespondenceChallenge {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    seenAt: row.recipient_seen_at,
    challenger: requiredParty(parties, row.challenger_id),
    recipient: requiredParty(parties, row.recipient_id),
    acceptedGameId: row.accepted_game_id
  };
}

function normalizedLiveRecord(value: unknown): LiveGameRecord {
  const row = value as LiveGameRecord;
  return {
    ...row,
    game_mode: row.game_mode ?? "live",
    days_per_move: row.days_per_move ?? null,
    turn_deadline_at: row.turn_deadline_at ?? null
  };
}

function playerForParty(party: CorrespondenceParty): LiveGamePlayer {
  return { id: party.id, name: party.name, ...(party.avatar ? { avatar: party.avatar } : {}) };
}

function mapGame(game: LiveGameRecord, studentId: string, parties: Map<string, CorrespondenceParty>): LiveGameSummary {
  const viewerColor = livePlayerColor(game, studentId);
  if (!viewerColor) throw new CorrespondenceServerError("You are not a player in this correspondence game.", 403);
  const opponentId = viewerColor === "white" ? game.black_player_id : game.white_player_id;
  return {
    id: game.id,
    challengeCode: game.challenge_code,
    status: game.status,
    gameMode: game.game_mode,
    daysPerMove: game.days_per_move,
    turnDeadlineAt: game.turn_deadline_at,
    viewerColor,
    opponent: opponentId ? playerForParty(requiredParty(parties, opponentId)) : null,
    timeControl: game.time_control,
    activeColor: game.active_color,
    winnerColor: game.winner_color,
    resultReason: game.result_reason,
    matchmaking: game.matchmaking,
    arenaTournamentId: game.arena_tournament_id,
    updatedAt: game.updated_at
  };
}

async function ensureInbox(studentId: string) {
  const { data, error } = await serviceClient().rpc("ensure_student_correspondence_inbox", { p_student_id: studentId });
  if (error) rpcError(error, "The correspondence inbox could not be opened.");
  const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const topic = result.realtimeTopic ?? result.realtime_topic;
  if (typeof topic === "string" && topic) return topic;
  const token = result.realtimeToken ?? result.realtime_token;
  if (typeof token !== "string" || !token) throw new CorrespondenceServerError("The correspondence inbox is unavailable.", 500);
  return `student-correspondence:${studentId}:${token}`;
}

async function loadChallengeRow(challengeId: string) {
  const { data, error } = await serviceClient()
    .from("student_correspondence_challenges")
    .select("id,challenger_id,recipient_id,status,expires_at,recipient_seen_at,accepted_game_id,created_at")
    .eq("id", validCorrespondenceId(challengeId, "challenge ID"))
    .maybeSingle();
  if (error) throw new CorrespondenceServerError(error.message, 500);
  if (!data) throw new CorrespondenceServerError("Correspondence challenge not found.", 404);
  return data as ChallengeRow;
}

async function detailedChallenge(challengeId: string) {
  const row = await loadChallengeRow(challengeId);
  const { parties } = await partyDisplay([row.challenger_id, row.recipient_id]);
  return mapChallenge(row, parties);
}

export async function getCorrespondenceInbox(studentId: string): Promise<CorrespondenceInbox> {
  const id = validCorrespondenceId(studentId, "student ID");
  const expiryResult = await serviceClient().rpc("expire_student_correspondence_challenges", { p_student_id: id });
  if (expiryResult.error) throw new CorrespondenceServerError(expiryResult.error.message, 500);
  await settleCorrespondenceDeadlines({ studentId: id });
  await persistRecentCorrespondenceCompletions(id);

  const [topic, challengeResult, gameResult] = await Promise.all([
    ensureInbox(id),
    serviceClient()
      .from("student_correspondence_challenges")
      .select("id,challenger_id,recipient_id,status,expires_at,recipient_seen_at,accepted_game_id,created_at")
      .or(`challenger_id.eq.${id},recipient_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(100),
    serviceClient()
      .from("live_chess_games")
      .select("*")
      .eq("game_mode", "correspondence")
      .eq("status", "active")
      .or(`white_player_id.eq.${id},black_player_id.eq.${id}`)
      .order("updated_at", { ascending: false })
      .limit(10)
  ]);
  if (challengeResult.error) throw new CorrespondenceServerError(challengeResult.error.message, 500);
  if (gameResult.error) throw new CorrespondenceServerError(gameResult.error.message, 500);

  const challenges = (challengeResult.data ?? []) as ChallengeRow[];
  const games = (gameResult.data ?? []).map(normalizedLiveRecord);
  const partyIds = challenges.flatMap((challenge) => [challenge.challenger_id, challenge.recipient_id]);
  partyIds.push(...games.flatMap((game) => [game.white_player_id, game.black_player_id].filter((value): value is string => Boolean(value))));
  const { parties } = await partyDisplay(partyIds);
  const incoming = challenges.filter((challenge) => challenge.recipient_id === id).map((challenge) => mapChallenge(challenge, parties));
  const outgoing = challenges.filter((challenge) => challenge.challenger_id === id).map((challenge) => mapChallenge(challenge, parties));
  return {
    incoming,
    outgoing,
    activeGames: games.map((game) => mapGame(game, id, parties)),
    unreadCount: challenges.filter((challenge) => challenge.recipient_id === id && challenge.status === "pending" && !challenge.recipient_seen_at).length,
    realtimeTopic: topic
  };
}

export async function createCorrespondenceChallenge(studentId: string, input: unknown) {
  const challengerId = validCorrespondenceId(studentId, "student ID");
  const { recipientStudentId } = parseCorrespondenceChallengeInput(input);
  if (challengerId === recipientStudentId) throw new CorrespondenceServerError("Choose another student to challenge.");
  await Promise.all([
    settleCorrespondenceDeadlines({ studentId: challengerId }),
    settleCorrespondenceDeadlines({ studentId: recipientStudentId })
  ]);
  const { data, error } = await serviceClient().rpc("create_student_correspondence_challenge", {
    p_challenger_id: challengerId,
    p_recipient_id: recipientStudentId
  });
  if (error) rpcError(error, "The correspondence challenge could not be sent.");
  const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const challengeId = validCorrespondenceId(result.challengeId ?? result.challenge_id, "challenge ID");
  return detailedChallenge(challengeId);
}

export async function performCorrespondenceChallengeAction(studentId: string, challengeId: string, input: unknown) {
  const actorId = validCorrespondenceId(studentId, "student ID");
  const id = validCorrespondenceId(challengeId, "challenge ID");
  const action = parseCorrespondenceAction(input);
  const existing = await loadChallengeRow(id);
  const expectedActor = action === "cancel" ? existing.challenger_id : existing.recipient_id;
  if (actorId !== expectedActor) {
    throw new CorrespondenceServerError(
      action === "cancel" ? "Only the challenger can cancel this challenge." : "Only the challenge recipient can respond.",
      403
    );
  }
  await Promise.all([
    settleCorrespondenceDeadlines({ studentId: existing.challenger_id }),
    settleCorrespondenceDeadlines({ studentId: existing.recipient_id })
  ]);
  const operation = action === "cancel"
    ? serviceClient().rpc("cancel_student_correspondence_challenge", { p_challenge_id: id, p_challenger_id: actorId })
    : serviceClient().rpc("respond_student_correspondence_challenge", { p_challenge_id: id, p_recipient_id: actorId, p_action: action });
  const { data, error } = await operation;
  if (error) rpcError(error, "The correspondence challenge could not be updated.");
  const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const gameId = result.gameId ?? result.game_id;
  const challenge = await detailedChallenge(id);
  if (challenge.status === "expired") {
    throw new CorrespondenceServerError("This challenge expired before it was answered.", 409);
  }
  return {
    challenge,
    gameId: typeof gameId === "string" && UUID_PATTERN.test(gameId) ? gameId : null
  };
}

export async function markCorrespondenceChallengesSeen(studentId: string, input: unknown) {
  const recipientId = validCorrespondenceId(studentId, "student ID");
  const challengeIds = parseCorrespondenceSeenInput(input);
  const { data, error } = await serviceClient().rpc("mark_student_correspondence_challenges_seen", {
    p_recipient_id: recipientId,
    p_challenge_ids: challengeIds
  });
  if (error) rpcError(error, "Correspondence challenges could not be marked as seen.");
  const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const markedSeen = Number(result.markedSeen ?? result.marked_seen ?? 0);
  return { markedSeen: Number.isSafeInteger(markedSeen) && markedSeen >= 0 ? markedSeen : 0 };
}
