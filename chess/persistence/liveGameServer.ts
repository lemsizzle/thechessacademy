import "server-only";

import { Chess } from "chess.js";
import { TIME_CONTROLS, oppositeColor, resolvePlayerColor } from "@/chess/game/config";
import { liveClockAt, livePlayerColor, replayLiveMoves, timeoutCompletion, applyLiveMove, LiveGameRuleError, type LiveGameCompletion } from "@/chess/live/rules";
import { cleanChallengeCode, generateChallengeCode, isSupportedChallengeCode, MAX_CHALLENGE_CODE_ATTEMPTS } from "@/chess/live/challengeCode";
import type { LiveGameAction, LiveGamePlayer, LiveGameRecord, LiveGameSnapshot, LiveGameSummary, LiveMoveInput, TeacherLiveGameSnapshot, TeacherLiveGameSummary } from "@/chess/live/types";
import type { ChessColor, GameResult, PlayerColorChoice } from "@/chess/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { applyRatingForCompletedGame } from "@/chess/persistence/ratingServer";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_CHALLENGE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class LiveGameServerError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function serviceClient() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new LiveGameServerError("Live game storage is not configured.", 503);
  return supabase;
}

function normalizeRecord(value: unknown) {
  return value as LiveGameRecord;
}

function cleanGameId(value: string) {
  if (!UUID_PATTERN.test(value)) throw new LiveGameServerError("Invalid live game ID.");
  return value;
}

function internalChallengeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (value) => LEGACY_CHALLENGE_ALPHABET[value % LEGACY_CHALLENGE_ALPHABET.length]).join("");
}

function normalizedChallengeCode(value: unknown) {
  const code = cleanChallengeCode(value);
  if (!isSupportedChallengeCode(code)) throw new LiveGameServerError("Enter the 4-character challenge code.");
  return code;
}

function normalizedColorChoice(value: unknown): PlayerColorChoice {
  if (value === "white" || value === "black" || value === "random") return value;
  throw new LiveGameServerError("Choose white, black, or random.");
}

function normalizedVersion(value: unknown) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) throw new LiveGameServerError("Invalid game version.");
  return version;
}

async function loadRecord(gameId: string) {
  const { data, error } = await serviceClient().from("live_chess_games").select("*").eq("id", cleanGameId(gameId)).maybeSingle();
  if (error) throw new LiveGameServerError(error.message, 500);
  if (!data) throw new LiveGameServerError("Live game not found.", 404);
  return normalizeRecord(data);
}

async function playerMap(ids: Array<string | null>) {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const players = new Map<string, LiveGamePlayer>();
  if (!uniqueIds.length) return players;
  const studentResult = await serviceClient().from("students").select("id,display_name,lichess_username").in("id", uniqueIds);
  if (studentResult.error) throw new LiveGameServerError(studentResult.error.message, 500);
  for (const row of (studentResult.data ?? []) as Array<{ id: string; display_name: string; lichess_username: string | null }>) {
    players.set(row.id, { id: row.id, name: row.display_name || row.lichess_username || "Student" });
  }
  return players;
}

function assertParticipant(game: LiveGameRecord, studentId: string) {
  const color = livePlayerColor(game, studentId);
  if (!color) throw new LiveGameServerError("You are not a player in this game.", 403);
  return color;
}

async function snapshotFor(game: LiveGameRecord, studentId: string): Promise<LiveGameSnapshot> {
  const viewerColor = assertParticipant(game, studentId);
  const players = await playerMap([game.white_player_id, game.black_player_id]);
  return {
    id: game.id,
    challengeCode: game.challenge_code,
    status: game.status,
    version: game.version,
    realtimeTopic: `live-game:${game.id}:${game.realtime_token}`,
    viewer: { id: studentId, color: viewerColor },
    players: {
      white: game.white_player_id ? players.get(game.white_player_id) ?? { id: game.white_player_id, name: "Student" } : null,
      black: game.black_player_id ? players.get(game.black_player_id) ?? { id: game.black_player_id, name: "Student" } : null
    },
    timeControl: game.time_control,
    initialFen: game.initial_fen,
    fen: game.current_fen,
    moves: game.moves,
    activeColor: game.active_color,
    clocks: {
      whiteMs: game.white_ms,
      blackMs: game.black_ms,
      startedAt: game.clock_started_at
    },
    drawOfferedBy: game.draw_offered_by,
    winnerColor: game.winner_color,
    resultReason: game.result_reason,
    startedAt: game.started_at,
    completedAt: game.completed_at,
    matchmaking: game.matchmaking,
    rematchRequestedBy: game.rematch_requested_by,
    rematchGameId: game.rematch_game_id,
    rematchOfGameId: game.rematch_of_game_id,
    serverNow: new Date().toISOString()
  };
}

function requiredPlayer(players: Map<string, LiveGamePlayer>, playerId: string | null) {
  if (!playerId) throw new LiveGameServerError("This live game does not have both players.", 409);
  return players.get(playerId) ?? { id: playerId, name: "Student" };
}

async function teacherSnapshotFor(game: LiveGameRecord): Promise<TeacherLiveGameSnapshot> {
  if (!game.started_at) throw new LiveGameServerError("This live game has not started.", 409);
  const players = await playerMap([game.white_player_id, game.black_player_id]);
  return {
    id: game.id,
    status: game.status,
    version: game.version,
    realtimeTopic: `live-game:${game.id}:${game.realtime_token}`,
    players: {
      white: requiredPlayer(players, game.white_player_id),
      black: requiredPlayer(players, game.black_player_id)
    },
    timeControl: game.time_control,
    initialFen: game.initial_fen,
    fen: game.current_fen,
    moves: game.moves,
    activeColor: game.active_color,
    clocks: {
      whiteMs: game.white_ms,
      blackMs: game.black_ms,
      startedAt: game.clock_started_at
    },
    winnerColor: game.winner_color,
    resultReason: game.result_reason,
    startedAt: game.started_at,
    completedAt: game.completed_at,
    rated: game.rated,
    matchmaking: game.matchmaking,
    updatedAt: game.updated_at,
    serverNow: new Date().toISOString()
  };
}

async function pgnFor(game: LiveGameRecord, completion: LiveGameCompletion, completedAt: string) {
  const chess = replayLiveMoves(game.initial_fen, game.moves);
  const players = await playerMap([game.white_player_id, game.black_player_id]);
  const whiteName = game.white_player_id ? players.get(game.white_player_id)?.name ?? "Student" : "Student";
  const blackName = game.black_player_id ? players.get(game.black_player_id)?.name ?? "Student" : "Student";
  const result = completion.winnerColor === "white" ? "1-0" : completion.winnerColor === "black" ? "0-1" : "1/2-1/2";
  chess.header(
    "Event", "Chess Academy Live Game",
    "Site", "The Chess Academy",
    "Date", completedAt.slice(0, 10).replaceAll("-", "."),
    "White", whiteName,
    "Black", blackName,
    "Result", result,
    "Termination", completion.reason.replaceAll("_", " ")
  );
  return chess.pgn({ maxWidth: 80, newline: "\n" });
}

function perspectiveResult(winnerColor: ChessColor | null, playerColor: ChessColor): GameResult {
  if (!winnerColor) return "draw";
  return winnerColor === playerColor ? "win" : "loss";
}

async function persistCompletedPlayers(game: LiveGameRecord) {
  if (game.status !== "completed" || !game.completed_at || !game.started_at || !game.result_reason || !game.white_player_id || !game.black_player_id) return;
  const players = await playerMap([game.white_player_id, game.black_player_id]);
  const entries = [
    { playerId: game.white_player_id, playerColor: "white" as const, opponentId: game.black_player_id, opponentName: players.get(game.black_player_id)?.name ?? "Student" },
    { playerId: game.black_player_id, playerColor: "black" as const, opponentId: game.white_player_id, opponentName: players.get(game.white_player_id)?.name ?? "Student" }
  ];
  const { data: existing, error: existingError } = await serviceClient()
    .from("internal_chess_games")
    .select("player_id")
    .eq("source_live_game_id", game.id)
    .in("player_id", entries.map((entry) => entry.playerId));
  if (existingError) throw new LiveGameServerError(existingError.message, 500);
  const existingIds = new Set((existing ?? []).map((row) => String(row.player_id)));
  const missing = entries.filter((entry) => !existingIds.has(entry.playerId)).map((entry) => ({
      player_id: entry.playerId,
      opponent_type: "student",
      opponent_id: entry.opponentId,
      opponent_name: entry.opponentName,
      player_color: entry.playerColor,
      result: perspectiveResult(game.winner_color, entry.playerColor),
      result_reason: game.result_reason,
      winner_color: game.winner_color,
      time_control: game.time_control,
      initial_fen: game.initial_fen,
      final_fen: game.current_fen,
      pgn: game.pgn,
      moves: game.moves,
      started_at: game.started_at,
      completed_at: game.completed_at,
      source_live_game_id: game.id
  }));
  if (!missing.length) return;
  const { error } = await serviceClient().from("internal_chess_games").insert(missing);
  if (error && error.code !== "23505") throw new LiveGameServerError(error.message, 500);
}

async function persistCompletedOutputs(game: LiveGameRecord) {
  await persistCompletedPlayers(game);
  if (game.rated) await applyRatingForCompletedGame(game.id);
}

async function updateWithVersion(game: LiveGameRecord, update: Record<string, unknown>) {
  const { data, error } = await serviceClient()
    .from("live_chess_games")
    .update(update)
    .eq("id", game.id)
    .eq("version", game.version)
    .select("*")
    .maybeSingle();
  if (error) throw new LiveGameServerError(error.message, 500);
  if (!data) throw new LiveGameServerError("The game changed. Refresh and try again.", 409);
  return normalizeRecord(data);
}

export async function createLiveGame(studentId: string, input: unknown) {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const control = TIME_CONTROLS.find((item) => item.id === String(body.timeControlId ?? ""));
  if (!control) throw new LiveGameServerError("Choose a valid time control.");
  const creatorColor = resolvePlayerColor(normalizedColorChoice(body.color));
  const rated = control.initialMs !== null;
  const initialFen = new Chess().fen();
  for (let attempt = 0; attempt < MAX_CHALLENGE_CODE_ATTEMPTS; attempt += 1) {
    const { data, error } = await serviceClient().from("live_chess_games").insert({
      challenge_code: generateChallengeCode(),
      created_by: studentId,
      white_player_id: creatorColor === "white" ? studentId : null,
      black_player_id: creatorColor === "black" ? studentId : null,
      status: "waiting",
      time_control_id: control.id,
      time_control: control,
      initial_fen: initialFen,
      current_fen: initialFen,
      active_color: "white",
      white_ms: control.initialMs,
      black_ms: control.initialMs,
      rated
    }).select("*").maybeSingle();
    if (!error && data) return snapshotFor(normalizeRecord(data), studentId);
    if (error?.code !== "23505") throw new LiveGameServerError(error?.message ?? "Challenge could not be created.", 500);
  }
  throw new LiveGameServerError("A unique challenge code could not be created. Try again.", 500);
}

export async function joinLiveGame(studentId: string, input: unknown) {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const code = normalizedChallengeCode(body.code);
  const { data, error } = await serviceClient().from("live_chess_games").select("*").eq("challenge_code", code).maybeSingle();
  if (error) throw new LiveGameServerError(error.message, 500);
  if (!data) throw new LiveGameServerError("Challenge not found.", 404);
  const game = normalizeRecord(data);
  if (game.status !== "waiting") throw new LiveGameServerError("This challenge is no longer waiting for a player.", 409);
  if (game.created_by === studentId) throw new LiveGameServerError("Share this code with another student—you cannot join your own challenge.");
  const openColumn = game.white_player_id ? "black_player_id" : "white_player_id";
  const now = new Date().toISOString();
  const joined = await updateWithVersion(game, {
    [openColumn]: studentId,
    status: "active",
    started_at: now,
    clock_started_at: game.time_control.initialMs === null ? null : now,
    version: game.version + 1
  });
  return snapshotFor(joined, studentId);
}

export async function getLiveGame(studentId: string, gameId: string) {
  const game = await loadRecord(gameId);
  if (game.status === "completed") await persistCompletedOutputs(game);
  return snapshotFor(await loadRecord(gameId), studentId);
}

export async function listLiveGames(studentId: string): Promise<LiveGameSummary[]> {
  const { data, error } = await serviceClient()
    .from("live_chess_games")
    .select("*")
    .or(`white_player_id.eq.${studentId},black_player_id.eq.${studentId}`)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw new LiveGameServerError(error.message, 500);
  const games = (data ?? []).map(normalizeRecord);
  const players = await playerMap(games.flatMap((game) => [game.white_player_id, game.black_player_id]));
  return games.map((game) => {
    const viewerColor = assertParticipant(game, studentId);
    const opponentId = viewerColor === "white" ? game.black_player_id : game.white_player_id;
    return {
      id: game.id,
      challengeCode: game.challenge_code,
      status: game.status,
      viewerColor,
      opponent: opponentId ? players.get(opponentId) ?? { id: opponentId, name: "Student" } : null,
      timeControl: game.time_control,
      activeColor: game.active_color,
      winnerColor: game.winner_color,
      resultReason: game.result_reason,
      matchmaking: game.matchmaking,
      updatedAt: game.updated_at
    };
  });
}

export async function listTeacherLiveGames(): Promise<TeacherLiveGameSummary[]> {
  const { data, error } = await serviceClient()
    .from("live_chess_games")
    .select("*")
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  if (error) throw new LiveGameServerError(error.message, 500);
  const games = (data ?? []).map(normalizeRecord);
  const players = await playerMap(games.flatMap((game) => [game.white_player_id, game.black_player_id]));
  return games.flatMap((game) => game.started_at ? [{
    id: game.id,
    players: {
      white: requiredPlayer(players, game.white_player_id),
      black: requiredPlayer(players, game.black_player_id)
    },
    timeControl: game.time_control,
    activeColor: game.active_color,
    moveCount: Math.ceil(game.moves.length / 2),
    rated: game.rated,
    matchmaking: game.matchmaking,
    startedAt: game.started_at,
    updatedAt: game.updated_at
  }] : []);
}

export async function getTeacherLiveGame(gameId: string) {
  const game = await loadRecord(gameId);
  if (game.status === "waiting" || game.status === "cancelled") throw new LiveGameServerError("This game is not available to watch.", 404);
  return teacherSnapshotFor(game);
}

export async function submitLiveMove(studentId: string, gameId: string, input: unknown) {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const moveInput: LiveMoveInput = {
    from: String(body.from ?? ""),
    to: String(body.to ?? ""),
    promotion: body.promotion === undefined ? undefined : String(body.promotion) as LiveMoveInput["promotion"],
    version: normalizedVersion(body.version)
  };
  if (!/^[a-h][1-8]$/.test(moveInput.from) || !/^[a-h][1-8]$/.test(moveInput.to)) throw new LiveGameServerError("Invalid move coordinates.");
  if (moveInput.promotion && !["q", "r", "b", "n"].includes(moveInput.promotion)) throw new LiveGameServerError("Invalid promotion piece.");
  const game = await loadRecord(gameId);
  let applied;
  try {
    applied = applyLiveMove(game, studentId, moveInput, Date.now());
  } catch (error) {
    if (error instanceof LiveGameRuleError) throw new LiveGameServerError(error.message, error.message.includes("changed") ? 409 : 400);
    throw error;
  }
  if (applied.completion) {
    const completedAt = applied.update.completed_at as string;
    const finalGame = { ...game, ...applied.update } as LiveGameRecord;
    const pgn = await pgnFor(finalGame, applied.completion, completedAt);
    const updated = await updateWithVersion(game, { ...applied.update, pgn });
    await persistCompletedOutputs(updated);
    return snapshotFor(await loadRecord(updated.id), studentId);
  }
  const updated = await updateWithVersion(game, applied.update);
  return snapshotFor(updated, studentId);
}

function completedClockUpdate(game: LiveGameRecord, nowMs: number) {
  const clock = liveClockAt(game, nowMs);
  return {
    white_ms: clock?.whiteMs ?? game.white_ms,
    black_ms: clock?.blackMs ?? game.black_ms,
    clock_started_at: null
  };
}

async function completeByAction(game: LiveGameRecord, completion: LiveGameCompletion, nowMs: number) {
  const completedAt = new Date(nowMs).toISOString();
  const baseUpdate = {
    ...completedClockUpdate(game, nowMs),
    status: "completed" as const,
    winner_color: completion.winnerColor,
    result_reason: completion.reason,
    draw_offered_by: null,
    completed_at: completedAt,
    version: game.version + 1
  };
  const finalGame = { ...game, ...baseUpdate } as LiveGameRecord;
  const pgn = await pgnFor(finalGame, completion, completedAt);
  const updated = await updateWithVersion(game, { ...baseUpdate, pgn });
  await persistCompletedOutputs(updated);
  return loadRecord(updated.id);
}

export async function performLiveGameAction(studentId: string, gameId: string, input: unknown) {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const action = String(body.action ?? "") as LiveGameAction;
  const version = normalizedVersion(body.version);
  if (!["cancel", "resign", "offer_draw", "accept_draw", "decline_draw", "claim_timeout"].includes(action)) {
    throw new LiveGameServerError("Invalid live game action.");
  }
  const game = await loadRecord(gameId);
  if (version !== game.version) throw new LiveGameServerError("The game changed. Refresh and try again.", 409);
  const playerColor = assertParticipant(game, studentId);
  const nowMs = Date.now();

  if (action === "cancel") {
    if (game.status !== "waiting" || game.created_by !== studentId) throw new LiveGameServerError("Only the challenge creator can cancel a waiting game.", 403);
    const updated = await updateWithVersion(game, { status: "cancelled", completed_at: new Date(nowMs).toISOString(), version: game.version + 1 });
    return snapshotFor(updated, studentId);
  }
  if (game.status !== "active") throw new LiveGameServerError("This game is not active.", 409);

  let updated: LiveGameRecord;
  if (action === "resign") {
    updated = await completeByAction(game, { winnerColor: oppositeColor(playerColor), reason: "resignation" }, nowMs);
  } else if (action === "claim_timeout") {
    const completion = timeoutCompletion(game, nowMs);
    if (!completion) throw new LiveGameServerError("Neither clock has expired.");
    updated = await completeByAction(game, completion, nowMs);
  } else if (action === "offer_draw") {
    if (game.draw_offered_by && game.draw_offered_by !== studentId) throw new LiveGameServerError("Your opponent already offered a draw. Accept or decline it.");
    updated = await updateWithVersion(game, { draw_offered_by: studentId, version: game.version + 1 });
  } else if (action === "accept_draw") {
    if (!game.draw_offered_by || game.draw_offered_by === studentId) throw new LiveGameServerError("There is no opponent draw offer to accept.");
    updated = await completeByAction(game, { winnerColor: null, reason: "draw" }, nowMs);
  } else {
    if (!game.draw_offered_by || game.draw_offered_by === studentId) throw new LiveGameServerError("There is no opponent draw offer to decline.");
    updated = await updateWithVersion(game, { draw_offered_by: null, version: game.version + 1 });
  }
  return snapshotFor(updated, studentId);
}

export async function requestLiveGameRematch(studentId: string, gameId: string) {
  cleanGameId(gameId);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await serviceClient().rpc("request_live_chess_rematch", {
      p_game_id: gameId,
      p_student_id: studentId,
      p_challenge_code: internalChallengeCode()
    });
    if (!error) {
      const result = data as { status: "waiting" | "matched"; gameId: string | null };
      return {
        status: result.status,
        gameId: result.gameId,
        game: result.gameId ? await getLiveGame(studentId, result.gameId) : null,
        source: await getLiveGame(studentId, gameId)
      };
    }
    if (error.code !== "23505") throw new LiveGameServerError(error.message, 500);
  }
  throw new LiveGameServerError("A rematch could not be created. Try again.", 500);
}
