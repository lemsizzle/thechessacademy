// Run against scripts/serve-gameplay-harness.mjs with key-moments-harness.jsx.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.KEY_MOMENTS_URL || "http://127.0.0.1:9497");
    const click = (name) => page.getByRole("button", { name, exact: true }).click();
    const move = async (from, to) => {
      await page.locator(`[data-square="${from}"]`).first().click();
      await page.locator(`[data-square="${to}"]`).first().click();
    };
    const open = () => page.getByRole("button", { name: /Review \d key moment/ }).click();
    await click("Find my key moments");
    await page.getByRole("button", { name: /Review \d key moment/ }).waitFor({ timeout: 30000 });
    await open();
    assert.match(await page.locator("body").innerText(), /hangs your queen on d4/);
    await click("Hint");
    assert.match(await page.locator("body").innerText(), /Look at your queen on d4/);
    await click("Another hint");
    assert.match(await page.locator("body").innerText(), /Try moving your queen from d4 to/);
    await move("h1", "h2");
    await page.getByText(/Kh2 still gives too much away/).waitFor();
    await move("d4", "g4");
    await page.getByText("Good move — Qg4!", { exact: true }).waitFor({ timeout: 15000 });
    await page.getByText("Board unlocked", { exact: true }).waitFor();
    await move("e8", "f7");
    await page.getByText("1 exploration move played", { exact: true }).waitFor();
    await click("Undo move");
    assert.equal(await page.getByRole("button", { name: "Undo move", exact: true }).isEnabled(), false);
    await click("Exit mistake practice");
    await open();
    // Exit while an uncached, non-shortlisted move is being evaluated.
    await move("h1", "g1");
    await click("Exit mistake practice");
    await page.waitForTimeout(1500);
    assert.equal(await page.getByText(/Good move —/).count(), 0);
    await open();
    assert.equal(await page.getByRole("button", { name: "Hint", exact: true }).isEnabled(), true);
    // Engine startup errors must restore the board and allow a retry.
    await page.route("**/vendor/stockfish/**", (route) => route.abort());
    await move("h1", "g1");
    await page.getByRole("alert").waitFor({ timeout: 15000 });
    assert.equal(await page.getByText("Checking your move…", { exact: true }).count(), 0);
    await page.unroute("**/vendor/stockfish/**");
    await click("Hint");
    await click("Show a good move");
    await page.getByText(/One good move:/).waitFor();
    await click("Exit mistake practice");
    await page.setViewportSize({ width: 390, height: 844 });
    await open();
    await click("Hint");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    fs.mkdirSync("work/key-moments", { recursive: true });
    await page.screenshot({ path: "work/key-moments/phone.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: "work/key-moments/desktop.png", fullPage: true });
    assert.deepEqual(errors, []);
    console.log("Key moments passed: real engine, hints, wrong move, good alternative, exploration, cancellation, recovery, phone layout.");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
