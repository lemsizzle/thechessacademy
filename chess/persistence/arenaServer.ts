import "server-only";

import { Chess } from "chess.js";
import { currentArenaStatus, rankArenaStandings } from "@/chess/arena/scoring";
import type { CreateInternalArenaInput, InternalArena, InternalArenaChatMessage, InternalArenaEntryStatus, InternalArenaLobby, InternalArenaMatchmaking, InternalArenaPairing, InternalArenaStanding, InternalArenaStatus } from "@/chess/arena/types";
import { TIME_CONTROLS } from "@/chess/game/config";
import { generateChallengeCode, MAX_CHALLENGE_CODE_ATTEMPTS } from "@/chess/live/challengeCode";
import type { TimeControl } from "@/chess/types";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { AvatarItem, StudentAvatarConfig } from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ArenaRow = {
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
  tournament_id: string;
  student_id: string;
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
  white_student_id: string;
  black_student_id: string;
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
  const entryResult = await client().from("internal_arena_entries").select("tournament_id,student_id,status,score,games_played,wins,draws,losses,current_game_id").in("tournament_id", tournamentIds);
  if (entryResult.error) throw new InternalArenaServerError(entryResult.error.message, 500);
  const entries = (entryResult.data ?? []) as EntryRow[];
  const studentIds = [...new Set(entries.map((entry) => entry.student_id))];
  const students = new Map<string, StudentRow>();
  if (studentIds.length) {
    const studentResult = await client().from("students").select("id,display_name,lichess_username,class_group").in("id", studentIds);
    if (studentResult.error) throw new InternalArenaServerError(studentResult.error.message, 500);
    for (const student of (studentResult.data ?? []) as StudentRow[]) students.set(student.id, student);
  }

  return rows.map((row) => {
    const standings = rankArenaStandings(entries.filter((entry) => entry.tournament_id === row.id).map((entry): Omit<InternalArenaStanding, "rank"> => ({
      studentId: entry.student_id,
      name: students.get(entry.student_id)?.display_name || students.get(entry.student_id)?.lichess_username || "Student",
      status: entry.status,
      score: entry.score,
      gamesPlayed: entry.games_played,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      currentGameId: entry.current_game_id
    })));
    return {
      id: row.id,
      name: row.name,
      description: row.description,
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
  const studentIds = arena.standings.map((entry) => entry.studentId);
  const [pairingResult, chatResult, avatarDisplay] = await Promise.all([
    client()
      .from("internal_arena_pairings")
      .select("id,game_id,white_student_id,black_student_id,status,result,white_points,black_points,started_at,completed_at")
      .eq("tournament_id", row.id)
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
  if (pairingResult.error) throw new InternalArenaServerError(pairingResult.error.message, 500);
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
  const pairings = ((pairingResult.data ?? []) as PairingRow[]).map((pairing): InternalArenaPairing => ({
    id: pairing.id,
    gameId: pairing.game_id,
    status: pairing.status,
    result: pairing.result,
    whiteStudentId: pairing.white_student_id,
    whiteName: names.get(pairing.white_student_id) ?? "Student",
    blackStudentId: pairing.black_student_id,
    blackName: names.get(pairing.black_student_id) ?? "Student",
    whitePoints: pairing.white_points,
    blackPoints: pairing.black_points,
    startedAt: pairing.started_at,
    completedAt: pairing.completed_at
  }));
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
    canChat
  };
}

export async function listTeacherInternalArenas() {
  return mapArenas(await loadArenaRows());
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
  return mapArenas(visible, id);
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
  if (!["start", "finish", "cancel"].includes(requested)) throw new InternalArenaServerError("Invalid Arena action.");
  const { data: current, error: loadError } = await client().from("internal_arena_tournaments").select("*").eq("id", id).maybeSingle();
  if (loadError) throw new InternalArenaServerError(loadError.message, 500);
  if (!current) throw new InternalArenaServerError("Arena tournament not found.", 404);
  const row = current as ArenaRow;
  const now = new Date();
  const update = requested === "start"
    ? { status: "active", starts_at: now.toISOString(), ends_at: new Date(now.getTime() + row.duration_minutes * 60_000).toISOString() }
    : { status: requested === "finish" ? "finished" : "cancelled" };
  const { data, error } = await client().from("internal_arena_tournaments").update(update).eq("id", id).select("*").single();
  if (error) throw new InternalArenaServerError(error.message, 500);
  if (requested !== "start") {
    const entries = await client().from("internal_arena_entries").update({ status: "finished" }).eq("tournament_id", id).in("status", ["joined", "waiting"]);
    if (entries.error) throw new InternalArenaServerError(entries.error.message, 500);
  }
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
  for (let attempt = 0; attempt < MAX_CHALLENGE_CODE_ATTEMPTS; attempt += 1) {
    const { data, error } = await client().rpc("match_internal_arena_student", {
      p_tournament_id: validId(tournamentId),
      p_student_id: validId(studentId, "student"),
      p_challenge_code: generateChallengeCode(),
      p_initial_fen: new Chess().fen(),
      p_avoid_student_id: avoidStudentId ? validId(avoidStudentId, "student") : null
    });
    if (!error) return mapMatchmaking(data);
    if (error.code !== "23505") throw new InternalArenaServerError(error.message, error.message.includes("not found") ? 404 : 409);
  }
  throw new InternalArenaServerError("Could not reserve a unique Arena game. Try again.", 500);
}

export async function joinInternalArena(tournamentId: string, studentId: string) {
  const { arena, studentId: sid } = await tournamentAndStudent(tournamentId, studentId);
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
  if (result.tracked !== true || !result.tournamentId || !result.whiteStudentId || !result.blackStudentId) return;
  const tournamentId = String(result.tournamentId);
  const whiteStudentId = String(result.whiteStudentId);
  const blackStudentId = String(result.blackStudentId);
  await Promise.allSettled([
    matchInternalArenaStudent(tournamentId, whiteStudentId, blackStudentId),
    matchInternalArenaStudent(tournamentId, blackStudentId, whiteStudentId)
  ]);
}
