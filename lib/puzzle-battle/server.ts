import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { generateStarWarsPuzzle } from "@/lib/puzzle-training/starWars";
import { generateHideAndSeekBoard } from "@/lib/puzzle-training/hideAndSeek";
import {
  prepareTrainingPuzzle,
  validatePuzzleMove,
  firstStudentMoveIndex,
} from "@/lib/puzzle-training/engine";
import type { PuzzleSessionPuzzle } from "@/lib/puzzle-training/types";
import {
  BATTLE_MODES,
  BATTLE_TIMES,
  type BattleAction,
  type BattleChallenge,
  type BattleLobbyItem,
  type BattleMode,
  type BattleRecord,
} from "./types";
import {
  applyBattleAction,
  BattleError,
  battleView,
  newBattlePlayer,
  settleBattle,
} from "./rules";

const cache = new Map<string, { until: number; deck: BattleChallenge[] }>();
function client() {
  const db = getSupabaseServiceClient();
  if (!db)
    throw new BattleError(
      "Puzzle Battle is unavailable. Please try again later.",
      503,
    );
  return db;
}
const fields =
  "id,code,host_id,guest_id,mode,duration,version,state,created_at,expires_at,realtime_token";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function remember(id: string, deck: BattleChallenge[]) {
  if (cache.size >= 32) cache.delete(cache.keys().next().value!);
  cache.set(id, { until: Date.now() + 20 * 60_000, deck });
  return deck;
}
async function deckFor(id: string) {
  const saved = cache.get(id);
  if (saved && saved.until > Date.now()) return saved.deck;
  const { data, error } = await client()
    .from("puzzle_battle_decks")
    .select("challenges")
    .eq("battle_id", id)
    .single();
  if (error || !data)
    throw new BattleError(
      "The battle boards couldn't load. Please retry.",
      503,
    );
  return remember(id, data.challenges as BattleChallenge[]);
}
async function recordFor(id: string) {
  if (!uuid.test(id)) throw new BattleError("Invalid battle.", 404);
  const { data, error } = await client()
    .from("puzzle_battles")
    .select(fields)
    .eq("id", id)
    .maybeSingle();
  if (error)
    throw new BattleError("Puzzle Battle couldn't load. Please retry.", 503);
  if (!data) throw new BattleError("Battle not found.", 404);
  return data as BattleRecord;
}
export async function buildBattleDeck(
  mode: BattleMode,
): Promise<BattleChallenge[]> {
  const seed = randomBytes(8).toString("hex");
  if (mode === "star-wars")
    return Array.from({ length: 50 }, (_, index) => ({
      kind: mode,
      puzzle: generateStarWarsPuzzle(index, parseInt(seed.slice(0, 7), 16)),
    }));
  if (mode === "hide-and-seek")
    return Array.from({ length: 50 }, (_, index) => ({
      kind: mode,
      puzzle: generateHideAndSeekBoard(`${seed}:${index}`),
    }));
  const result: BattleChallenge[] = [];
  // Five bounded indexed reads, easy to harder. Snapshot answers once, reuse
  // across both players and hot requests; never download full decks on polls.
  for (const [minimum, maximum] of [
    [400, 800],
    [800, 1100],
    [1100, 1400],
    [1400, 1700],
    [1700, 2100],
  ]) {
    const pivot = Math.random();
    const load = async (after: boolean) => {
      let query = client()
        .from("chess_puzzles")
        .select(
          "id,initial_fen,moves,start_mode,accepted_moves,themes,rating,game_url",
        )
        .eq("is_active", true)
        .eq("source_kind", "lichess")
        .gte("rating", minimum)
        .lt("rating", maximum)
        .order("random_key")
        .limit(14);
      query = after
        ? query.gte("random_key", pivot)
        : query.lt("random_key", pivot);
      const { data, error } = await query;
      if (error)
        throw new BattleError("Puzzle pool couldn't load. Please retry.", 503);
      return (data ?? []) as PuzzleSessionPuzzle[];
    };
    let rows = await load(true);
    if (rows.length < 10) rows = [...rows, ...(await load(false))];
    let added = 0;
    for (const puzzle of rows) {
      if (added === 10) break;
      try {
        const prepared = prepareTrainingPuzzle(puzzle);
        const first = prepared.firstStudentMove;
        validatePuzzleMove(puzzle, firstStudentMoveIndex(puzzle), {
          from: first.slice(0, 2),
          to: first.slice(2, 4),
        });
        result.push({ kind: mode, puzzle });
        added++;
      } catch {
        /* Skip unusable imported positions. */
      }
    }
  }
  if (result.length < 10)
    throw new BattleError(
      "Not enough puzzles are available for a fair battle. Try Star Wars or Hide and Seek.",
      503,
    );
  return result;
}
export async function createBattle(
  student: { id: string; name: string },
  mode: unknown,
  duration: unknown,
) {
  if (
    !BATTLE_MODES.includes(mode as BattleMode) ||
    !BATTLE_TIMES.includes(duration as (typeof BATTLE_TIMES)[number])
  )
    throw new BattleError("Choose a battle mode and time control.");
  // Check before expensive preparation as well as atomically inside the RPC.
  const lobby = await listBattles(student.id);
  if (lobby.some((b) => b.mine && ["waiting", "playing"].includes(b.status)))
    throw new BattleError(
      "Finish or leave your current puzzle battle first.",
      409,
    );
  const deck = await buildBattleDeck(mode as BattleMode),
    id = randomUUID(),
    code = randomBytes(4).toString("hex").toUpperCase();
  const state = {
    status: "waiting",
    players: [newBattlePlayer(student.id, student.name)],
    startsAt: null,
    endsAt: null,
    winnerId: null,
  };
  const { error } = await client().rpc("create_puzzle_battle", {
    p_id: id,
    p_code: code,
    p_student_id: student.id,
    p_mode: mode,
    p_duration: duration,
    p_state: state,
    p_deck: deck,
  });
  if (error)
    throw new BattleError(
      error.message.includes("current puzzle battle") ||
      error.message.includes("Please wait")
        ? error.message
        : "Couldn't create the battle. Please retry.",
      409,
    );
  remember(id, deck);
  return readBattle(id, student.id);
}
export async function readBattle(id: string, studentId: string) {
  let record = await recordFor(id);
  if (!record.state.players.some((p) => p.id === studentId))
    throw new BattleError("This battle belongs to other players.", 403);
  const settled = settleBattle(record.state, record.expires_at, Date.now());
  if (settled.status !== record.state.status) {
    await client().rpc("write_puzzle_battle", {
      p_id: id,
      p_version: record.version,
      p_student_id: studentId,
      p_state: settled,
    });
    record = await recordFor(id);
  }
  return battleView(record, await deckFor(id), studentId, Date.now());
}
export async function actOnBattle(
  id: string,
  student: { id: string; name: string },
  action: BattleAction,
) {
  if (
    !action ||
    !["join", "ready", "leave", "move", "finish", "skip"].includes(
      action.type,
    ) ||
    !uuid.test(action.actionId ?? "")
  )
    throw new BattleError("Invalid battle action.");
  for (let attempt = 0; attempt < 4; attempt++) {
    const record = await recordFor(id);
    if (
      action.type !== "join" &&
      !record.state.players.some((p) => p.id === student.id)
    )
      throw new BattleError("This battle belongs to other players.", 403);
    const deck = await deckFor(id),
      state = applyBattleAction(record, deck, student, action, Date.now());
    if (JSON.stringify(state) === JSON.stringify(record.state))
      return battleView(record, deck, student.id, Date.now());
    const { data, error } = await client().rpc("write_puzzle_battle", {
      p_id: id,
      p_version: record.version,
      p_student_id: student.id,
      p_state: state,
    });
    if (error)
      throw new BattleError(
        error.message.includes("current puzzle battle")
          ? error.message
          : "Your move couldn't save. Please retry.",
        409,
      );
    if (data === true)
      return battleView(
        { ...record, state, version: record.version + 1 },
        deck,
        student.id,
        Date.now(),
      );
  }
  throw new BattleError(
    "The battle changed while saving. Refresh and try again.",
    409,
  );
}
export async function joinBattle(
  code: unknown,
  student: { id: string; name: string },
) {
  if (typeof code !== "string" || !/^[0-9A-F]{8}$/i.test(code.trim()))
    throw new BattleError("Enter the 8-character battle code.");
  const { data, error } = await client()
    .from("puzzle_battles")
    .select("id")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (error || !data)
    throw new BattleError("Challenge not found. Check the code.", 404);
  return actOnBattle(data.id, student, {
    type: "join",
    actionId: randomUUID(),
  });
}
export async function listBattles(
  studentId: string,
): Promise<BattleLobbyItem[]> {
  const db = client();
  const [own, open] = await Promise.all([
    db
      .from("puzzle_battles")
      .select(fields)
      .or(`host_id.eq.${studentId},guest_id.eq.${studentId}`)
      .order("created_at", { ascending: false })
      .limit(12),
    db
      .from("puzzle_battles")
      .select(fields)
      .eq("state->>status", "waiting")
      .is("guest_id", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (own.error || open.error)
    throw new BattleError("The battle lobby couldn't load. Please retry.", 503);
  const records = [
    ...new Map(
      [...(own.data ?? []), ...(open.data ?? [])].map((r) => [
        r.id,
        r as BattleRecord,
      ]),
    ).values(),
  ];
  return records.map((record) => {
    const state = settleBattle(record.state, record.expires_at, Date.now());
    return {
      id: record.id,
      code: record.code,
      mode: record.mode,
      duration: record.duration,
      host: state.players[0].name,
      opponent: state.players[1]?.name ?? null,
      status: state.status,
      mine: state.players.some((p) => p.id === studentId),
      winnerId: state.winnerId,
      scores: state.players.map((p) => p.score),
      createdAt: record.created_at,
    };
  });
}
