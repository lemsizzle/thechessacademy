import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createBattleTestDatabase } from "../fixtures/puzzle-battle-db.mjs";
const db = await createBattleTestDatabase();
const a = randomUUID(),
  b = randomUUID(),
  c = randomUUID(),
  id = randomUUID();
const player = (id) => ({
  id,
  name: id,
  score: 0,
  index: 0,
  revision: 0,
  ready: false,
  mistakes: 0,
  done: false,
  forfeited: false,
});
let state = {
  status: "waiting",
  players: [player(a)],
  startsAt: null,
  endsAt: null,
  winnerId: null,
};
const create = (host, battle = randomUUID()) =>
  db.query("select create_puzzle_battle($1,$2,$3,$4,$5,$6,$7)", [
    battle,
    battle.slice(0, 8),
    host,
    "survival",
    60,
    JSON.stringify({ ...state, players: [player(host)] }),
    JSON.stringify([{ kind: "fixture" }]),
  ]);
const write = (who, version, next) =>
  db.query("select write_puzzle_battle($1,$2,$3,$4) ok", [
    id,
    version,
    who,
    JSON.stringify(next),
  ]);
try {
  await db.query("insert into students values($1),($2),($3)", [a, b, c]);
  await db.exec("set role service_role");
  await create(a, id);
  await assert.rejects(() => create(a), /current puzzle battle/);
  state.players.push(player(b));
  assert.equal((await write(b, 0, state)).rows[0].ok, true);
  assert.equal(
    (await write(c, 0, { ...state, players: [player(a), player(c)] })).rows[0]
      .ok,
    false,
  );
  assert.equal(
    (await write(b, 0, state)).rows[0].ok,
    false,
    "stale update cannot overwrite",
  );
  await assert.rejects(() => create(b), /current puzzle battle/);
  const playing = {
    ...state,
    status: "playing",
    startsAt: Date.now() - 2000,
    endsAt: Date.now() + 60000,
  };
  assert.equal((await write(a, 1, playing)).rows[0].ok, true);
  const expired = { ...playing, endsAt: Date.now() - 1000 };
  await db.query("update puzzle_battles set state=$1 where id=$2", [
    JSON.stringify(expired),
    id,
  ]);
  assert.equal(
    (
      await write(a, 2, {
        ...playing,
        players: [{ ...player(a), score: 1 }, player(b)],
      })
    ).rows[0].ok,
    false,
    "server clock rejects late score",
  );
  assert.equal(
    (await write(a, 2, { ...expired, status: "finished" })).rows[0].ok,
    true,
  );
  await create(b);
  await db.exec("reset role;set role anon");
  await assert.rejects(
    () => db.query("select * from puzzle_battle_decks"),
    /permission denied/,
  );
  await assert.rejects(() => create(c), /permission denied/);
  await db.exec("reset role;set role authenticated");
  await assert.rejects(() => write(a, 3, state), /permission denied/);
  console.log(
    "PASS database: atomic joins, stale version rejection, one active battle per student, deadline enforcement, resuming after finish, private answers and RPC permissions.",
  );
} finally {
  await db.close();
}
