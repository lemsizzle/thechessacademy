const { chromium, webkit } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const origin = process.env.STORE_PREVIEW_URL || "http://127.0.0.1:9494";
mkdirSync("work/store-rewards", { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const readState = () =>
    page.evaluate(
      async () => await (await fetch("/api/student/avatar")).json(),
    );
  const readReceipts = () =>
    page.evaluate(
      async () => await (await fetch("/api/student/avatar/rewards")).json(),
    );
  const purchase = async (name) => {
    await page.getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("button", { name: "Confirm purchase", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
  };
  await page.goto(origin);
  await page
    .getByRole("button", { name: "Buy Mystery Box", exact: true })
    .waitFor();
  const before = await readState();
  await purchase("Buy Mystery Box");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "work/store-rewards/box-opening.png" });
  await page
    .getByRole("heading", { name: "A new treasure for you!" })
    .waitFor();
  await page.screenshot({ path: "work/store-rewards/box-reward.png" });
  let receipts = await readReceipts(),
    prize = receipts.receipts[0];
  assert.equal(prize.kind, "mystery_box");
  assert.ok(!before.ownedItemIds.includes(prize.item_id));
  assert.equal(
    (await readState()).wallet.academyCoins,
    before.wallet.academyCoins - 500,
  );
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/student/avatar") &&
        r.request().method() === "PATCH",
    ),
    page.getByRole("button", { name: "Equip item", exact: true }).click(),
  ]);
  assert.ok(
    Object.values((await readState()).avatar.equippedItems).includes(
      prize.item_id,
    ),
  );
  await purchase("Get Free Class");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await purchase("Get Free Class");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.goto(origin + "/?view=trophies");
  await page.getByRole("button", { name: /FREE Class × 2/ }).click();
  await page
    .getByRole("heading", { name: "2 FREE class coupons", exact: true })
    .waitFor();
  await page.screenshot({ path: "work/store-rewards/coupon-stack.png" });
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.goto(origin + "/?view=teacher");
  await page
    .getByRole("button", { name: "Mark redeemed", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll("button").length &&
      [...document.querySelectorAll("button")].filter(
        (e) => e.textContent === "Mark redeemed",
      ).length === 1,
  );
  await page.goto(origin + "/?view=trophies");
  await page.getByRole("button", { name: /FREE Class × 1/ }).waitFor();
  await page.goto(origin + "/?view=teacher");
  await page.getByRole("button", { name: "Refund coins", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByText("No pending class requests.", { exact: true }).waitFor();
  assert.equal(
    (await readState()).wallet.academyCoins,
    before.wallet.academyCoins - 5500,
  );
  // Drop a response AFTER the database committed. Reload must recover, never reroll.
  await page.goto(origin);
  let lostId;
  await page.route(
    "**/api/student/avatar/rewards",
    async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      lostId = route.request().postDataJSON().requestId;
      await route.fetch();
      await route.abort("failed");
    },
    { times: 2 },
  );
  await page
    .getByRole("button", { name: "Buy Mystery Box", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recover purchase", exact: true })
    .waitFor();
  await page.unroute("**/api/student/avatar/rewards");
  const afterLost = await readState();
  const lostPrize = (await readReceipts()).receipts.find(
    (r) => r.id === lostId,
  );
  assert.ok(lostPrize);
  await page.reload();
  await page
    .getByRole("button", { name: "Recover purchase", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skip animation", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "A new treasure for you!" })
    .waitFor();
  assert.equal(
    (await readState()).wallet.academyCoins,
    afterLost.wallet.academyCoins,
  );
  assert.equal(
    (await readReceipts()).receipts.filter((r) => r.id === lostId).length,
    1,
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Buy Mystery Box", exact: true })
      .scrollIntoViewIfNeeded();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `work/store-rewards/store-${viewport.width}.png`,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await purchase("Buy Mystery Box");
  await page
    .getByRole("heading", { name: "A new treasure for you!" })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Skip animation" }).count(),
    0,
  );
  await page.screenshot({ path: "work/store-rewards/reduced-motion.png" });
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  await browser.close();
  const safari = await webkit.launch({ headless: true });
  const phone = await safari.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await phone.goto(origin);
  await phone
    .getByRole("button", { name: "Buy Mystery Box", exact: true })
    .click();
  await phone
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await phone
    .getByRole("heading", { name: "A new treasure for you!" })
    .waitFor();
  await phone.waitForTimeout(600);
  const artwork = await phone
    .getByRole("dialog")
    .locator("[data-avatar-canvas]")
    .boundingBox();
  const title = await phone
    .getByRole("heading", { name: "A new treasure for you!" })
    .boundingBox();
  const name = await phone.getByRole("dialog").locator("h3").boundingBox();
  assert.ok(
    artwork.y >= title.y + title.height && artwork.y + artwork.height <= name.y,
    "prize art must not overlap reward text",
  );
  const box = await phone.getByRole("dialog").boundingBox();
  assert.ok(
    box.x >= 0 &&
      box.x + box.width <= 390 &&
      box.y >= 0 &&
      box.y + box.height <= 844,
  );
  await phone.screenshot({ path: "work/store-rewards/phone-reward.png" });
  await phone.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await phone.getByText(/Possible items & chances/).count(), 0);
  for (let i = 0; i < 2; i++) {
    assert.equal(
      (await phone.request.post(origin + "/__store/prepare-coupon")).status(),
      200,
    );
    await phone.reload();
    await phone
      .getByRole("button", { name: "Buy Mystery Box", exact: true })
      .click();
    await phone
      .getByRole("button", { name: "Confirm purchase", exact: true })
      .click();
    await phone
      .getByRole("button", { name: "Skip animation", exact: true })
      .click();
    await phone
      .getByRole("heading", { name: "Your FREE coupon is ready!" })
      .waitFor();
    await phone.getByRole("dialog").getByRole("img", { name: "FREE class coupon badge" }).waitFor();
    await phone.waitForTimeout(600);
    if (i === 0)
      await phone.screenshot({
        path: "work/store-rewards/box-coupon-phone.png",
      });
    await phone.getByRole("button", { name: "Done", exact: true }).click();
  }
  await phone.goto(origin + "/?view=trophies");
  await phone.getByRole("button", { name: /FREE Class × 2/ }).click();
  await phone
    .getByRole("heading", { name: "2 FREE class coupons", exact: true })
    .waitFor();
  await phone.screenshot({ path: "work/store-rewards/won-coupon-stack.png" });
  const balanceBeforeRefund = await phone.evaluate(
    async () =>
      (await (await fetch("/api/student/avatar")).json()).wallet.academyCoins,
  );
  await phone.goto(origin + "/?view=teacher");
  await phone
    .getByRole("button", { name: "Refund coins", exact: true })
    .first()
    .click();
  await phone
    .getByText(
      "Return 500 coins (the amount paid) and cancel this one coupon?",
      { exact: true },
    )
    .waitFor();
  await phone.getByRole("button", { name: "Confirm", exact: true }).click();
  await phone.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].filter(
        (e) => e.textContent === "Mark redeemed",
      ).length === 1,
  );
  const balanceAfterRefund = await phone.evaluate(
    async () =>
      (await (await fetch("/api/student/avatar")).json()).wallet.academyCoins,
  );
  assert.equal(balanceAfterRefund, balanceBeforeRefund + 500);
  await phone
    .getByRole("button", { name: "Mark redeemed", exact: true })
    .click();
  await phone.getByRole("button", { name: "Confirm", exact: true }).click();
  await phone
    .getByText("No pending class requests.", { exact: true })
    .waitFor();
  await safari.close();
  console.log(
    "PASS: purchases, equip, stacked coupons, teacher redeem/refund, lost-response reload recovery, desktop/tablet/mobile, reduced motion and WebKit.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
