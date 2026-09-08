import "server-only";
import { after } from "next/server";

import { Chess } from "chess.js";
import { currentArenaStatus, rankArenaStandings } from "@/chess/arena/scoring";
import { parseArenaBotInput, type ArenaBot } from "@/chess/arena/bots";
import type { ArenaPrize, ArenaQueueState, CreateInternalArenaInput, InternalArena, InternalArenaChatMessage, InternalArenaEntryStatus, InternalArenaLobby, InternalArenaMatchmaking, InternalArenaPairing, InternalArenaStanding, InternalArenaStatus } from "@/chess/arena/types";
import { TIME_CONTROLS } from "@/chess/game/timeControls";
import { generateChallengeCode, MAX_CHALLENGE_CODE_ATTEMPTS } from "@/chess/live/challengeCode";
import type { TimeControl } from "@/chess/types";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { AvatarItem, StudentAvatarConfig } from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ArenaRow = {
  experience_version?: number;
  pairings_paused?: boolean;
  id: string;
  name: string;
  description: string;
  status: InternalArenaStatus;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  time_control_id: string;
  time_control: TimeControl;
  rated: boolean;
  class_group: string | null;
  created_at: string;
  updated_at: string;
};

type EntryRow = {
  queue_entered_at?: string | null;
  last_seen_at?: string | null;
  queue_enabled?: boolean;
  tournament_id: string;
  student_id: string | null;
  bot_id: string | null;
  status: InternalArenaEntryStatus;
  score: number;
  games_played: number;
  wins: number;
  draws: number;
  losses: number;
  current_game_id: string | null;
};

type StudentRow = { id: string; display_name: string; lichess_username: string | null; class_group: string | null };

type PairingRow = {
  id: string;
  game_id: string;
  white_student_id: string | null;
  black_student_id: string | null;
  bot_id: string | null;
  bot_color: "white" | "black" | null;
  bot_name: string | null;
  opponent_bot_id: string | null;
  opponent_bot_name: string | null;
  status: "active" | "completed";
  result: "white_win" | "black_win" | "draw" | null;
  white_points: number;
  black_points: number;
  started_at: string;
  completed_at: string | null;
};

type ChatRow = {
  id: string;
  student_id: string | null;
  sender_role: "student" | "teacher";
  sender_name: string;
  message: string;
  created_at: string;
};

export class InternalArenaServerError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function client() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new InternalArenaServerError("Internal Arena storage is not configured.", 503);
  return supabase;
}

function validId(value: string, label = "Arena") {
  if (!UUID_PATTERN.test(value)) throw new InternalArenaServerError(`Invalid ${label.toLowerCase()} ID.`);
  return value;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanChatMessage(value: unknown) {
  const message = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!message) throw new InternalArenaServerError("Write a message first.");
  if (message.length > 280) throw new InternalArenaServerError("Arena chat messages can be up to 280 characters.");
  return message;
}

function mapMatchmaking(value: unknown): InternalArenaMatchmaking {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const status = row.status === "matched" ? "matched" : row.status === "waiting" ? "waiting" : "joined";
  return { status, gameId: row.gameId ? String(row.gameId) : null };
}

async function refreshArenaStatuses() {
  const now = new Date().toISOString();
  const activate = await client().from("internal_arena_tournaments").update({ status: "active" }).eq("status", "scheduled").lte("starts_at", now).gt("ends_at", now);
  if (activate.error) throw new InternalArenaServerError(activate.error.message, 500);
  const finish = await client().from("internal_arena_tournaments").update({ status: "finished" }).in("status", ["scheduled", "active"]).lte("ends_at", now).select("id");
  if (finish.error) throw new InternalArenaServerError(finish.error.message, 500);
  const finishedIds = (finish.data ?? []).map((row) => String(row.id));
  if (finishedIds.length) {
    const entries = await client().from("internal_arena_entries").update({ status: "finished" }).in("tournament_id", finishedIds).in("status", ["joined", "waiting"]);
    if (entries.error) throw new InternalArenaServerError(entries.error.message, 500);
    await Promise.all(finishedIds.map(settleInternalArena));
  }
}

async function loadArenaRows() {
  await refreshArenaStatuses();
  const { data, error } = await client().from("internal_arena_tournaments").select("*").order("starts_at", { ascending: false }).limit(50);
  if (error) throw new InternalArenaServerError(error.message, 500);
  return (data ?? []) as ArenaRow[];
}

async function loadArenaRow(tournamentId: string) {
  const id = validId(tournamentId);
  await refreshArenaStatuses();
  const { data, error } = await client().from("internal_arena_tournaments").select("*").eq("id", id).maybeSingle();
  if (error) throw new InternalArenaServerError(error.message, 500);
  if (!data) throw new InternalArenaServerError("Arena tournament not found.", 404);
  return data as ArenaRow;
}

async function mapArenas(rows: ArenaRow[], viewerStudentId?: string): Promise<InternalArena[]> {
  if (!rows.length) return [];
  const tournamentIds = rows.map((row) => row.id);
  const entryResult = await client().from("internal_arena_entries").select("tournament_id,student_id,bot_id,status,score,games_played,wins,draws,losses,current_game_id,queue_entered_at,last_seen_at,queue_enabled").in("tournament_id", tournamentIds);
  if (entryResult.error) throw new InternalArenaServerError(entryResult.error.message, 500);
  const entries = (entryResult.data ?? []) as EntryRow[];
  const studentIds = [...new Set(entries.flatMap((entry) => entry.student_id ? [entry.student_id] : []))];
  const bots = new Map<string, ArenaBot>();
  if (entries.some((entry) => entry.bot_id)) {
    const result = await client().from("internal_arena_bots").select("id,name,difficulty_id,removed_at").in("tournament_id", tournamentIds);
    if (result.error) throw new InternalArenaServerError(result.error.message, 500);
    for (const bot of result.data ?? []) bots.set(bot.id, { id: bot.id, name: bot.name, difficultyId: bot.difficulty_id, removed: Boolean(bot.removed_at) });
  }
  const students = new Map<string, StudentRow>();
  if (studentIds.length) {
    const studentResult = await client().from("students").select("id,display_name,lichess_username,class_group").in("id", studentIds);
    if (studentResult.error) throw new InternalArenaServerError(studentResult.error.message, 500);
    for (const student of (studentResult.data ?? []) as StudentRow[]) students.set(student.id, student);
  }

  const policyIds = rows.filter(row => row.experience_version === 1).map(row => row.id);
  const ranks = new Map<string, ArenaPrize[]>();
  const finals = new Map<string, NonNullable<InternalArena["finalResults"]>>();
  if (policyIds.length) {
    const [rankingResult, finalResult] = await Promise.all([
      client().rpc("arena_rankings", { p_tournament_ids: policyIds }),
      client().from("internal_arena_results").select("tournament_id,standings,settled_at").in("tournament_id", policyIds)
    ]);
    if (rankingResult.error || finalResult.error) throw new InternalArenaServerError(rankingResult.error?.message || finalResult.error?.message || "Standings unavailable.", 500);
    for (const [id, rank] of Object.entries(rankingResult.data ?? {})) ranks.set(id, rank as ArenaPrize[]);
    for (const row of finalResult.data ?? []) finals.set(row.tournament_id, { standings: row.standings as ArenaPrize[], settledAt: row.settled_at });
  }
  return rows.map((row) => {
    let standings = rankArenaStandings(entries.filter((entry) => entry.tournament_id === row.id).map((entry): Omit<InternalArenaStanding, "rank"> => ({
      studentId: entry.student_id ?? entry.bot_id!,
      name: entry.bot_id ? bots.get(entry.bot_id)?.name ?? "Computer player" : students.get(entry.student_id!)?.display_name || students.get(entry.student_id!)?.lichess_username || "Student",
      bot: entry.bot_id ? bots.get(entry.bot_id) : undefined,
      status: entry.status,
      score: entry.score,
      gamesPlayed: entry.games_played,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      queueEnteredAt: entry.queue_entered_at,
      queueEnabled: entry.queue_enabled,
      lastSeenAt: entry.last_seen_at,
      currentGameId: entry.current_game_id
    })));
    if (row.experience_version === 1) {
      const byId = new Map((ranks.get(row.id) ?? []).map(prize => [prize.studentId, prize]));
      standings = standings.map(entry => entry.bot ? { ...entry, rank: 0 } : { ...entry, rank: byId.get(entry.studentId)?.rank ?? 0, ...byId.get(entry.studentId) })
        .sort((a, b) => Number(Boolean(a.bot)) - Number(Boolean(b.bot)) || (a.rank || Infinity) - (b.rank || Infinity));
    }
    return {
      experienceVersion: row.experience_version ?? 0,
      finalResults: finals.get(row.id) ?? null,
      id: row.id,
      name: row.name,
      description: row.description,
      pairingsPaused: Boolean(row.pairings_paused),
      status: currentArenaStatus(row.status, row.starts_at, row.ends_at),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      durationMinutes: row.duration_minutes,
      timeControlId: row.time_control_id,
      timeControl: row.time_control,
      rated: row.rated,
      classGroup: row.class_group,
      standings,
      entry: viewerStudentId ? standings.find((entry) => entry.studentId === viewerStudentId) ?? null : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } satisfies InternalArena;
  });
}

async function buildInternalArenaLobby(row: ArenaRow, viewerStudentId?: string, canChat = true): Promise<InternalArenaLobby> {
  const arena = (await mapArenas([row], viewerStudentId))[0];
  const studentIds = arena.standings.filter((entry) => !entry.bot).map((entry) => entry.studentId);
  const pairingColumns = "id,game_id,white_student_id,black_student_id,bot_id,bot_color,bot_name,opponent_bot_id,opponent_bot_name,status,result,white_points,black_points,started_at,completed_at";
  const [activePairings, recentPairings, chatResult, avatarDisplay] = await Promise.all([
    client()
      .from("internal_arena_pairings")
      .select(pairingColumns)
      .eq("tournament_id", row.id)
      .eq("status", "active")
      .order("started_at", { ascending: false }),
    client()
      .from("internal_arena_pairings")
      .select(pairingColumns)
      .eq("tournament_id", row.id)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(60),
    client()
      .from("internal_arena_chat_messages")
      .select("id,student_id,sender_role,sender_name,message,created_at")
      .eq("tournament_id", row.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(80),
    getStudentAvatarDisplayData(studentIds).catch((): { items: AvatarItem[]; avatars: Record<string, StudentAvatarConfig> } => ({ items: [], avatars: {} }))
  ]);
  if (activePairings.error || recentPairings.error) throw new InternalArenaServerError(activePairings.error?.message || recentPairings.error?.message || "Games unavailable.", 500);
  // Long-running boards must not disappear when many newer games have finished.
  const pairingRows = [...(activePairings.data ?? []), ...(recentPairings.data ?? [])] as PairingRow[];
  if (chatResult.error) throw new InternalArenaServerError(chatResult.error.message, 500);

  const names = new Map(arena.standings.map((entry) => [entry.studentId, entry.name]));
  const equippedItemIds = new Set<string>();
  const standings = arena.standings.map((entry) => {
    const avatar = avatarDisplay.avatars[entry.studentId];
    for (const itemId of Object.values(avatar?.equippedItems ?? {})) {
      if (itemId) equippedItemIds.add(itemId);
    }
    return avatar ? { ...entry, avatar } : entry;
  });
  const liveIds = pairingRows.filter(p => p.status === "active").map(p => p.game_id);
  const boards = new Map<string, NonNullable<InternalArenaPairing["board"]>>();
  if (liveIds.length) {
    const result = await client().from("live_chess_games").select("id,current_fen,white_ms,black_ms,active_color,clock_started_at").in("id", liveIds);
    if (result.error) throw new InternalArenaServerError(result.error.message, 500);
    for (const game of result.data ?? []) boards.set(game.id, { fen: game.current_fen, whiteMs: game.white_ms, blackMs: game.black_ms, activeColor: game.active_color, clockStartedAt: game.clock_started_at });
  }
  const pairings = pairingRows.map((pairing): InternalArenaPairing => ({
    id: pairing.id,
    gameId: pairing.game_id,
    board: boards.get(pairing.game_id),
    status: pairing.status,
    result: pairing.result,
    whiteStudentId: pairing.white_student_id ?? (pairing.bot_color === "white" ? pairing.bot_id! : pairing.opponent_bot_id!),
    whiteName: pairing.white_student_id ? names.get(pairing.white_student_id) ?? "Student" : (pairing.bot_color === "white" ? pairing.bot_name : pairing.opponent_bot_name) ?? "Computer player",
    blackStudentId: pairing.black_student_id ?? (pairing.bot_color === "black" ? pairing.bot_id! : pairing.opponent_bot_id!),
    blackName: pairing.black_student_id ? names.get(pairing.black_student_id) ?? "Student" : (pairing.bot_color === "black" ? pairing.bot_name : pairing.opponent_bot_name) ?? "Computer player",
    whitePoints: pairing.white_points,
    blackPoints: pairing.black_points,
    startedAt: pairing.started_at,
    completedAt: pairing.completed_at
  }));
  scheduleArenaBotActivity(arena);
  const messages = ((chatResult.data ?? []) as ChatRow[]).reverse().map((message): InternalArenaChatMessage => ({
    id: message.id,
    studentId: message.student_id,
    senderRole: message.sender_role,
    senderName: message.sender_name,
    message: message.message,
    createdAt: message.created_at
  }));

  return {
    arena: { ...arena, standings, entry: viewerStudentId ? standings.find((entry) => entry.studentId === viewerStudentId) ?? null : null },
    pairings,
    messages,
    avatarItems: avatarDisplay.items.filter((item) => equippedItemIds.has(item.id)),
    canChat,
    serverTime: new Date().toISOString()
  };
}

export async function listTeacherInternalArenas() {
  const arenas = await mapArenas(await loadArenaRows());
  arenas.forEach(scheduleArenaBotActivity);
  return arenas;
}

export async function listStudentInternalArenas(studentId: string) {
  const id = validId(studentId, "student");
  const [rows, studentResult] = await Promise.all([
    loadArenaRows(),
    client().from("students").select("class_group").eq("id", id).maybeSingle()
  ]);
  if (studentResult.error) throw new InternalArenaServerError(studentResult.error.message, 500);
  const classGroup = studentResult.data?.class_group ? String(studentResult.data.class_group) : null;
  const visible = rows.filter((row) => row.status !== "cancelled" && (!row.class_group || row.class_group === classGroup));
  const arenas = await mapArenas(visible, id);
  arenas.forEach(scheduleArenaBotActivity);
  return arenas;
}

export async function getTeacherInternalArenaLobby(tournamentId: string) {
  const arena = await loadArenaRow(tournamentId);
  return buildInternalArenaLobby(arena, undefined, arena.status !== "cancelled");
}

export async function getStudentInternalArenaLobby(tournamentId: string, studentId: string) {
  const { arena, studentId: sid } = await tournamentAndStudent(tournamentId, studentId);
  const entry = await client().from("internal_arena_entries").select("id").eq("tournament_id", arena.id).eq("student_id", sid).maybeSingle();
  if (entry.error) throw new InternalArenaServerError(entry.error.message, 500);
  return buildInternalArenaLobby(arena, sid, Boolean(entry.data) && arena.status !== "cancelled");
}

export async function hasLiveInternalArena(now = new Date()) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return false;

  const timestamp = now.toISOString();
  const { data, error } = await supabase
    .from("internal_arena_tournaments")
    .select("id")
    .in("status", ["scheduled", "active"])
    .lte("starts_at", timestamp)
    .gt("ends_at", timestamp)
    .limit(1);

  if (error) throw new InternalArenaServerError(error.message, 500);
  return Boolean(data?.length);
}

export async function createInternalArena(input: unknown) {
  const body = input && typeof input === "object" ? input as Partial<CreateInternalArenaInput> : {};
  const name = cleanText(body.name, 100);
  if (!name) throw new InternalArenaServerError("Enter an Arena name.");
  const durationMinutes = Number(body.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 10 || durationMinutes > 240) throw new InternalArenaServerError("Arena duration must be between 10 and 240 minutes.");
  const control = TIME_CONTROLS.find((item) => item.id === body.timeControlId && item.initialMs !== null);
  if (!control) throw new InternalArenaServerError("Choose a timed Arena clock.");
  const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
  if (Number.isNaN(startsAt.getTime())) throw new InternalArenaServerError("Choose a valid Arena start time.");
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const status: InternalArenaStatus = startsAt.getTime() <= Date.now() ? "active" : "scheduled";
  const payload = {
    name,
    description: cleanText(body.description, 500),
    status,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    duration_minutes: durationMinutes,
    time_control_id: control.id,
    time_control: control,
    rated: body.rated === true,
    class_group: cleanText(body.classGroup, 100) || null
  };
  const { data, error } = await client().from("internal_arena_tournaments").insert(payload).select("*").single();
  if (error) throw new InternalArenaServerError(error.message, 500);
  return (await mapArenas([data as ArenaRow]))[0];
}

export async function updateInternalArenaStatus(tournamentId: string, action: unknown) {
  const id = validId(tournamentId);
  const requested = String(action ?? "");
  if (!["start", "finish", "cancel", "pause_pairings", "resume_pairings"].includes(requested)) throw new InternalArenaServerError("Invalid Arena action.");
  const { data: current, error: loadError } = await client().from("internal_arena_tournaments").select("*").eq("id", id).maybeSingle();
  if (loadError) throw new InternalArenaServerError(loadError.message, 500);
  if (!current) throw new InternalArenaServerError("Arena tournament not found.", 404);
  const row = current as ArenaRow;
  const now = new Date();
  if (row.experience_version === 1) {
    const changed = await client().rpc("control_internal_arena", { p_tournament_id: id, p_action: requested });
    if (changed.error) throw new InternalArenaServerError(changed.error.message, 409);
    if (requested === "finish") await settleInternalArena(id);
    if (requested === "resume_pairings" || requested === "start") await dispatchArenaQueue(id);
    return (await mapArenas([changed.data as ArenaRow]))[0];
  }
  if (requested === "pause_pairings" || requested === "resume_pairings") {
    const { data, error } = await client().from("internal_arena_tournaments")
      .update({ pairings_paused: requested === "pause_pairings" }).eq("id", id)
      .in("status", ["scheduled", "active"]).gt("ends_at", now.toISOString()).select("*").maybeSingle();
    if (error) throw new InternalArenaServerError(error.message, 500);
    if (!data) throw new InternalArenaServerError("This Arena is no longer accepting pairing changes.", 409);
    if (requested === "resume_pairings") after(async () => {
      const waiting = await client().from("internal_arena_entries").select("student_id")
        .eq("tournament_id", id).eq("status", "waiting").not("student_id", "is", null).order("updated_at").limit(100);
      if (waiting.error) { console.error("Arena resume queue failed", waiting.error.message); return; }
      for (const entry of waiting.data ?? []) {
        try { await matchInternalArenaStudent(id, entry.student_id); }
        catch (error) { console.error("Arena resume pairing failed", error instanceof Error ? error.message : "Unknown error"); }
      }
      for (let pair = 0; pair < 6; pair += 1) {
        try { if ((await matchArenaBots(id)).status !== "matched") break; }
        catch { break; }
      }
    });
    return (await mapArenas([data as ArenaRow]))[0];
  }
  const update = requested === "start"
    ? { status: "active", starts_at: now.toISOString(), ends_at: new Date(now.getTime() + row.duration_minutes * 60_000).toISOString() }
    : { status: requested === "finish" ? "finished" : "cancelled" };
  const { data, error } = await client().from("internal_arena_tournaments").update(update).eq("id", id).select("*").single();
  if (error) throw new InternalArenaServerError(error.message, 500);
  if (requested !== "start") {
    const entries = await client().from("internal_arena_entries").update({ status: "finished" }).eq("tournament_id", id).in("status", ["joined", "waiting"]);
    if (entries.error) throw new InternalArenaServerError(entries.error.message, 500);
  }
  if (requested === "finish") await settleInternalArena(id);
  return (await mapArenas([data as ArenaRow]))[0];
}

async function tournamentAndStudent(tournamentId: string, studentId: string) {
  const id = validId(tournamentId);
  const sid = validId(studentId, "student");
  await refreshArenaStatuses();
  const [arenaResult, studentResult] = await Promise.all([
    client().from("internal_arena_tournaments").select("*").eq("id", id).maybeSingle(),
    client().from("students").select("id,display_name,lichess_username,class_group,is_active").eq("id", sid).eq("is_active", true).maybeSingle()
  ]);
  if (arenaResult.error) throw new InternalArenaServerError(arenaResult.error.message, 500);
  if (studentResult.error) throw new InternalArenaServerError(studentResult.error.message, 500);
  if (!arenaResult.data) throw new InternalArenaServerError("Arena tournament not found.", 404);
  if (!studentResult.data) throw new InternalArenaServerError("Active student not found.", 404);
  const arena = arenaResult.data as ArenaRow;
  if (arena.class_group && arena.class_group !== studentResult.data.class_group) throw new InternalArenaServerError("This Arena is for another class.", 403);
  return {
    arena,
    studentId: sid,
    studentName: String(studentResult.data.display_name || studentResult.data.lichess_username || "Student")
  };
}

export async function matchInternalArenaStudent(tournamentId: string, studentId: string, avoidStudentId?: string | null) {
  const policy = await client().from("internal_arena_tournaments").select("experience_version").eq("id", validId(tournamentId)).maybeSingle();
  if (policy.error) throw new InternalArenaServerError(policy.error.message, 500);
  if (policy.data?.experience_version === 1) {
    await dispatchArenaQueue(tournamentId);
    const entry = await client().from("internal_arena_entries").select("status,current_game_id").eq("tournament_id", tournamentId).eq("student_id", validId(studentId, "student")).maybeSingle();
    if (entry.error) throw new InternalArenaServerError(entry.error.message, 500);
    const result = mapMatchmaking({ status: entry.data?.status === "playing" ? "matched" : "waiting", gameId: entry.data?.current_game_id });
    scheduleArenaBotTurn(result.gameId);
    return result;
  }
  for (let attempt = 0; attempt < MAX_CHALLENGE_CODE_ATTEMPTS; attempt += 1) {
    const { data, error } = await client().rpc("match_internal_arena_student", {
      p_tournament_id: validId(tournamentId),
      p_student_id: validId(studentId, "student"),
      p_challenge_code: generateChallengeCode(),
      p_initial_fen: new Chess().fen(),
      p_avoid_student_id: avoidStudentId ? validId(avoidStudentId, "student") : null
    });
    if (!error) {
      const result = mapMatchmaking(data);
      if (result.status === "matched") { scheduleArenaBotTurn(result.gameId); return result; }
      return matchArenaBot(tournamentId, studentId);
    }
    if (error.message?.includes("Arena pairings are paused")) return { status: "waiting", gameId: null } satisfies InternalArenaMatchmaking;
    if (error.code !== "23505") throw new InternalArenaServerError(error.message, error.message.includes("not found") ? 404 : 409);
  }
  throw new InternalArenaServerError("Could not reserve a unique Arena game. Try again.", 500);
}

export async function joinInternalArena(tournamentId: string, studentId: string) {
  const { arena, studentId: sid } = await tournamentAndStudent(tournamentId, studentId);
  if (arena.experience_version === 1) return arenaQueuePresence(arena.id, sid, "join");
  if (arena.status !== "scheduled" && arena.status !== "active") throw new InternalArenaServerError("This Arena is no longer accepting players.", 409);
  const existing = await client().from("internal_arena_entries").select("status,current_game_id").eq("tournament_id", arena.id).eq("student_id", sid).maybeSingle();
  if (existing.error) throw new InternalArenaServerError(existing.error.message, 500);
  if (existing.data?.status === "playing" && existing.data.current_game_id) return { status: "matched", gameId: String(existing.data.current_game_id) } satisfies InternalArenaMatchmaking;
  const entryStatus = arena.status === "active" ? "waiting" : "joined";
  const write = existing.data
    ? await client().from("internal_arena_entries").update({ status: entryStatus, current_game_id: null }).eq("tournament_id", arena.id).eq("student_id", sid)
    : await client().from("internal_arena_entries").insert({ tournament_id: arena.id, student_id: sid, status: entryStatus });
  if (write.error) throw new InternalArenaServerError(write.error.message, 500);
  return arena.status === "active" ? matchInternalArenaStudent(arena.id, sid) : { status: "joined", gameId: null } satisfies InternalArenaMatchmaking;
}

export async function pauseInternalArenaQueue(tournamentId: string, studentId: string) {
  const { arena, studentId: sid } = await tournamentAndStudent(tournamentId, studentId);
  if (arena.experience_version === 1) return arenaQueuePresence(arena.id, sid, "pause");
  const { data, error } = await client().from("internal_arena_entries").update({ status: "joined", current_game_id: null }).eq("tournament_id", arena.id).eq("student_id", sid).eq("status", "waiting").select("id");
  if (error) throw new InternalArenaServerError(error.message, 500);
  if (!data?.length) throw new InternalArenaServerError("You are not currently waiting for an Arena opponent.", 409);
  return { status: "joined", gameId: null } satisfies InternalArenaMatchmaking;
}

async function assertArenaChatRateLimit(tournamentId: string, studentId: string | null) {
  let query = client()
    .from("internal_arena_chat_messages")
    .select("created_at")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(1);
  query = studentId ? query.eq("student_id", studentId) : query.eq("sender_role", "teacher").is("student_id", null);
  const { data, error } = await query;
  if (error) throw new InternalArenaServerError(error.message, 500);
  const lastMessageAt = data?.[0]?.created_at ? new Date(String(data[0].created_at)).getTime() : 0;
  if (Date.now() - lastMessageAt < 1_500) throw new InternalArenaServerError("Please wait a moment before sending another message.", 429);
}

async function insertArenaChatMessage(input: { tournamentId: string; studentId: string | null; senderRole: "student" | "teacher"; senderName: string; message: unknown }) {
  await assertArenaChatRateLimit(input.tournamentId, input.studentId);
  const { data, error } = await client().from("internal_arena_chat_messages").insert({
    tournament_id: input.tournamentId,
    student_id: input.studentId,
    sender_role: input.senderRole,
    sender_name: input.senderName,
    message: cleanChatMessage(input.message)
  }).select("id,student_id,sender_role,sender_name,message,created_at").single();
  if (error) throw new InternalArenaServerError(error.message, 500);
  const row = data as ChatRow;
  return {
    id: row.id,
    studentId: row.student_id,
    senderRole: row.sender_role,
    senderName: row.sender_name,
    message: row.message,
    createdAt: row.created_at
  } satisfies InternalArenaChatMessage;
}

export async function postStudentInternalArenaChat(tournamentId: string, studentId: string, message: unknown) {
  const { arena, studentId: sid, studentName } = await tournamentAndStudent(tournamentId, studentId);
  if (arena.status === "cancelled") throw new InternalArenaServerError("Chat is closed for this cancelled Arena.", 409);
  const entry = await client().from("internal_arena_entries").select("id").eq("tournament_id", arena.id).eq("student_id", sid).maybeSingle();
  if (entry.error) throw new InternalArenaServerError(entry.error.message, 500);
  if (!entry.data) throw new InternalArenaServerError("Join this Arena before using the lobby chat.", 403);
  return insertArenaChatMessage({ tournamentId: arena.id, studentId: sid, senderRole: "student", senderName: studentName, message });
}

export async function postTeacherInternalArenaChat(tournamentId: string, message: unknown) {
  const arena = await loadArenaRow(tournamentId);
  if (arena.status === "cancelled") throw new InternalArenaServerError("Chat is closed for this cancelled Arena.", 409);
  return insertArenaChatMessage({ tournamentId: arena.id, studentId: null, senderRole: "teacher", senderName: "Coach", message });
}

export async function forceInternalArenaPair(tournamentId: string, firstStudentId: string, secondStudentId: string) {
  const id = validId(tournamentId);
  const first = validId(firstStudentId, "participant");
  const second = validId(secondStudentId, "participant");
  if (first === second) throw new InternalArenaServerError("Choose two different players.");
  const bots = await client().from("internal_arena_bots").select("id").eq("tournament_id", id).in("id", [first, second]);
  if (bots.error) throw new InternalArenaServerError(bots.error.message, 500);
  if (bots.data?.length === 2) return matchArenaBots(id, first, second);
  if (bots.data?.length === 1) return matchArenaBot(id, bots.data[0].id === first ? second : first, bots.data[0].id);
  for (let attempt = 0; attempt < MAX_CHALLENGE_CODE_ATTEMPTS; attempt += 1) {
    const { data, error } = await client().rpc("force_internal_arena_pair", {
      p_tournament_id: validId(tournamentId),
      p_first_student_id: validId(firstStudentId, "student"),
      p_second_student_id: validId(secondStudentId, "student"),
      p_challenge_code: generateChallengeCode(),
      p_initial_fen: new Chess().fen()
    });
    if (!error) return mapMatchmaking(data);
    if (error.code !== "23505") throw new InternalArenaServerError(error.message, 409);
  }
  throw new InternalArenaServerError("Could not reserve a unique forced Arena game. Try again.", 500);
}

export async function finalizeInternalArenaGame(gameId: string) {
  const { data, error } = await client().rpc("finalize_internal_arena_game", { p_game_id: validId(gameId, "game") });
  if (error) throw new InternalArenaServerError(error.message, 500);
  const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
  if (result.tracked !== true || !result.tournamentId) return;
  const tournamentId = String(result.tournamentId);
  await settleInternalArena(tournamentId);
  const whiteStudentId = result.whiteStudentId ? String(result.whiteStudentId) : null;
  const blackStudentId = result.blackStudentId ? String(result.blackStudentId) : null;
  await Promise.allSettled([
    ...(whiteStudentId ? [matchInternalArenaStudent(tournamentId, whiteStudentId, blackStudentId)] : []),
    ...(blackStudentId ? [matchInternalArenaStudent(tournamentId, blackStudentId, whiteStudentId)] : [])
  ]);
}

export function scheduleArenaBotTurn(gameId: string | null) {
  if (!gameId) return;
  after(async () => {
    try {
      const { advanceArenaBotGame } = await import("@/chess/persistence/liveGameServer");
      await advanceArenaBotGame(gameId);
    } catch (error) { console.error("Arena bot turn failed", error instanceof Error ? error.message : "Unknown error"); }
  });
}

async function matchArenaBot(tournamentId: string, studentId: string, botId?: string) {
  for (let attempt = 0; attempt < MAX_CHALLENGE_CODE_ATTEMPTS; attempt += 1) {
    const { data, error } = await client().rpc("match_internal_arena_bot", {
      p_tournament_id: validId(tournamentId), p_student_id: validId(studentId, "student"),
      p_bot_id: botId ?? null, p_challenge_code: generateChallengeCode(), p_initial_fen: new Chess().fen()
    });
    if (!error) { const result = mapMatchmaking(data); scheduleArenaBotTurn(result.gameId); return result; }
    if (error.message?.includes("Arena pairings are paused")) return { status: "waiting", gameId: null } satisfies InternalArenaMatchmaking;
    if (error.code !== "23505") throw new InternalArenaServerError(error.message, 409);
  }
  throw new InternalArenaServerError("Could not reserve an Arena bot game. Try again.", 500);
}

async function matchArenaBots(tournamentId: string, firstBotId?: string, secondBotId?: string) {
  for (let attempt = 0; attempt < MAX_CHALLENGE_CODE_ATTEMPTS; attempt += 1) {
    const { data, error } = await client().rpc("match_internal_arena_bot_pair", {
      p_tournament_id: validId(tournamentId), p_challenge_code: generateChallengeCode(), p_initial_fen: new Chess().fen(),
      p_first_bot_id: firstBotId ?? null, p_second_bot_id: secondBotId ?? null
    });
    if (!error) { const result = mapMatchmaking(data); scheduleArenaBotTurn(result.gameId); return result; }
    if (error.message?.includes("Arena pairings are paused")) return { status: "waiting", gameId: null } satisfies InternalArenaMatchmaking;
    if (error.code !== "23505") throw new InternalArenaServerError(error.message, 409);
  }
  throw new InternalArenaServerError("Could not reserve a bot-vs-bot game. Try again.", 500);
}

function scheduleArenaBotActivity(arena: InternalArena) {
  const bots = arena.standings.filter((entry) => entry.bot);
  const games = new Set(bots.flatMap((entry) => entry.status === "playing" && entry.currentGameId ? [entry.currentGameId] : []));
  games.forEach(scheduleArenaBotTurn);
  if (arena.experienceVersion === 1) {
    if (arena.status === "active" && !arena.pairingsPaused) after(async () => {
      try { await dispatchArenaQueue(arena.id); } catch (error) { console.error("Arena dispatch failed", error); }
    });
    return;
  }
  if (arena.status !== "active" || arena.pairingsPaused || !bots.some((entry) => entry.status === "waiting" || entry.status === "joined")) return;
  after(async () => {
    try {
      // Serve waiting humans first. The bot-pair RPC rechecks priority under the Arena lock.
      const waiting = await client().from("internal_arena_entries").select("student_id").eq("tournament_id", arena.id).eq("status", "waiting").not("student_id", "is", null).limit(12);
      if (waiting.error) throw new InternalArenaServerError(waiting.error.message, 500);
      for (const entry of waiting.data ?? []) {
        try { await matchInternalArenaStudent(arena.id, entry.student_id); }
        catch (error) { console.error("Arena queued player pairing failed", error instanceof Error ? error.message : "Unknown error"); }
      }
      for (let pair = 0; pair < 6; pair += 1) {
        if ((await matchArenaBots(arena.id)).status !== "matched") break;
      }
    } catch (error) { console.error("Arena bot pairing failed", error instanceof Error ? error.message : "Unknown error"); }
  });
}

export async function manageInternalArenaBot(tournamentId: string, action: "add" | "update" | "remove", input: unknown, botId?: string) {
  let values: { name: string; difficultyId: string } | null = null;
  if (action !== "remove") {
    try { values = parseArenaBotInput(input); }
    catch (error) { throw new InternalArenaServerError(error instanceof Error ? error.message : "Invalid bot."); }
  }
  const id = validId(tournamentId);
  const { error } = await client().rpc("manage_internal_arena_bot", {
    p_tournament_id: id, p_action: action, p_bot_id: botId ? validId(botId, "bot") : null,
    p_name: values?.name ?? null, p_difficulty_id: values?.difficultyId ?? null
  });
  if (error) throw new InternalArenaServerError(error.message, 409);
  // Loading the lobby also wakes waiting humans and remaining bots.
  return getTeacherInternalArenaLobby(id);
}


/** Pairing decisions are serialized by the tournament lock, not by request arrival. */
async function dispatchArenaQueue(tournamentId: string) {
  const { error } = await client().rpc("pair_arena_waiting_students", { p_tournament_id: tournamentId });
  if (error) throw new InternalArenaServerError(error.message, 500);
}

export async function settleInternalArena(tournamentId: string) {
  const { error } = await client().rpc("settle_internal_arena", { p_tournament_id: tournamentId });
  if (error) throw new InternalArenaServerError(error.message, 500);
}

export async function arenaQueuePresence(tournamentId: string, studentId: string, action: "heartbeat" | "join" | "pause" = "heartbeat", completedGameId?: string): Promise<ArenaQueueState> {
  const { arena, studentId: sid } = await tournamentAndStudent(tournamentId, studentId);
  if (arena.experience_version === 1) {
    const presence = await client().rpc("arena_queue_presence", { p_tournament_id: arena.id, p_student_id: sid, p_action: action });
    if (presence.error) throw new InternalArenaServerError(presence.error.message, 409);
    await dispatchArenaQueue(arena.id);
  } else if (action === "pause") {
    await pauseInternalArenaQueue(arena.id, sid);
  } else if (action === "join") {
    await joinInternalArena(arena.id, sid);
  }
  const [entry, pairing, settled] = await Promise.all([
    client().from("internal_arena_entries").select("status,current_game_id,queue_entered_at,queue_enabled").eq("tournament_id", arena.id).eq("student_id", sid).maybeSingle(),
    completedGameId ? client().from("internal_arena_pairings").select("white_student_id,black_student_id,white_points,black_points,status")
      .eq("tournament_id", arena.id).eq("game_id", validId(completedGameId, "game")).maybeSingle() : Promise.resolve({ data: null, error: null }),
    arena.experience_version === 1 && arena.status === "finished"
      ? client().from("internal_arena_results").select("tournament_id").eq("tournament_id", arena.id).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  if (entry.error || pairing.error || settled.error) throw new InternalArenaServerError(entry.error?.message || pairing.error?.message || settled.error?.message || "Queue unavailable.", 500);
  const gameId = entry.data?.status === "playing" ? entry.data.current_game_id : null;
  scheduleArenaBotTurn(gameId);
  const p = pairing.data;
  return {
    status: gameId ? "matched" : entry.data?.status === "waiting" ? "waiting" : "joined", gameId,
    serverTime: new Date().toISOString(), queueEnabled: entry.data?.queue_enabled ?? false,
    queueEnteredAt: entry.data?.queue_entered_at ?? null, tournamentStatus: arena.status,
    pairingsPaused: Boolean(arena.pairings_paused), startsAt: arena.starts_at, endsAt: arena.ends_at,
    finalizing: arena.status === "finished" && !settled.data,
    points: p?.status === "completed" ? p.white_student_id === sid ? p.white_points : p.black_student_id === sid ? p.black_points : null : null
  };
}

/** Bounded and retryable; also repairs completed games whose result write was interrupted. */
export async function maintainInternalArenas() {
  await refreshArenaStatuses();
  const arenas = await client().rpc("unsettled_arena_ids");
  if (arenas.error) throw new InternalArenaServerError(arenas.error.message, 500);
  const ids = (arenas.data ?? []) as string[];
  if (!ids.length) return { checked: 0 };
  const active = await client().from("internal_arena_pairings").select("game_id").in("tournament_id", ids).eq("status", "active").order("started_at").limit(100);
  if (active.error) throw new InternalArenaServerError(active.error.message, 500);
  const { maintainArenaGame } = await import("@/chess/persistence/liveGameServer");
  const failures: unknown[] = [];
  for (const pairing of active.data ?? []) {
    try { await maintainArenaGame(pairing.game_id); } catch (error) { failures.push(error); }
  }
  for (const id of ids) {
    try { await settleInternalArena(id); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new InternalArenaServerError(`Arena maintenance needs retry: ${failures.length} operations failed.`, 500);
  return { checked: active.data?.length ?? 0 };
}
