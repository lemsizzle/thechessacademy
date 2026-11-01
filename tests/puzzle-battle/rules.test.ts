import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import {
  generateStarWarsPuzzle,
  findStarWarsSolution,
  initialStarWarsState,
} from "@/lib/puzzle-training/starWars";
import { generateHideAndSeekBoard } from "@/lib/puzzle-training/hideAndSeek";
import {
  applyBattleAction,
  battleView,
  newBattlePlayer,
  settleBattle,
} from "@/lib/puzzle-battle/rules";
import type {
  BattleAction,
  BattleChallenge,
  BattleRecord,
} from "@/lib/puzzle-battle/types";
const a = { id: "a", name: "A" },
  b = { id: "b", name: "B" },
  now = Date.parse("2026-11-01T12:00:00Z");
function room(): BattleRecord {
  return {
    id: "room",
    code: "12345678",
    host_id: a.id,
    guest_id: b.id,
    mode: "survival",
    duration: 60,
    version: 0,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + 600000).toISOString(),
    realtime_token: "private",
    state: {
      status: "playing",
      players: [newBattlePlayer(a.id, a.name), newBattlePlayer(b.id, b.name)],
      startsAt: now - 5000,
      endsAt: now + 55000,
      winnerId: null,
    },
  };
}
const chess = new Chess();
["f3", "e5", "g4"].forEach((m) => chess.move(m));
const puzzle: BattleChallenge = {
  kind: "survival",
  puzzle: {
    id: "p",
    initial_fen: chess.fen(),
    moves: ["d8h4"],
    start_mode: "direct",
    accepted_moves: [],
    themes: ["mateIn1"],
    rating: 500,
    game_url: null,
  },
};
const action = (extra: Partial<BattleAction> = {}): BattleAction => ({
  type: "move",
  actionId: "action",
  revision: 0,
  move: { from: "d8", to: "h4" },
  ...extra,
});
describe("Puzzle Battle", () => {
  it("gives both players the same board but never discloses solutions or future boards", () => {
    const r = room(),
      av = battleView(r, [puzzle], a.id, now),
      bv = battleView(r, [puzzle], b.id, now);
    expect(av.challenge).toEqual(bv.challenge);
    expect(JSON.stringify(av)).not.toContain("d8h4");
    expect(av).not.toHaveProperty("deck");
    r.state.startsAt = now + 1000;
    expect(battleView(r, [puzzle], a.id, now).challenge).toBeNull();
    expect(() => battleView(r, [puzzle], "intruder", now)).toThrow(
      "other players",
    );
  });
  it("counts a solve once across retries and stale second tabs", () => {
    const r = room();
    r.state = applyBattleAction(r, [puzzle, puzzle], a, action(), now);
    expect(r.state.players[0].score).toBe(1);
    expect(
      applyBattleAction(r, [puzzle, puzzle], a, action(), now).players[0].score,
    ).toBe(1);
    expect(
      applyBattleAction(
        r,
        [puzzle, puzzle],
        a,
        action({ actionId: "other" }),
        now,
      ).players[0].score,
    ).toBe(1);
  });
  it("rejects illegal movement without a strike, but a wrong legal move uses one life", () => {
    const r = room();
    expect(() =>
      applyBattleAction(
        r,
        [puzzle],
        a,
        action({ move: { from: "d8", to: "a1" } }),
        now,
      ),
    ).toThrow("legal");
    const result = applyBattleAction(
      r,
      [puzzle, puzzle],
      a,
      action({ move: { from: "a7", to: "a6" } }),
      now,
    );
    expect(result.players[0]).toMatchObject({
      score: 0,
      mistakes: 1,
      index: 1,
    });
    expect(result.players[1].mistakes).toBe(0);
  });
  it("keeps the other player playing after three strikes and draws on equal scores", () => {
    const r = room();
    for (let i = 0; i < 3; i++)
      r.state = applyBattleAction(
        r,
        [puzzle, puzzle, puzzle, puzzle],
        a,
        action({ type: "skip", revision: i, actionId: `a${i}` }),
        now,
      );
    expect(r.state.players[0].done).toBe(true);
    expect(r.state.status).toBe("playing");
    const end = settleBattle(r.state, r.expires_at, now + 60000);
    expect(end.status).toBe("finished");
    expect(end.winnerId).toBeNull();
  });
  it("never accepts a solve after the shared deadline or before the countdown", () => {
    const r = room();
    expect(
      applyBattleAction(r, [puzzle], a, action(), r.state.endsAt!).players[0]
        .score,
    ).toBe(0);
    expect(() =>
      applyBattleAction(r, [puzzle], a, action(), r.state.startsAt! - 1),
    ).toThrow("active yet");
  });
  it("starts only when two different players are ready", () => {
    const r = room();
    r.state = {
      ...r.state,
      status: "waiting",
      players: [newBattlePlayer(a.id, a.name)],
      startsAt: null,
      endsAt: null,
    };
    expect(() =>
      applyBattleAction(r, [puzzle], a, action({ type: "ready" }), now),
    ).toThrow("Wait");
    r.state = applyBattleAction(r, [puzzle], b, action({ type: "join" }), now);
    r.state = applyBattleAction(r, [puzzle], a, action({ type: "ready" }), now);
    expect(r.state.status).toBe("waiting");
    r.state = applyBattleAction(r, [puzzle], b, action({ type: "ready" }), now);
    expect(r.state.startsAt).toBe(now + 5000);
    expect(r.state.endsAt).toBe(now + 65000);
    expect(() =>
      applyBattleAction(
        r,
        [puzzle],
        { id: "third", name: "C" },
        action({ type: "join" }),
        now,
      ),
    ).toThrow("no longer open");
  });
  it("cancels waiting rooms and treats leaving a started battle as forfeiting", () => {
    const r = room();
    expect(
      applyBattleAction(r, [puzzle], a, action({ type: "leave" }), now)
        .winnerId,
    ).toBe(b.id);
    r.state.status = "waiting";
    expect(
      applyBattleAction(r, [puzzle], a, action({ type: "leave" }), now).status,
    ).toBe("cancelled");
    expect(settleBattle(r.state, r.expires_at, now + 600001).status).toBe(
      "cancelled",
    );
  });
  it("validates complete Star Wars routes, not client scores", () => {
    const r = room(),
      star = generateStarWarsPuzzle(0, 917),
      deck: BattleChallenge[] = [{ kind: "star-wars", puzzle: star }];
    const moves = findStarWarsSolution(initialStarWarsState(star))!;
    expect(
      applyBattleAction(r, deck, a, action({ type: "finish", moves }), now)
        .players[0].score,
    ).toBe(1);
    expect(() =>
      applyBattleAction(
        r,
        deck,
        a,
        action({ type: "finish", moves: moves.slice(0, 1) }),
        now,
      ),
    ).toThrow("Finish");
  });
  it("requires every safe Hide and Seek square, with no extras", () => {
    const r = room(),
      hide = generateHideAndSeekBoard("battle-test"),
      deck: BattleChallenge[] = [{ kind: "hide-and-seek", puzzle: hide }];
    expect(
      applyBattleAction(
        r,
        deck,
        a,
        action({ type: "finish", squares: [...hide.safeSquares] }),
        now,
      ).players[0].score,
    ).toBe(1);
    expect(
      applyBattleAction(
        r,
        deck,
        a,
        action({ type: "finish", squares: hide.safeSquares.slice(1) }),
        now,
      ).players[0].mistakes,
    ).toBe(1);
    const view = battleView(r, deck, a.id, now);
    expect(view.challenge).not.toHaveProperty("safeSquares");
  });
});
