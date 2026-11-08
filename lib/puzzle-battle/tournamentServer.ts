import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { BATTLE_MODES, BATTLE_TIMES, type BattleMode } from "./types";
import { BattleError, newBattlePlayer } from "./rules";
import { buildBattleDeck } from "./server";
import { pairTournamentRound, type PuzzleTournament } from "./tournament";
import { buildRatedBotPlan, simulateTournamentBots } from "./tournamentBots";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function tournamentId(id: unknown): string {
  if (typeof id !== "string" || !UUID.test(id)) throw new BattleError("Invalid tournament.", 400);
  return id;
}
async function rpc(name: string, args: Record<string, unknown> = {}) {
  const db = getSupabaseServiceClient();
  if (!db) throw new BattleError("Puzzle tournaments are unavailable. Please retry.", 503);
  const { data, error } = await db.rpc(name, args);
  if (error) throw new BattleError(error.code === "P0001" ? error.message : "The tournament could not be saved or loaded. Please retry.", error.code === "P0001" ? 409 : 503);
  return data;
}
export const listPuzzleTournaments = () => rpc("list_puzzle_tournaments");
async function snapshot(id: string, teacher: boolean, studentId?: string): Promise<PuzzleTournament> {
  return rpc("puzzle_tournament_snapshot", { p_id: tournamentId(id), p_teacher: teacher, p_student_id: studentId ?? null });
}
export async function getPuzzleTournament(id: string, teacher = false, studentId?: string): Promise<PuzzleTournament> {
  let t = await snapshot(id, teacher, studentId);
  let advanceError: string | undefined;
  if (t.status === "active" && t.round > 0 && t.round < t.rounds && t.matches.every(m => m.result)) {
    const token = randomUUID();
    const claimed = await rpc("claim_puzzle_tournament_round", { p_id: id, p_version: t.version, p_token: token });
    if (claimed) {
      try {
        // Private roster data never enters the student response.
        await startRound(teacher ? t : await snapshot(id, true));
      } catch (error) {
        advanceError = error instanceof BattleError ? error.message : "The next round could not load. Retrying automatically…";
      } finally {
        await rpc("release_puzzle_tournament_round", { p_id: id, p_token: token });
      }
      t = await snapshot(id, teacher, studentId);
    }
  }
  return { ...t, serverNow: Date.now(), ...(advanceError && t.status === "active" && t.matches.every(m => m.result) ? { advanceError } : {}) };
}
async function startRound(t: PuzzleTournament) {
  const id = t.id;
  const deck = await buildBattleDeck(t.mode);
  const pairs = pairTournamentRound(t).map(([a,b]) => {
    if (!b) return { a: a.id, b: null };
    if (!a.studentId && !b.studentId) {
      const simulation = simulateTournamentBots(t.mode, t.duration, [buildRatedBotPlan(deck,a.elo!), buildRatedBotPlan(deck,b.elo!)]);
      return { a: a.id, b: b.id, afterMs: simulation.afterMs, result: {
        winnerEntryId: simulation.winnerSlot === null ? null : simulation.winnerSlot === 0 ? a.id : b.id,
        scoreA: simulation.score[0], scoreB: simulation.score[1], reason: "played"
      } };
    }
    return { a: a.id, b: b.id, state: { players: [newBattlePlayer(a.studentId!,a.name),newBattlePlayer(b.studentId ?? "bot:steady",b.name)] },
      ...(b.studentId ? {} : { plan: buildRatedBotPlan(deck,b.elo!) }) };
  });
  await rpc("start_puzzle_tournament_round", { p_id: id, p_version: t.version, p_pairs: pairs, p_deck: deck });
}

type Input = Record<string, unknown>;
function text(value: unknown, limit: number) { return typeof value === "string" ? value.trim().slice(0, limit) : ""; }
function rating(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 200 || value > 2400) throw new BattleError("Choose a bot Elo from 200 to 2400.");
  return value;
}
export async function teacherPuzzleTournamentAction(body: Input) {
  if (body.action === "create") {
    const title = text(body.title, 80), mode = body.mode as BattleMode, duration = body.duration as number, rounds = body.rounds as number;
    if (!title || !BATTLE_MODES.includes(mode) || !BATTLE_TIMES.includes(duration as never) || !Number.isInteger(rounds) || rounds < 1 || rounds > 9)
      throw new BattleError("Enter a name, battle mode, time control, and 1–9 rounds.");
    const id = tournamentId(body.requestId);
    await rpc("create_puzzle_tournament", { p_id: id, p_title: title, p_mode: mode, p_duration: duration, p_rounds: rounds });
    return getPuzzleTournament(id, true);
  }
  const id = tournamentId(body.id);
  if (body.action === "bot") {
    const name = text(body.name, 60);
    if (!name) throw new BattleError("Give this player a name.");
    await rpc("edit_puzzle_tournament_entry", { p_id: id, p_action: "bot", p_entry: { id: tournamentId(body.requestId), name, elo: rating(body.elo) } });
  } else if (body.action === "rating" || body.action === "remove") {
    await rpc("edit_puzzle_tournament_entry", { p_id: id, p_action: body.action, p_entry: { id: tournamentId(body.entryId), ...(body.action === "rating" ? { elo: rating(body.elo) } : {}) } });
  } else if (body.action === "cancel") {
    await rpc("cancel_puzzle_tournament", { p_id: id });
  } else if (body.action === "start") {
    const t = await snapshot(id, true);
    if (body.version !== t.version) throw new BattleError("The roster or round changed. Refresh and try again.", 409);
    if (t.status !== "waiting" || t.round !== 0) throw new BattleError("The tournament has started. Later rounds begin automatically.", 409);
    if (t.entries.length < 2) throw new BattleError("At least two players are needed.");
    await startRound(t);
  } else throw new BattleError("Unknown tournament action.");
  return getPuzzleTournament(id, true);
}
export async function studentPuzzleTournamentAction(body: Input, student: { studentId: string; name: string }) {
  if (body.action !== "join" && body.action !== "leave") throw new BattleError("Students can join or leave the waiting lobby.", 403);
  const id = tournamentId(body.id);
  await rpc("edit_puzzle_tournament_entry", { p_id: id, p_action: body.action, p_entry: { id: randomUUID(), studentId: student.studentId, name: text(student.name,60) || "Player" } });
  return getPuzzleTournament(id, false, student.studentId);
}
