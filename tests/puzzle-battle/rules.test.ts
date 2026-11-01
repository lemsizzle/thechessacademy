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
  it("keeps the same complete deck order for both players, even at different speeds", () => {
    for (const kind of ["survival", "star-wars", "hide-and-seek"] as const) {
      const deck: BattleChallenge[] = Array.from({ length: kind === "hide-and-seek" ? 1 : 50 }, (_, i) =>
        kind === "survival"
          ? { ...puzzle, puzzle: { ...puzzle.puzzle, id: `shared-${i}` } }
          : kind === "star-wars"
            ? { kind, puzzle: generateStarWarsPuzzle(i, 419) }
            : { kind, puzzle: generateHideAndSeekBoard(`shared-${i}`) },
      );
      const r = room();
      for (let i = 0; i < deck.length; i++) {
        r.state.players[0].index = i;
        const first = battleView(r, deck, a.id, now).challenge;
        r.state.players[1].index = i;
        expect(battleView(r, deck, b.id, now).challenge).toEqual(first);
      }
    }
  }, 15000);
  it("gives both players the same board but never discloses solutions or future boards", () => {
    const r = room(),
      av = battleView(r, [puzzle], a.id, now),
      bv = battleView(r, [puzzle], b.id, now);
    expect(av.challenge).toEqual(bv.challenge);
    expect(JSON.stringify(av)).not.toContain("d8h4");
    expect(av).not.toHaveProperty("deck");
    r.state.startsAt = now + 1000;
    // Preload the shared position during the countdown, without any solution.
    expect(battleView(r, [puzzle], a.id, now).challenge).toEqual(av.challenge);
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
  it("starts a shared countdown automatically when a second different player joins", () => {
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
    expect(r.state.status).toBe("playing");
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
    r.mode = "hide-and-seek";
    const solved = applyBattleAction(r, deck, a, action({ type: "finish", squares: [...hide.safeSquares] }), now);
    expect(solved.status).toBe("finished");
    expect(solved.winnerId).toBe(a.id);
    expect(battleView({ ...r, state: solved }, deck, a.id, now).challenge?.boardId).toBe(hide.seed);
    expect(
      applyBattleAction(
        r,
        deck,
        a,
        action({ type: "finish", squares: [...hide.safeSquares] }),
        now,
      ).players[0].score,
    ).toBe(1);
    expect(() =>
      applyBattleAction(
        r,
        deck,
        a,
        action({ type: "finish", squares: hide.safeSquares.slice(1) }),
        now,
      ),
    ).toThrow("Find every safe square");
    const unsafe = Array.from(
      { length: 64 },
      (_, i) =>
        `${String.fromCharCode(97 + (i % 8))}${1 + Math.floor(i / 8)}` as import("chess.js").Square,
    ).find(
      (s) =>
        !hide.safeSquares.includes(s) &&
        !hide.pieces.some((p) => p.square === s),
    )!;
    const failed = applyBattleAction(
      r,
      deck,
      a,
      action({ type: "finish", squares: [hide.safeSquares[0], unsafe] }),
      now,
    );
    expect(failed.players[0]).toMatchObject({
      score: 0,
      mistakes: 1,
      index: 1,
    });
    expect(failed.status).toBe("finished");
    expect(failed.winnerId).toBe(b.id);
    expect(applyBattleAction({ ...r, state: solved }, deck, b, action({ type: "finish", squares: [...hide.safeSquares] }), now).winnerId).toBe(a.id);
    expect(
      applyBattleAction(
        { ...r, state: failed },
        deck,
        a,
        action({ type: "finish", squares: [hide.safeSquares[0], unsafe] }),
        now,
      ).players[0].mistakes,
    ).toBe(1);
    expect(() =>
      applyBattleAction(
        r,
        deck,
        a,
        action({ type: "finish", squares: [hide.pieces[0].square] }),
        now,
      ),
    ).toThrow("empty squares");
    const view = battleView(r, deck, a.id, now);
    expect(view.challenge).not.toHaveProperty("safeSquares");
  });
  it("reserves rematches for the original opponent", () => {
    const r = room();
    r.state = { ...r.state, status: "waiting", players: [newBattlePlayer(a.id, a.name)], invitedId: b.id };
    expect(() => applyBattleAction(r, [puzzle], { id: "c", name: "C" }, action({ type: "join" }), now)).toThrow("reserved");
    expect(applyBattleAction(r, [puzzle], b, action({ type: "join" }), now).status).toBe("playing");
  });
});
