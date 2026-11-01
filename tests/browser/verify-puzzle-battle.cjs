require("tsx/cjs");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const {
  findStarWarsSolution,
  initialStarWarsState,
} = require("../../lib/puzzle-training/starWars.ts");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const base = process.env.BATTLE_PREVIEW_URL || "http://127.0.0.1:9482";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const ca = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    cb = await browser.newContext({ viewport: { width: 1024, height: 768 } }),
    cc = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage(),
    errors = [];
  for (const p of [a, b]) {
    p.setDefaultTimeout(20000);
    p.on("pageerror", (e) => errors.push(e.message));
  }
  await fs.mkdir("work/puzzle-battle", { recursive: true });
  async function state(id, context = ca) {
    const response = await context.request.get(
      `${base}/api/student/puzzle-battles/${id}`,
    );
    assert.equal(response.status(), 200, await response.text());
    return (await response.json()).battle;
  }
  async function square(page, value) {
    await page.locator(`[data-square="${value}"]`).first().click();
  }
  try {
    await a.goto(base + "/__qa/login");
    await b.goto(base + "/__qa/login?user=1");
    await cc.request.get(base + "/__qa/login?user=2");
    for (const [mode, label] of [
      ["survival", "Survival"],
      ["star-wars", "Star Wars"],
      ["hide-and-seek", "Hide and Seek"],
    ]) {
      if (mode !== "survival") {
        await a
          .getByRole("button", { name: "Battle lobby", exact: true })
          .click();
        await b
          .getByRole("button", { name: "Battle lobby", exact: true })
          .click();
      }
      await a.getByRole("button", { name: new RegExp("^" + label) }).click();
      await a.getByRole("button", { name: "1 min", exact: true }).click();
      const response = a.waitForResponse(
        (r) =>
          r.url().endsWith("/api/student/puzzle-battles") &&
          r.request().method() === "POST",
      );
      await a
        .getByRole("button", { name: "Create challenge", exact: true })
        .click();
      const created = await response;
      assert.equal(created.status(), 201, await created.text());
      const battle = (await created.json()).battle;
      await b.getByLabel("Join with a code").fill(battle.code);
      await b.getByRole("button", { name: "Join battle", exact: true }).click();
      await b
        .getByRole("heading", { name: "Both players are here!" })
        .waitFor();
      const forbidden = await cc.request.get(
        `${base}/api/student/puzzle-battles/${battle.id}`,
      );
      assert.equal(forbidden.status(), 403);
      const third = await cc.request.post(
        `${base}/api/student/puzzle-battles`,
        { data: { action: "join", code: battle.code } },
      );
      assert.equal(third.status(), 409);
      await a.reload();
      await a.getByRole("button", { name: "I'm ready", exact: true }).click();
      await b.getByRole("button", { name: "I'm ready", exact: true }).click();
      await a.reload();
      await a.locator("[data-square]").first().waitFor();
      await b.locator("[data-square]").first().waitFor();
      const av = await state(battle.id),
        bv = await state(battle.id, cb);
      assert.deepEqual(av.challenge, bv.challenge);
      assert.equal(av.state.startsAt, bv.state.startsAt);
      const deck = await (
        await ca.request.get(`${base}/__qa/deck?id=${battle.id}`)
      ).json();
      if (mode === "survival") {
        for (const [name, width, height] of [
          ["desktop", 1440, 1000],
          ["tablet-landscape", 1024, 768],
          ["tablet-portrait", 768, 1024],
          ["phone", 390, 844],
        ]) {
          await a.setViewportSize({ width, height });
          await a.waitForTimeout(200);
          assert.equal(
            await a.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            false,
          );
          const box = await a
            .locator("[data-chess-board]")
            .first()
            .boundingBox();
          assert.ok(box.width > Math.min(width, height) * 0.35);
          assert.ok(box.y + box.height <= height, JSON.stringify(box));
          await a.screenshot({ path: `work/puzzle-battle/${name}.png` });
        }
        await a.setViewportSize({ width: 1440, height: 1000 });
        // Save the move, then lose its response. Retrying must not award twice.
        let dropped = false;
        let releaseMove;
        const heldMove = new Promise((resolve) => {
          releaseMove = resolve;
        });
        await a.route(
          `**/api/student/puzzle-battles/${battle.id}`,
          async (route) => {
            if (route.request().method() === "POST" && !dropped) {
              dropped = true;
              await heldMove;
              await route.fetch();
              await route.abort("failed");
            } else await route.continue();
          },
        );
        await square(a, "d8");
        await square(a, "h4");
        await a
          .locator('[data-board-square="h4"]')
          .filter({ hasNotText: "never-matches" })
          .waitFor();
        assert.match(
          await a
            .locator('[data-board-square="h4"]')
            .getAttribute("aria-label"),
          /black queen/i,
          "Piece must move before the answer request is released",
        );
        assert.equal(
          await a.getByTestId("my-score").innerText(),
          "0",
          "Score still waits for server verification",
        );
        releaseMove();
        await a.getByRole("button", { name: "Retry", exact: true }).click();
        await a.unroute(`**/api/student/puzzle-battles/${battle.id}`);
        // A legal but incorrect move costs the opponent one life, no points.
        await square(b, "a7");
        await square(b, "a6");
        await b
          .getByText("Keep going — try the next board.", { exact: true })
          .waitFor();
        assert.equal((await state(battle.id, cb)).state.players[1].mistakes, 1);
      } else if (mode === "star-wars") {
        const moves = findStarWarsSolution(
          initialStarWarsState(deck[0].puzzle),
        );
        assert.ok(moves?.length);
        for (const move of moves) {
          await square(a, move.from);
          await square(a, move.to);
        }
      } else {
        assert.equal(
          await a
            .getByRole("button", { name: "Check board", exact: true })
            .count(),
          0,
        );
        const firstSafe = deck[0].puzzle.safeSquares[0];
        await square(a, firstSafe);
        await square(a, firstSafe);
        assert.equal(
          await a
            .locator(`[data-square="${firstSafe}"]`)
            .getAttribute("aria-pressed"),
          "true",
          "A second tap cannot remove a star",
        );
        for (const squareName of deck[0].puzzle.safeSquares)
          await square(a, squareName);
        const unsafe = Array.from(
          { length: 64 },
          (_, i) =>
            `${String.fromCharCode(97 + (i % 8))}${1 + Math.floor(i / 8)}`,
        ).find(
          (s) =>
            !deck[0].puzzle.safeSquares.includes(s) &&
            !deck[0].puzzle.pieces.some((p) => p.square === s),
        );
        let lostHideResponse = false;
        await b.route(
          `**/api/student/puzzle-battles/${battle.id}`,
          async (route) => {
            if (route.request().method() === "POST" && !lostHideResponse) {
              lostHideResponse = true;
              await route.fetch();
              await route.abort("failed");
            } else await route.continue();
          },
        );
        await square(b, firstSafe);
        await square(b, unsafe);
        await b.getByRole("button", { name: "Retry", exact: true }).waitFor();
        assert.equal(
          await b.locator("[data-square]:not(:disabled)").count(),
          0,
          "Failed save must not reopen a finished board",
        );
        await b.getByRole("button", { name: "Retry", exact: true }).click();
        await b
          .getByText("Keep going — try the next board.", { exact: true })
          .waitFor();
        await b.unroute(`**/api/student/puzzle-battles/${battle.id}`);
        assert.equal(
          (await state(battle.id, cb)).state.players[1].mistakes,
          1,
          "One dangerous tap immediately loses a life",
        );
        await a.screenshot({ path: "work/puzzle-battle/star-detective.png" });
      }
      await a.getByTestId("my-score").filter({ hasText: "1" }).waitFor();
      assert.equal((await state(battle.id)).state.players[0].score, 1);
      await a.reload();
      await a.getByTestId("my-score").filter({ hasText: "1" }).waitFor();
      // Lose a life via an explicit skip, then prove the clock determines the result.
      await a
        .getByRole("button", { name: "Skip · lose one life", exact: true })
        .click();
      await a
        .getByText("Keep going — try the next board.", { exact: true })
        .waitFor();
      assert.equal((await state(battle.id)).state.players[0].mistakes, 1);
      if (mode !== "survival") {
        await ca.request.get(`${base}/__qa/expire?id=${battle.id}`);
        await a.reload();
        await b.reload();
      }
      // Survival runs out naturally, with no reload or manual refresh.
      await a
        .getByRole("heading", { name: "You won! Nicely solved!" })
        .waitFor({ timeout: 70000 });
      await b
        .getByRole("heading", { name: "Good effort — keep practicing!" })
        .waitFor();
      await a.screenshot({ path: `work/puzzle-battle/${mode}-result.png` });
      console.log(
        `PASS ${mode}: two players, same boards/clock, real board solve, skip, reload persistence, deadline, winner/loser, third player blocked.`,
      );
    }
    assert.deepEqual(errors, []);
    console.log("Puzzle Battle browser journeys passed.");
  } catch (error) {
    console.error("Page errors:", errors);
    console.error((await a.locator("body").innerText()).slice(-5000));
    await a.screenshot({ path: "work/puzzle-battle/failure.png" });
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
