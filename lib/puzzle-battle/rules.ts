import type { Square } from "chess.js";
import {
  firstStudentMoveIndex,
  prepareTrainingPuzzle,
  replayPuzzleToIndex,
  validatePuzzleMove,
} from "@/lib/puzzle-training/engine";
import {
  attemptStarWarsMove,
  initialStarWarsState,
} from "@/lib/puzzle-training/starWars";
import { hideAndSeekBoardFen } from "@/lib/puzzle-training/hideAndSeek";
import type {
  BattleAction,
  BattleChallenge,
  BattlePlayer,
  BattleRecord,
  BattleState,
  BattleView,
  PublicChallenge,
} from "./types";

export class BattleError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function newBattlePlayer(id: string, name: string): BattlePlayer {
  return {
    id,
    name: name.slice(0, 60),
    ready: true,
    score: 0,
    mistakes: 0,
    index: 0,
    moveIndex: 0,
    revision: 0,
    done: false,
    forfeited: false,
    lastAction: null,
  };
}
export function settleBattle(
  state: BattleState,
  expiresAt: string,
  now: number,
): BattleState {
  const next = structuredClone(state);
  if (next.status === "waiting" && now >= Date.parse(expiresAt))
    next.status = "cancelled";
  if (
    next.status === "playing" &&
    (now >= next.endsAt! ||
      next.players.every((p) => p.done) ||
      next.players.some((p) => p.forfeited))
  ) {
    next.status = "finished";
    const [a, b] = next.players;
    next.winnerId = a.forfeited
      ? b.id
      : b.forfeited
        ? a.id
        : a.score === b.score
          ? null
          : a.score > b.score
            ? a.id
            : b.id;
  }
  return next;
}
function currentMoveIndex(player: BattlePlayer, challenge: BattleChallenge) {
  return (
    player.moveIndex ||
    (challenge.kind === "survival"
      ? firstStudentMoveIndex(challenge.puzzle)
      : 0)
  );
}
export function applyBattleAction(
  record: BattleRecord,
  deck: BattleChallenge[],
  student: { id: string; name: string },
  action: BattleAction,
  now: number,
) {
  const state = settleBattle(record.state, record.expires_at, now);
  if (action.type === "join") {
    if (state.players.some((p) => p.id === student.id)) return state;
    if (state.status !== "waiting" || state.players.length !== 1)
      throw new BattleError("This challenge is no longer open.", 409);
    if (state.invitedId && state.invitedId !== student.id)
      throw new BattleError("This rematch is reserved for the previous opponent.", 403);
    state.players.push(newBattlePlayer(student.id, student.name));
    state.players.forEach((p) => { p.ready = true; });
    state.status = "playing";
    state.startsAt = now + 5000;
    state.endsAt = state.startsAt + record.duration * 1000;
    return state;
  }
  const player = state.players.find((p) => p.id === student.id);
  if (!player)
    throw new BattleError("This battle belongs to other players.", 403);
  // The expected personal revision prevents retries/second tabs counting twice.
  if (player.lastAction === action.actionId) return state;
  if (state.status === "finished" || state.status === "cancelled") return state;
  if (action.type === "leave") {
    if (state.status === "waiting") state.status = "cancelled";
    else {
      player.forfeited = true;
      player.done = true;
    }
  } else if (action.type === "ready") {
    // Older clients can still send ready after the automatic countdown starts.
    if (state.status === "playing") return state;
    if (state.status !== "waiting" || state.players.length !== 2)
      throw new BattleError("Wait for your opponent to join.");
    state.players.forEach((p) => { p.ready = true; });
    state.status = "playing";
    state.startsAt = now + 5000;
    state.endsAt = state.startsAt + record.duration * 1000;
  } else {
    if (state.status !== "playing" || now < state.startsAt! || player.done)
      throw new BattleError("The board is not active yet.", 409);
    if (action.revision !== player.revision) return state;
    const challenge = deck[player.index];
    if (!challenge) throw new BattleError("No more boards in this battle.");
    let solved = false,
      failed = action.type === "skip";
    if (!failed && challenge.kind === "survival" && action.type === "move") {
      if (
        !action.move ||
        !/^[a-h][1-8]$/.test(action.move.from) ||
        !/^[a-h][1-8]$/.test(action.move.to)
      )
        throw new BattleError("Choose a valid move.");
      const result = validatePuzzleMove(
        challenge.puzzle,
        currentMoveIndex(player, challenge),
        action.move,
      );
      // Illegal drops do not use a life; legal but incorrect solutions do.
      if (!result.accepted && !result.attemptedMoveUci)
        throw new BattleError("That move isn't legal.");
      solved = result.completed;
      failed = !result.accepted;
      player.moveIndex = result.nextMoveIndex;
    } else if (
      !failed &&
      challenge.kind === "star-wars" &&
      action.type === "finish"
    ) {
      if (
        !Array.isArray(action.moves) ||
        !action.moves.length ||
        action.moves.length > 12
      )
        throw new BattleError("Invalid star route.");
      let route = initialStarWarsState(challenge.puzzle);
      for (const move of action.moves) {
        if (
          solved ||
          failed ||
          !/^[a-h][1-8]$/.test(move?.from) ||
          !/^[a-h][1-8]$/.test(move?.to)
        )
          throw new BattleError("Invalid star route.");
        const result = attemptStarWarsMove(route, move);
        if (result.status === "illegal")
          throw new BattleError("Invalid star move.");
        route = result.state;
        solved = result.status === "solved";
        failed = result.status === "failed";
      }
      if (!solved && !failed)
        throw new BattleError("Finish the route before submitting.");
    } else if (
      !failed &&
      challenge.kind === "hide-and-seek" &&
      action.type === "finish"
    ) {
      if (
        !Array.isArray(action.squares) ||
        action.squares.length > 64 ||
        action.squares.some((s) => !/^[a-h][1-8]$/.test(s))
      )
        throw new BattleError("Invalid square selection.");
      const selected = new Set(action.squares);
      if (
        selected.size !== action.squares.length ||
        challenge.puzzle.pieces.some((p) => selected.has(p.square))
      )
        throw new BattleError("Choose empty squares once each.");
      failed = [...selected].some(
        (s) => !challenge.puzzle.safeSquares.includes(s as Square),
      );
      solved = selected.size === challenge.puzzle.safeSquares.length && !failed;
      if (!solved && !failed)
        throw new BattleError(
          "Find every safe square to finish this Star Detective board.",
        );
    } else if (!failed)
      throw new BattleError("That action doesn't belong to this mode.");
    if (solved || failed) {
      player.score += Number(solved);
      player.mistakes += Number(failed);
      player.index++;
      player.moveIndex = 0;
    }
    player.done = player.mistakes >= 3 || player.index >= deck.length;
    if (record.mode === "hide-and-seek" && (solved || failed)) {
      player.done = true;
      state.status = "finished";
      state.winnerId = solved
        ? player.id
        : state.players.find((p) => p.id !== player.id)!.id;
    }
  }
  player.revision++;
  player.lastAction = action.actionId;
  return settleBattle(state, record.expires_at, now);
}
export function publicChallenge(
  deck: BattleChallenge[],
  player: BattlePlayer,
): PublicChallenge | null {
  const item = deck[player.index];
  if (!item || player.done) return null;
  if (item.kind === "survival") {
    const prepared = prepareTrainingPuzzle(item.puzzle);
    return {
      kind: item.kind,
      boardId: item.puzzle.id,
      index: player.index,
      fen: replayPuzzleToIndex(
        item.puzzle,
        currentMoveIndex(player, item),
      ).fen(),
      orientation: prepared.orientation,
    };
  }
  if (item.kind === "star-wars")
    return {
      kind: item.kind,
      boardId: item.puzzle.id,
      index: player.index,
      fen: initialStarWarsState(item.puzzle).fen,
      orientation: "white",
      stars: [...item.puzzle.stars],
      movableSquares: [...item.puzzle.movableSquares],
    };
  return {
    kind: item.kind,
    boardId: item.puzzle.seed,
    index: player.index,
    fen: hideAndSeekBoardFen(item.puzzle.pieces),
    orientation: "white",
    totalSafe: item.puzzle.safeSquares.length,
  };
}
export function battleView(
  record: BattleRecord,
  deck: BattleChallenge[],
  studentId: string,
  now: number,
): BattleView {
  const state = settleBattle(record.state, record.expires_at, now);
  const me = state.players.find((p) => p.id === studentId);
  if (!me) throw new BattleError("This battle belongs to other players.", 403);
  return {
    id: record.id,
    code: record.code,
    mode: record.mode,
    duration: record.duration,
    version: record.version,
    state,
    me: studentId,
    serverNow: now,
    expiresAt: record.expires_at,
    topic: `puzzle-battle:${record.id}:${record.realtime_token}`,
    challenge: state.status === "playing"
      ? publicChallenge(deck, me)
      : state.status === "finished" && record.mode === "hide-and-seek"
        ? publicChallenge(deck, { ...me, index: Math.min(me.index, deck.length - 1), done: false })
        : null,
    totalChallenges: deck.length,
  };
}
