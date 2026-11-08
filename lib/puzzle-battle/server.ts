import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import type { StudentSession } from "@/lib/types";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { BATTLE_BOTS, BATTLE_BOT_LEVELS, type BattleBotLevel } from "./bots";
import { buildBotPlan } from "./botPlan";
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
  type BattleState,
} from "./types";
import {
  applyBattleAction,
  BattleError,
  battleView,
  newBattlePlayer,
  settleBattle,
} from "./rules";

const cache = new Map<string, { until: number; deck: BattleChallenge[] }>();
const positions = new Map<string, { until: number; record: BattleRecord }>();
function viewFor(record: BattleRecord, deck: BattleChallenge[], studentId: string) {
  const previous = positions.get(record.id);
  if (!previous || record.version >= previous.record.version) {
    if (positions.size >= 32 && !positions.has(record.id))
      positions.delete(positions.keys().next().value!);
    positions.set(record.id, { until: Date.now() + 60_000, record });
  }
  return battleView(record, deck, studentId, Date.now());
}
function sessionIdentity(session: StudentSession) {
  return session.authProvider === "academy"
    ? { provider: "academy", username: session.academyUsername }
    : session.authProvider === "supabase"
      ? { provider: "supabase", authUserId: session.authUserId }
      : {
          provider: "lichess",
          lichessId: session.lichessUserId,
          username: session.lichessUsername,
        };
}
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
async function loadForSession(id: string, session: StudentSession) {
  if (!uuid.test(id)) throw new BattleError("Invalid battle.", 404);
  const cached = cache.get(id);
  const warm = cached && cached.until > Date.now();
  const { data, error } = await client().rpc("load_puzzle_battle", {
    p_id: id,
    p_student_id: session.studentId,
    p_identity: sessionIdentity(session),
    p_include_deck: !warm,
  });
  if (error) {
    if (error.code === "28000")
      throw new StudentAuthenticationError("Student login no longer exists.");
    if (error.code === "42501")
      throw new BattleError("This battle belongs to other players.", 403);
    if (error.code === "P0002") throw new BattleError("Battle not found.", 404);
    throw new BattleError("Puzzle Battle couldn't load. Please retry.", 503);
  }
  if (!data?.record || (!warm && !Array.isArray(data.deck)))
    throw new BattleError(
      "The battle boards couldn't load. Please retry.",
      503,
    );
  if (!warm) remember(id, data.deck);
  return data.record as BattleRecord;
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
    return Array.from({ length: 1 }, (_, index) => ({
      kind: mode,
      puzzle: generateHideAndSeekBoard(`${seed}:${index}`),
    }));
  const bands = await Promise.all(
    [
      [400, 800],
      [800, 1100],
      [1100, 1400],
      [1400, 1700],
      [1700, 2100],
    ].map(async ([minimum, maximum]) => {
      const result: BattleChallenge[] = [];
      // Five bounded indexed reads, easy to harder. Snapshot answers once, reuse
      // across both players and hot requests; never download full decks on polls.
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
          throw new BattleError(
            "Puzzle pool couldn't load. Please retry.",
            503,
          );
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
      return result;
    }),
  );
  // Promise.all preserves band order, independently of which query returns first.
  const result = bands.flat();
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
  botLevel?: unknown,
  rematchOf?: string,
) {
  if (
    !BATTLE_MODES.includes(mode as BattleMode) ||
    !BATTLE_TIMES.includes(duration as (typeof BATTLE_TIMES)[number])
  )
    throw new BattleError("Choose a battle mode and time control.");
  if (botLevel !== undefined && !BATTLE_BOT_LEVELS.includes(botLevel as BattleBotLevel))
    throw new BattleError("Choose Gentle, Steady, or Swift for your bot opponent.");
  // Check before expensive preparation as well as atomically inside the RPC.
  const lobby = await listBattles(student.id, true);
  const existing = lobby.find((b) => b.mine && ["waiting", "playing"].includes(b.status));
  // A bot can finish while its page is closed. Settle its scheduled progress
  // before rejecting creation; this also reconciles expired/stale room state.
  const current = existing ? await readBattle(existing.id, student.id) : null;
  if (current && ["waiting", "playing"].includes(current.state.status))
    throw new BattleError(
      "Finish or leave your current puzzle battle first.",
      409,
    );
  const deck = await buildBattleDeck(mode as BattleMode),
    id = randomUUID(),
    code = randomBytes(4).toString("hex").toUpperCase();
  const state: BattleState = {
    status: "waiting",
    players: [newBattlePlayer(student.id, student.name)],
    startsAt: null,
    endsAt: null,
    winnerId: null,
  };
  const plan = botLevel ? buildBotPlan(deck, botLevel as BattleBotLevel) : undefined;
  if (botLevel) {
    const level = botLevel as BattleBotLevel;
    state.players.push(newBattlePlayer(`bot:${level}`, `${BATTLE_BOTS[level].name} Bot`));
    state.status = "playing";
    state.bot = { level, nextAt: null };
    // The database sets the shared countdown and first event from its own clock.
  }
  const { data, error } = await client().rpc(botLevel ? "create_puzzle_bot_battle" : "create_puzzle_battle", {
    p_id: id,
    p_code: code,
    p_student_id: student.id,
    p_mode: mode,
    p_duration: duration,
    p_state: state,
    p_deck: deck,
    ...(plan ? { p_plan: plan, p_source_id: rematchOf ?? null } : {}),
  });
  if (error)
    throw new BattleError(
      error.message.includes("current puzzle battle") ||
      error.message.includes("Please wait")
        ? error.message
        : "Couldn't create the battle. Please retry.",
      error.message.includes("Please wait") ? 429 : 409,
    );
  const createdId = (data as string | null) ?? id;
  if (createdId === id) remember(id, deck);
  return readBattle(createdId, student.id);
}
export async function readBattle(
  id: string,
  studentId: string,
  session?: StudentSession,
) {
  let record = session
    ? await loadForSession(id, session)
    : await recordFor(id);
  if (!record.state.players.some((p) => p.id === studentId))
    throw new BattleError("This battle belongs to other players.", 403);
  if (record.state.bot && !session) {
    const { data, error } = await client().rpc("advance_puzzle_battle_bot", { p_id: id });
    if (error || !data) throw new BattleError("The bot couldn't update. Please retry.", 503);
    record = data as BattleRecord;
  }
  let settled = settleBattle(record.state, record.expires_at, Date.now());
  // Resume two-player rooms created by an older client that still required Ready.
  if (settled.status === "waiting" && settled.players.length === 2)
    settled = applyBattleAction(record, [], { id: studentId, name: "" }, {
      type: "ready", actionId: randomUUID(),
    }, Date.now());
  if (settled.status !== record.state.status) {
    await client().rpc("write_puzzle_battle", {
      p_id: id,
      p_version: record.version,
      p_student_id: studentId,
      p_state: settled,
    });
    record = await recordFor(id);
  }
  return viewFor(record, await deckFor(id), studentId);
}
export async function actOnBattle(
  id: string,
  student: { id: string; name: string },
  action: BattleAction,
  session?: StudentSession,
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
    const saved = positions.get(id);
    const cachedPlayer = saved?.record.state.players.find(
      (p) => p.id === student.id,
    );
    // Only use trusted server state, never a browser-supplied position. A stale
    // personal revision is rejected at save time and retried from the database.
    const now = Date.now();
    const useCached =
      attempt === 0 && session && saved && cachedPlayer &&
      ["move", "finish", "skip"].includes(action.type) &&
      saved.until > now && (cache.get(id)?.until ?? 0) > now &&
      saved.record.state.status === "playing" &&
      saved.record.state.startsAt! <= now && saved.record.state.endsAt! > now &&
      !cachedPlayer.done && cachedPlayer.revision === action.revision &&
      cachedPlayer.lastAction !== action.actionId;
    const record = useCached
      ? saved.record
      : session
        ? await loadForSession(id, session)
        : await recordFor(id);
    if (
      action.type !== "join" &&
      !record.state.players.some((p) => p.id === student.id)
    )
      throw new BattleError("This battle belongs to other players.", 403);
    const deck = await deckFor(id),
      state = applyBattleAction(record, deck, student, action, Date.now());
    if (JSON.stringify(state) === JSON.stringify(record.state)) {
      if (useCached) continue;
      return viewFor(record, deck, student.id);
    }
    if (
      ["move", "finish", "skip"].includes(action.type) &&
      state.players.find((p) => p.id === student.id)!.revision >
        record.state.players.find((p) => p.id === student.id)!.revision
    ) {
      const before = record.state.players.find((p) => p.id === student.id)!;
      const { data, error } = await client().rpc(
        session ? "submit_puzzle_battle_player" : "write_puzzle_battle_player",
        {
          p_id: id,
          p_student_id: student.id,
          p_revision: before.revision,
          p_player: state.players.find((p) => p.id === student.id),
          ...(session ? { p_identity: sessionIdentity(session) } : {}),
        },
      );
      if (error?.code === "28000")
        throw new StudentAuthenticationError("Student login no longer exists.");
      if (error)
        throw new BattleError("Your move couldn't save. Please retry.", 503);
      if (data)
        return viewFor(data as BattleRecord, deck, student.id);
      continue;
    }
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
      return viewFor(
        { ...record, state, version: record.version + 1 },
        deck,
        student.id,
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
export async function rematchBattle(id: unknown, student: { id: string; name: string }) {
  if (typeof id !== "string" || !uuid.test(id)) throw new BattleError("Invalid battle.", 404);
  const previous = await readBattle(id, student.id);
  if (previous.state.tournament) throw new BattleError("Return to the tournament lobby for your next pairing.", 409);
  if (previous.state.status !== "finished" || previous.state.players.length !== 2)
    throw new BattleError("Finish this battle before a rematch.", 409);
  if (previous.state.bot) {
    if (previous.state.rematchId) return readBattle(previous.state.rematchId, student.id);
    return createBattle(student, previous.mode, previous.duration, previous.state.bot.level, id);
  }
  let nextId = previous.state.rematchId;
  if (nextId) {
    const next = await recordFor(nextId);
    if (settleBattle(next.state, next.expires_at, Date.now()).status === "cancelled")
      nextId = undefined;
  }
  if (!nextId) {
    const deck = await buildBattleDeck(previous.mode);
    const proposedId = randomUUID();
    const opponent = previous.state.players.find((p) => p.id !== student.id)!;
    const { data, error } = await client().rpc("rematch_puzzle_battle", {
      p_source_id: id, p_student_id: student.id, p_id: proposedId,
      p_code: randomBytes(4).toString("hex").toUpperCase(),
      p_state: {
        status: "waiting", players: [newBattlePlayer(student.id, student.name)],
        startsAt: null, endsAt: null, winnerId: null, invitedId: opponent.id,
      },
      p_deck: deck,
    });
    if (error || !data) throw new BattleError(error?.message.includes("current puzzle battle") || error?.message.includes("Please wait") ? error.message : "Couldn't start the rematch. Please retry.", error?.message.includes("Please wait") ? 429 : 409);
    nextId = data as string;
    if (nextId === proposedId) remember(nextId, deck);
  }
  return actOnBattle(nextId, student, { type: "join", actionId: randomUUID() });
}
export async function listBattles(
  studentId: string,
  includeOwnBattles = false,
): Promise<BattleLobbyItem[]> {
  const db = client();
  const [own, open] = await Promise.all([
    includeOwnBattles ? db
      .from("puzzle_battles")
      .select(fields)
      .or(`host_id.eq.${studentId},guest_id.eq.${studentId}`)
      .in("state->>status", ["waiting", "playing"])
      .order("created_at", { ascending: false })
      .limit(12) : Promise.resolve({ data: [], error: null }),
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
  return records.filter((record) => (
    includeOwnBattles || (record.state.status === "waiting" && record.guest_id === null &&
      record.state.players.length === 1 && Date.parse(record.expires_at) > Date.now())
  ) && (!record.state.invitedId || record.state.invitedId === studentId ||
    record.host_id === studentId || record.guest_id === studentId)
  ).map((record) => {
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

export async function battleLobby(studentId: string) {
  const items = await listBattles(studentId, true);
  return {
    // Keep the public challenge list limited to joinable seats. A student's
    // unfinished room belongs in its own recovery card, never hidden history.
    battles: items.filter(item => item.status === "waiting" && !item.opponent),
    currentBattle: items.find(item => item.mine && ["waiting", "playing"].includes(item.status)) ?? null,
  };
}
