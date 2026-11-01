import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createBattleTestDatabase } from "../fixtures/puzzle-battle-db.mjs";
const db = await createBattleTestDatabase();
const a = randomUUID(),
  b = randomUUID(),
  third = randomUUID(),
  id = randomUUID(),
  auth = randomUUID();
const player = (id) => ({
  id,
  name: "Test",
  ready: true,
  score: 0,
  mistakes: 0,
  index: 0,
  moveIndex: 0,
  revision: 0,
  done: false,
  forfeited: false,
  lastAction: null,
});
const state = {
  status: "playing",
  players: [player(a), player(b)],
  startsAt: Date.now() - 1000,
  endsAt: Date.now() + 60000,
  winnerId: null,
};
const load = (who, identity, deck = false) =>
  db.query("select load_puzzle_battle($1,$2,$3,$4) value", [
    id,
    who,
    JSON.stringify(identity),
    deck,
  ]);
const patch = (who, revision, p) =>
  db.query("select write_puzzle_battle_player($1,$2,$3,$4) value", [
    id,
    who,
    revision,
    JSON.stringify(p),
  ]);
try {
  await db.query("insert into students(id) values($1),($2),($3)", [
    a,
    b,
    third,
  ]);
  await db.query(
    "insert into student_login_credentials values($1,$2),($3,$4)",
    [a, "first", third, "third"],
  );
  await db.query(
    "update students set lichess_id=$1,lichess_username=$2 where id=$3",
    ["lichess-test", "PlayerTwo", b],
  );
  await db.query("insert into student_registration_accounts values($1,$2)", [
    b,
    auth,
  ]);
  await db.exec("set role service_role");
  await db.query("select create_puzzle_battle($1,$2,$3,$4,$5,$6,$7)", [
    id,
    id.slice(0, 8),
    a,
    "survival",
    60,
    JSON.stringify({ ...state, status: "waiting", players: [player(a)] }),
    JSON.stringify([{ kind: "fixture" }]),
  ]);
  await db.query("update puzzle_battles set guest_id=$1,state=$2 where id=$3", [
    b,
    JSON.stringify(state),
    id,
  ]);
  assert.equal(
    (await load(a, { provider: "academy", username: "first" }, true)).rows[0]
      .value.deck.length,
    1,
  );
  assert.equal(
    (await load(a, { provider: "academy", username: "first" })).rows[0].value
      .deck,
    undefined,
    "Warm reads must not resend decks",
  );
  await load(b, {
    provider: "lichess",
    lichessId: "mismatch",
    username: "playertwo",
  });
  await load(b, { provider: "supabase", authUserId: auth });
  await assert.rejects(
    () => load(a, { provider: "academy", username: "wrong" }),
    /login/,
  );
  await assert.rejects(
    () => load(b, { provider: "supabase", authUserId: randomUUID() }),
    /login/,
  );
  await assert.rejects(
    () => load(third, { provider: "academy", username: "third" }),
    /other players/,
  );
  // Both answer from the same snapshot. Opponent writes need no retries.
  const pa = {
    ...player(a),
    score: 1,
    index: 1,
    revision: 1,
    lastAction: randomUUID(),
  };
  const pb = {
    ...player(b),
    score: 1,
    index: 1,
    revision: 1,
    lastAction: randomUUID(),
  };
  assert.equal((await patch(a, 0, pa)).rows[0].value.version, 1);
  const result = (await patch(b, 0, pb)).rows[0].value;
  assert.deepEqual(
    result.state.players.map((p) => p.score),
    [1, 1],
  );
  assert.equal(result.version, 2);
  assert.equal(
    (await patch(a, 0, pa)).rows[0].value,
    null,
    "Duplicate personal revision must not score again",
  );
  await assert.rejects(
    () => patch(a, 1, { ...pb, revision: 2 }),
    /Invalid player/,
  );
  await patch(a, 1, { ...pa, revision: 2, done: true });
  const done = (await patch(b, 1, { ...pb, revision: 2, done: true })).rows[0]
    .value;
  assert.equal(done.state.status, "finished");
  assert.equal(done.state.winnerId, null);
  await db.query("update puzzle_battles set state=$1 where id=$2", [
    JSON.stringify({ ...state, endsAt: Date.now() - 1 }),
    id,
  ]);
  assert.equal(
    (await patch(a, 0, pa)).rows[0].value.state.players[0].score,
    0,
    "Late answer cannot score",
  );
  await db.exec("reset role");
  await db.query("update students set is_active=false where id=$1", [a]);
  await db.exec("set role service_role");
  await assert.rejects(
    () => load(a, { provider: "academy", username: "first" }),
    /profile/,
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(
      () => load(a, { provider: "academy", username: "first" }),
      /permission/,
    );
    await assert.rejects(() => patch(a, 0, pa), /permission/);
  }
  console.log(
    "PASS fast database: active credentials, membership, private decks, independent simultaneous scores, duplicate rejection, deadline, completion, service-only RPCs.",
  );
} finally {
  await db.close();
}
