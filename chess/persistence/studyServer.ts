import "server-only";

import { Chess } from "chess.js";
import { createAnalysisTree, createEmptyAnalysisTree, validateAnalysisTree } from "@/chess/analysis/tree";
import { parsePgnToAnalysisTree } from "@/chess/analysis/pgn";
import { resolveStudyAccessRole, studyRoleAllows } from "@/chess/analysis/permissions";
import type { AnalysisTree, CompletedGameMove, CompletedGameRecord, StudyChapter, StudyMember, StudySummary } from "@/chess/analysis/types";
import type { ChessActor } from "@/lib/auth/requireChessActor";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type StudyRow = {
  id: string; owner_kind: "student" | "admin"; owner_student_id: string | null; title: string;
  description: string; visibility: "private" | "shared"; source_game_id: string | null;
  created_at: string; updated_at: string;
};
type ChapterRow = {
  id: string; study_id: string; title: string; sort_order: number; initial_fen: string;
  analysis_tree: AnalysisTree; source_game_id: string | null; metadata: Record<string, unknown>;
  version: number; updated_at: string;
};

function client() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Chess study storage is not configured.");
  return supabase;
}

function cleanText(value: unknown, name: string, max: number) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new Error(`Invalid ${name}.`);
  return text;
}

function mapGame(row: Record<string, unknown>): CompletedGameRecord {
  return {
    id: String(row.id), playerId: String(row.player_id), opponentName: String(row.opponent_name),
    playerColor: row.player_color as CompletedGameRecord["playerColor"], result: row.result as CompletedGameRecord["result"],
    resultReason: String(row.result_reason), initialFen: String(row.initial_fen), finalFen: String(row.final_fen),
    pgn: String(row.pgn), moves: row.moves as CompletedGameMove[], startedAt: String(row.started_at),
    completedAt: String(row.completed_at), timeControl: row.time_control as CompletedGameRecord["timeControl"]
  };
}

export async function listCompletedGames(actor: ChessActor, limit = 30) {
  let query = client().from("internal_chess_games")
    .select("id,player_id,opponent_name,player_color,result,result_reason,initial_fen,final_fen,pgn,moves,started_at,completed_at,time_control")
    .order("completed_at", { ascending: false }).limit(Math.min(100, Math.max(1, limit)));
  if (actor.kind === "student") query = query.eq("player_id", actor.studentId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapGame(row as Record<string, unknown>));
}

export async function getCompletedGame(actor: ChessActor, gameId: string) {
  let query = client().from("internal_chess_games")
    .select("id,player_id,opponent_name,player_color,result,result_reason,initial_fen,final_fen,pgn,moves,started_at,completed_at,time_control")
    .eq("id", gameId);
  if (actor.kind === "student") query = query.eq("player_id", actor.studentId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Completed game not found.");
  return mapGame(data as Record<string, unknown>);
}

async function memberRole(studyId: string, studentId: string) {
  const { data, error } = await client().from("chess_study_members").select("role")
    .eq("study_id", studyId).eq("student_id", studentId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { role?: "owner" | "editor" | "viewer" } | null)?.role ?? null;
}

export async function requireStudyAccess(actor: ChessActor, studyId: string, write = false, ownerOnly = false) {
  const { data, error } = await client().from("chess_studies").select("*").eq("id", studyId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Study not found.");
  const study = data as StudyRow;
  const membership = actor.kind === "student" ? await memberRole(studyId, actor.studentId) : null;
  const role = resolveStudyAccessRole(actor, study.owner_student_id, membership);
  const operation = ownerOnly ? "delete" : write ? "write" : "read";
  if (!studyRoleAllows(role, operation)) throw new Error("You do not have permission to access this study.");
  return { study, role };
}

function mapChapter(row: ChapterRow): StudyChapter {
  return {
    id: row.id, studyId: row.study_id, title: row.title, sortOrder: row.sort_order,
    initialFen: row.initial_fen, tree: validateAnalysisTree(row.analysis_tree), sourceGameId: row.source_game_id,
    metadata: row.metadata ?? {}, version: row.version, updatedAt: row.updated_at
  };
}

export async function listStudies(actor: ChessActor): Promise<StudySummary[]> {
  let permittedIds: string[] = [];
  if (actor.kind === "student") {
    const { data: memberships, error: memberError } = await client().from("chess_study_members").select("study_id").eq("student_id", actor.studentId);
    if (memberError) throw new Error(memberError.message);
    permittedIds = (memberships ?? []).map((row) => String((row as { study_id: string }).study_id));
  }
  let query = client().from("chess_studies").select("*").order("updated_at", { ascending: false });
  if (actor.kind === "student") {
    const ids = permittedIds.length ? `,id.in.(${permittedIds.join(",")})` : "";
    query = query.or(`owner_student_id.eq.${actor.studentId}${ids}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as StudyRow[];
  const summaries: StudySummary[] = [];
  for (const study of rows) {
    const { count, error: countError } = await client().from("chess_study_chapters").select("id", { count: "exact", head: true }).eq("study_id", study.id);
    if (countError) throw new Error(countError.message);
    const role = actor.kind === "admin" || study.owner_student_id === actor.studentId ? "owner" : await memberRole(study.id, actor.studentId);
    if (!role) continue;
    summaries.push({
      id: study.id, title: study.title, description: study.description, visibility: study.visibility,
      ownerKind: study.owner_kind, ownerStudentId: study.owner_student_id, accessRole: role,
      chapterCount: count ?? 0, updatedAt: study.updated_at
    });
  }
  return summaries;
}

export async function getStudy(actor: ChessActor, studyId: string) {
  const { study, role } = await requireStudyAccess(actor, studyId);
  const { data, error } = await client().from("chess_study_chapters").select("*").eq("study_id", studyId).order("sort_order");
  if (error) throw new Error(error.message);
  return {
    study: { id: study.id, title: study.title, description: study.description, visibility: study.visibility, ownerKind: study.owner_kind, accessRole: role, updatedAt: study.updated_at },
    chapters: ((data ?? []) as ChapterRow[]).map(mapChapter)
  };
}

export async function getChapter(actor: ChessActor, studyId: string, chapterId: string) {
  await requireStudyAccess(actor, studyId);
  const { data, error } = await client().from("chess_study_chapters").select("*")
    .eq("study_id", studyId).eq("id", chapterId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Study chapter not found.");
  return mapChapter(data as ChapterRow);
}

export async function listStudyMembers(actor: ChessActor, studyId: string): Promise<StudyMember[]> {
  await requireStudyAccess(actor, studyId, false, true);
  const { data: members, error } = await client().from("chess_study_members")
    .select("student_id,role").eq("study_id", studyId).order("created_at");
  if (error) throw new Error(error.message);
  const memberRows = (members ?? []) as Array<{ student_id: string; role: StudyMember["role"] }>;
  if (!memberRows.length) return [];
  const { data: students, error: studentError } = await client().from("students")
    .select("id,display_name,public_slug,lichess_username").in("id", memberRows.map((member) => member.student_id));
  if (studentError) throw new Error(studentError.message);
  const byId = new Map((students ?? []).map((student) => {
    const row = student as { id: string; display_name: string; public_slug: string; lichess_username: string | null };
    return [row.id, row] as const;
  }));
  return memberRows.flatMap((member) => {
    const student = byId.get(member.student_id);
    return student ? [{
      studentId: student.id, name: student.display_name, slug: student.public_slug,
      lichessUsername: student.lichess_username ?? undefined, role: member.role
    }] : [];
  });
}

export async function upsertStudyMember(actor: ChessActor, studyId: string, input: { studentId?: unknown; role?: unknown }) {
  const { study } = await requireStudyAccess(actor, studyId, false, true);
  const studentId = String(input.studentId ?? "");
  const role = input.role === "editor" ? "editor" : input.role === "viewer" ? "viewer" : null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId) || !role) throw new Error("Invalid study member.");
  if (study.owner_student_id === studentId) throw new Error("The study owner already has full access.");
  const supabase = client();
  const { data: student, error: studentError } = await supabase.from("students").select("id").eq("id", studentId).eq("is_active", true).maybeSingle();
  if (studentError) throw new Error(studentError.message);
  if (!student) throw new Error("Student not found.");
  const { error } = await supabase.from("chess_study_members").upsert({ study_id: studyId, student_id: studentId, role }, { onConflict: "study_id,student_id" });
  if (error) throw new Error(error.message);
  await supabase.from("chess_studies").update({ visibility: "shared", updated_at: new Date().toISOString() }).eq("id", studyId);
  return (await listStudyMembers(actor, studyId)).find((member) => member.studentId === studentId)!;
}

export async function removeStudyMember(actor: ChessActor, studyId: string, studentId: string) {
  const { study } = await requireStudyAccess(actor, studyId, false, true);
  if (study.owner_student_id === studentId) throw new Error("The study owner cannot be removed.");
  const { error } = await client().from("chess_study_members").delete().eq("study_id", studyId).eq("student_id", studentId).neq("role", "owner");
  if (error) throw new Error(error.message);
}

export async function createStudy(actor: ChessActor, input: { title?: unknown; description?: unknown; sourceGameId?: unknown; visibility?: unknown; analysisTree?: unknown }) {
  const sourceGameId = input.sourceGameId ? String(input.sourceGameId) : null;
  const game = sourceGameId ? await getCompletedGame(actor, sourceGameId) : null;
  const title = input.title ? cleanText(input.title, "study title", 120) : game ? `Game vs ${game.opponentName}` : "Untitled Study";
  const description = input.description ? String(input.description).trim().slice(0, 2000) : game ? `Analysis of the game played ${new Date(game.completedAt).toLocaleDateString("en-GB")}.` : "";
  const visibility = input.visibility === "shared" ? "shared" : "private";
  const tree = input.analysisTree ? validateAnalysisTree(input.analysisTree) : game ? createAnalysisTree(game.initialFen, game.moves) : createEmptyAnalysisTree();
  if (game && tree.nodes[tree.rootId].fen !== game.initialFen) throw new Error("Analysis does not start from the linked game position.");
  const supabase = client();
  const { data, error } = await supabase.from("chess_studies").insert({
    owner_kind: actor.kind, owner_student_id: actor.kind === "student" ? actor.studentId : null,
    title, description, visibility, source_game_id: sourceGameId
  }).select("id").single();
  if (error) throw new Error(error.message);
  const studyId = String((data as { id: string }).id);
  const { data: chapter, error: chapterError } = await supabase.from("chess_study_chapters").insert({
    study_id: studyId, title: game ? "Game analysis" : "Chapter 1", sort_order: 0,
    initial_fen: tree.nodes[tree.rootId].fen, analysis_tree: tree, source_game_id: sourceGameId,
    metadata: game ? { opponentName: game.opponentName, result: game.result, completedAt: game.completedAt } : {}
  }).select("id").single();
  if (chapterError) {
    await supabase.from("chess_studies").delete().eq("id", studyId);
    throw new Error(chapterError.message);
  }
  if (actor.kind === "student") {
    const { error: memberError } = await supabase.from("chess_study_members").insert({ study_id: studyId, student_id: actor.studentId, role: "owner" });
    if (memberError) {
      await supabase.from("chess_studies").delete().eq("id", studyId);
      throw new Error(memberError.message);
    }
  }
  return { studyId, chapterId: String((chapter as { id: string }).id) };
}

export async function updateStudy(actor: ChessActor, studyId: string, input: { title?: unknown; description?: unknown; visibility?: unknown }) {
  await requireStudyAccess(actor, studyId, true);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = cleanText(input.title, "study title", 120);
  if (input.description !== undefined) patch.description = String(input.description).trim().slice(0, 2000);
  if (input.visibility !== undefined) {
    if (input.visibility !== "private" && input.visibility !== "shared") throw new Error("Invalid study visibility.");
    patch.visibility = input.visibility;
  }
  const { error } = await client().from("chess_studies").update(patch).eq("id", studyId);
  if (error) throw new Error(error.message);
}

export async function deleteStudy(actor: ChessActor, studyId: string) {
  await requireStudyAccess(actor, studyId, true, true);
  const { error } = await client().from("chess_studies").delete().eq("id", studyId);
  if (error) throw new Error(error.message);
}

export async function createChapter(actor: ChessActor, studyId: string, input: { title?: unknown; duplicateChapterId?: unknown; sourceGameId?: unknown; analysisTree?: unknown; pgn?: unknown; initialFen?: unknown }) {
  await requireStudyAccess(actor, studyId, true);
  const supabase = client();
  const { data: chapters, error } = await supabase.from("chess_study_chapters").select("*").eq("study_id", studyId).order("sort_order");
  if (error) throw new Error(error.message);
  const rows = (chapters ?? []) as ChapterRow[];
  const duplicate = input.duplicateChapterId ? rows.find((row) => row.id === String(input.duplicateChapterId)) : null;
  if (input.duplicateChapterId && !duplicate) throw new Error("Chapter to duplicate was not found.");
  const pgn = input.pgn === undefined ? null : String(input.pgn);
  const initialFen = input.initialFen === undefined ? null : String(input.initialFen).trim();
  if (pgn !== null && (input.duplicateChapterId || input.sourceGameId || input.analysisTree || initialFen !== null)) throw new Error("Choose one chapter source.");
  if (initialFen !== null && (input.duplicateChapterId || input.sourceGameId || input.analysisTree)) throw new Error("Choose one chapter source.");
  if (input.duplicateChapterId && input.sourceGameId) throw new Error("Choose either a game or a chapter to duplicate.");
  const game = input.sourceGameId ? await getCompletedGame(actor, String(input.sourceGameId)) : null;
  const parsedPgn = pgn !== null ? parsePgnToAnalysisTree(pgn) : null;
  let fenTree: AnalysisTree | null = null;
  if (initialFen !== null) {
    if (!initialFen || initialFen.length > 200) throw new Error("Invalid FEN.");
    try { fenTree = createEmptyAnalysisTree(initialFen); }
    catch { throw new Error("Invalid FEN."); }
  }
  const tree = parsedPgn?.tree ?? fenTree ?? (input.analysisTree ? validateAnalysisTree(input.analysisTree) : game ? createAnalysisTree(game.initialFen, game.moves) : duplicate ? validateAnalysisTree(duplicate.analysis_tree) : createEmptyAnalysisTree(new Chess().fen()));
  if (game && tree.nodes[tree.rootId].fen !== game.initialFen) throw new Error("Analysis does not start from the linked game position.");
  const importedTitle = parsedPgn
    ? parsedPgn.headers.Event || [parsedPgn.headers.White, parsedPgn.headers.Black].filter(Boolean).join(" vs ") || "Imported PGN"
    : null;
  const title = input.title ? cleanText(input.title, "chapter title", 120) : game ? `vs ${game.opponentName}` : duplicate ? `${duplicate.title} copy` : importedTitle ? importedTitle.slice(0, 120) : fenTree ? "Custom position" : `Chapter ${rows.length + 1}`;
  const sortOrder = (rows.at(-1)?.sort_order ?? -100) + 100;
  const metadata = game
    ? { sourceType: "internal-game", opponentName: game.opponentName, result: game.result, completedAt: game.completedAt }
    : duplicate?.metadata
      ?? (parsedPgn ? { sourceType: "pgn", pgnHeaders: parsedPgn.headers, result: parsedPgn.result } : fenTree ? { sourceType: "fen" } : { sourceType: "analysis" });
  const { data, error: insertError } = await supabase.from("chess_study_chapters").insert({
    study_id: studyId, title, sort_order: sortOrder, initial_fen: tree.nodes[tree.rootId].fen,
    analysis_tree: tree,
    source_game_id: game?.id ?? duplicate?.source_game_id ?? null,
    metadata
  }).select("*").single();
  if (insertError) throw new Error(insertError.message);
  return mapChapter(data as ChapterRow);
}

export async function updateChapter(actor: ChessActor, studyId: string, chapterId: string, input: { title?: unknown; tree?: unknown; version?: unknown }) {
  await requireStudyAccess(actor, studyId, true);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = cleanText(input.title, "chapter title", 120);
  if (input.tree !== undefined) patch.analysis_tree = validateAnalysisTree(input.tree);
  const version = Number(input.version);
  if (!Number.isInteger(version) || version < 1) throw new Error("Invalid chapter version.");
  patch.version = version + 1;
  const { data, error } = await client().from("chess_study_chapters").update(patch)
    .eq("id", chapterId).eq("study_id", studyId).eq("version", version).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This chapter changed elsewhere. Reload before saving again.");
  await client().from("chess_studies").update({ updated_at: new Date().toISOString() }).eq("id", studyId);
  return mapChapter(data as ChapterRow);
}

export async function deleteChapter(actor: ChessActor, studyId: string, chapterId: string) {
  await requireStudyAccess(actor, studyId, true);
  const { count } = await client().from("chess_study_chapters").select("id", { count: "exact", head: true }).eq("study_id", studyId);
  if ((count ?? 0) <= 1) throw new Error("A study must keep at least one chapter.");
  const { error } = await client().from("chess_study_chapters").delete().eq("id", chapterId).eq("study_id", studyId);
  if (error) throw new Error(error.message);
}

export async function reorderChapters(actor: ChessActor, studyId: string, chapterIds: string[]) {
  await requireStudyAccess(actor, studyId, true);
  const { data, error } = await client().from("chess_study_chapters").select("id").eq("study_id", studyId);
  if (error) throw new Error(error.message);
  const actual = (data ?? []).map((row) => String((row as { id: string }).id)).sort();
  if (actual.length !== chapterIds.length || actual.some((id, index) => id !== [...chapterIds].sort()[index])) throw new Error("Invalid chapter order.");
  for (const [index, id] of chapterIds.entries()) {
    const { error: tempError } = await client().from("chess_study_chapters").update({ sort_order: 100000 + index }).eq("id", id).eq("study_id", studyId);
    if (tempError) throw new Error(tempError.message);
  }
  for (const [index, id] of chapterIds.entries()) {
    const { error: orderError } = await client().from("chess_study_chapters").update({ sort_order: index * 100 }).eq("id", id).eq("study_id", studyId);
    if (orderError) throw new Error(orderError.message);
  }
}
