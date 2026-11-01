// Real Next handlers + isolated PostgreSQL, two signed test users. Never writes
// to production. All outgoing non-local requests are rejected.
const http = require("node:http");
const { createHmac, randomUUID } = require("node:crypto");
const { Chess } = require("chess.js");
const port = Number(process.env.BATTLE_PREVIEW_PORT || 9482),
  dbPort = port + 1,
  origin = `http://127.0.0.1:${port}`;
const secret = "puzzle-battle-isolated-session-secret";
Object.assign(process.env, {
  NODE_ENV: "production",
  STUDENT_SESSION_SECRET: secret,
  SUPABASE_SERVICE_ROLE_KEY: "local-fixture-only",
  NEXT_PUBLIC_APP_URL: origin,
});
const students = ["A", "B", "C"].map((letter, i) => ({
  id: `30000000-0000-4000-8000-00000000000${i + 1}`,
  name: `Explorer ${letter}`,
  username: `battle_${letter.toLowerCase()}`,
}));
function json(res, data, status = 200, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(data));
}
function scalar(value) {
  return value instanceof Date ? value.toISOString() : String(value);
}
function filtered(rows, params) {
  const get = (row, key) =>
    key.includes("->>")
      ? row[key.split("->>")[0]]?.[key.split("->>")[1]]
      : row[key];
  for (const [key, value] of params) {
    if (key === "or") {
      const conditions = value.replace(/^\(|\)$/g, "").split(",");
      rows = rows.filter((row) =>
        conditions.some((v) => {
          const [field, , target] = v.split(".");
          return scalar(get(row, field)) === target;
        }),
      );
      continue;
    }
    if (key === "order") {
      const [field, dir] = value.split(".");
      rows.sort(
        (a, b) =>
          scalar(get(a, field)).localeCompare(scalar(get(b, field))) *
          (dir === "desc" ? -1 : 1),
      );
      continue;
    }
    if (key === "limit" || key === "select") continue;
    const [op, ...parts] = value.split("."),
      target = parts.join(".");
    if (op === "eq")
      rows = rows.filter((row) => scalar(get(row, key)) === target);
    if (op === "is")
      rows = rows.filter((row) =>
        target === "null"
          ? get(row, key) == null
          : scalar(get(row, key)) === target,
      );
    if (op === "gte")
      rows = rows.filter(
        (row) =>
          get(row, key) >= Number(target) || scalar(get(row, key)) >= target,
      );
    if (op === "gt")
      rows = rows.filter(
        (row) =>
          get(row, key) > Number(target) || scalar(get(row, key)) > target,
      );
    if (op === "lt")
      rows = rows.filter(
        (row) =>
          get(row, key) < Number(target) || scalar(get(row, key)) < target,
      );
  }
  return rows.slice(0, Number(params.get("limit") ?? rows.length));
}
(async () => {
  const { createBattleTestDatabase } = await import(
    "../fixtures/puzzle-battle-db.mjs"
  );
  const pg = await createBattleTestDatabase();
  for (const student of students) {
    await pg.query("insert into students(id) values($1)", [student.id]);
    await pg.query("insert into student_login_credentials values($1,$2)", [
      student.id,
      student.username,
    ]);
  }
  const chess = new Chess();
  ["f3", "e5", "g4"].forEach((move) => chess.move(move));
  const puzzles = Array.from({ length: 100 }, (_, i) => ({
    id: randomUUID(),
    initial_fen: process.env.BATTLE_MULTIMOVE ? new Chess().fen() : chess.fen(),
    moves: process.env.BATTLE_MULTIMOVE ? ["e2e4", "a7a6", "e4e5", "b7b6", "e5e6"] : ["d8h4"],
    start_mode: "direct",
    accepted_moves: [],
    themes: ["mateIn1"],
    rating: 500 + Math.floor(i / 20) * 300,
    game_url: null,
    is_active: true,
    source_kind: "lichess",
    random_key: (i % 20) / 20,
  }));
  const db = http.createServer(async (req, res) => {
    try {
      const delay = Number(process.env.BATTLE_DB_DELAY_MS || 0);
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const url = new URL(req.url, origin),
        table = url.pathname.split("/").pop();
      if (url.pathname.includes("/rpc/")) {
        let text = "";
        for await (const chunk of req) text += chunk;
        const args = JSON.parse(text || "{}");
        if (table === "load_puzzle_battle")
          return json(
            res,
            (
              await pg.query("select load_puzzle_battle($1,$2,$3,$4) value", [
                args.p_id,
                args.p_student_id,
                JSON.stringify(args.p_identity),
                args.p_include_deck,
              ])
            ).rows[0].value,
          );
        if (table === "submit_puzzle_battle_player")
          return json(res, (await pg.query(
            "select submit_puzzle_battle_player($1,$2,$3,$4,$5) value",
            [args.p_id, args.p_student_id, JSON.stringify(args.p_identity), args.p_revision, JSON.stringify(args.p_player)]
          )).rows[0].value);
        if (table === "rematch_puzzle_battle")
          return json(res, (await pg.query(
            "select rematch_puzzle_battle($1,$2,$3,$4,$5,$6) value",
            [args.p_source_id, args.p_student_id, args.p_id, args.p_code, JSON.stringify(args.p_state), JSON.stringify(args.p_deck)]
          )).rows[0].value);
        if (table === "write_puzzle_battle_player")
          return json(
            res,
            (
              await pg.query(
                "select write_puzzle_battle_player($1,$2,$3,$4) value",
                [
                  args.p_id,
                  args.p_student_id,
                  args.p_revision,
                  JSON.stringify(args.p_player),
                ],
              )
            ).rows[0].value,
          );
        if (table === "create_puzzle_battle") {
          const values = [
            args.p_id,
            args.p_code,
            args.p_student_id,
            args.p_mode,
            args.p_duration,
            JSON.stringify(args.p_state),
            JSON.stringify(args.p_deck),
          ];
          return json(
            res,
            (
              await pg.query(
                "select create_puzzle_battle($1,$2,$3,$4,$5,$6,$7) value",
                values,
              )
            ).rows[0].value,
          );
        }
        if (table === "write_puzzle_battle")
          return json(
            res,
            (
              await pg.query("select write_puzzle_battle($1,$2,$3,$4) value", [
                args.p_id,
                args.p_version,
                args.p_student_id,
                JSON.stringify(args.p_state),
              ])
            ).rows[0].value,
          );
        return json(res, []);
      }
      if (!["GET", "HEAD"].includes(req.method))
        return json(res, { message: "Unrelated write blocked" }, 403);
      let rows =
        table === "students"
          ? students.map((s) => ({
              id: s.id,
              display_name: s.name,
              is_active: true,
              lichess_id: null,
              lichess_username: null,
            }))
          : table === "student_login_credentials"
            ? students.map((s) => ({ student_id: s.id, username: s.username }))
            : table === "chess_puzzles"
              ? puzzles
              : ["puzzle_battles", "puzzle_battle_decks"].includes(table)
                ? (await pg.query(`select * from ${table}`)).rows
                : [];
      rows = filtered(rows, url.searchParams);
      return json(
        res,
        (req.headers.accept || "").includes("vnd.pgrst.object")
          ? (rows[0] ?? null)
          : rows,
        200,
        { "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` },
      );
    } catch (error) {
      console.error(error.message);
      return json(res, { message: error.message, code: error.code }, 400);
    }
  });
  const nativeFetch = global.fetch;
  global.fetch = (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : (input.url ?? String(input)),
    );
    if (url.pathname.startsWith("/rest/v1/"))
      return nativeFetch(
        `http://127.0.0.1:${dbPort}${url.pathname}${url.search}`,
        init,
      );
    if (!["localhost", "127.0.0.1"].includes(url.hostname))
      throw new Error("External network blocked in battle QA");
    return nativeFetch(input, init);
  };
  db.listen(dbPort, "127.0.0.1", async () => {
    const app = require("next")({ dev: false, hostname: "127.0.0.1", port });
    await app.prepare();
    const handler = app.getRequestHandler();
    http
      .createServer(async (req, res) => {
        const url = new URL(req.url, origin);
        if (url.pathname === "/__qa/login") {
          const student =
            students[Number(url.searchParams.get("user") ?? 0)] ?? students[0];
          const session = {
            id: randomUUID(),
            studentId: student.id,
            name: student.name,
            role: "student",
            authProvider: "academy",
            academyUsername: student.username,
            onboardingCompleted: true,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          };
          const payload = Buffer.from(JSON.stringify(session)).toString(
              "base64url",
            ),
            sig = createHmac("sha256", secret)
              .update(payload)
              .digest("base64url");
          res.writeHead(302, {
            "Set-Cookie": `quest_board_student_session=${payload}.${sig}; Path=/; HttpOnly; SameSite=Lax`,
            Location: "/student/training/battle",
          });
          return res.end();
        }
        if (url.pathname === "/__qa/deck")
          return json(
            res,
            (
              await pg.query(
                "select challenges from puzzle_battle_decks where battle_id=$1",
                [url.searchParams.get("id")],
              )
            ).rows[0]?.challenges ?? [],
          );
        if (url.pathname === "/__qa/expire") {
          await pg.query(
            "update puzzle_battles set state=jsonb_set(state,'{endsAt}',to_jsonb($2::numeric)) where id=$1",
            [url.searchParams.get("id"), Date.now() - 100],
          );
          return json(res, { ok: true });
        }
        if (
          url.pathname.startsWith("/api/") &&
          !url.pathname.startsWith("/api/student/puzzle-battles") &&
          !["/api/auth/session", "/api/student/profile"].includes(url.pathname)
        ) {
          if (url.pathname === "/api/student/online-play")
            return json(res, {
              state: {
                students: [],
                incoming: [],
                outgoing: [],
                activeGameId: null,
              },
            });
          if (url.pathname === "/api/student/board-themes")
            return json(res, { ownedThemes: [] });
          return json(res, {
            ok: true,
            incoming: [],
            outgoing: [],
            activeGames: [],
            unreadCount: 0,
            realtimeTopic: null,
            games: [],
            awards: [],
            events: [],
            items: [],
            avatar: { equippedItems: {} },
          });
        }
        return handler(req, res);
      })
      .listen(port, "127.0.0.1", () =>
        console.log(
          `Puzzle Battle QA ready: ${origin}/__qa/login (second student: ?user=1)`,
        ),
      );
  });
})();
