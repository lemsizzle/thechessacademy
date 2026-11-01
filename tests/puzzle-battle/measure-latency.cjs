// Isolated preview only. Model a remote DB with BATTLE_DB_DELAY_MS=100.
const assert = require("node:assert/strict");
const base = process.env.BATTLE_PREVIEW_URL || "http://127.0.0.1:9484";
const { randomUUID } = require("node:crypto");
(async () => {
  const cookies = await Promise.all(
    [0, 1].map(async (user) => {
      const r = await fetch(`${base}/__qa/login?user=${user}`, {
        redirect: "manual",
      });
      return r.headers.get("set-cookie").split(";")[0];
    }),
  );
  async function api(path, who = 0, body) {
    const r = await fetch(base + path, {
      headers: { cookie: cookies[who], "Content-Type": "application/json" },
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json();
    assert.ok(r.ok, JSON.stringify(data));
    return data.battle;
  }
  let a = await api("/api/student/puzzle-battles", 0, {
    mode: "survival",
    duration: 180,
  });
  let b = await api("/api/student/puzzle-battles", 1, {
    action: "join",
    code: a.code,
  });
  const path = `/api/student/puzzle-battles/${a.id}`;
  a = await api(path, 0, { type: "ready", actionId: randomUUID() });
  b = await api(path, 1, { type: "ready", actionId: randomUUID() });
  await new Promise((r) =>
    setTimeout(r, Math.max(0, b.state.startsAt - Date.now() + 50)),
  );
  a = await api(path);
  b = await api(path, 1);
  const samples = [];
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(
      a.challenge,
      b.challenge,
      "Both students must get the same board at every index",
    );
    const start = performance.now();
    [a, b] = await Promise.all(
      [a, b].map((v, who) =>
        api(path, who, {
          type: "move",
          actionId: randomUUID(),
          revision: v.state.players.find((p) => p.id === v.me).revision,
          move: { from: "d8", to: "h4" },
        }),
      ),
    );
    samples.push(Math.round(performance.now() - start));
    assert.equal(a.state.players.find((p) => p.id === a.me).score, i + 1);
    assert.equal(b.state.players.find((p) => p.id === b.me).score, i + 1);
  }
  console.log(
    JSON.stringify({
      concurrentAnswersMs: samples,
      medianMs: [...samples].sort((a, b) => a - b)[2],
    }),
  );
  await api(path, 0, { type: "leave", actionId: randomUUID() });
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
