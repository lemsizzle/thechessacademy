// Run against the isolated preview with BATTLE_MULTIMOVE=1.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const base = process.env.BATTLE_PREVIEW_URL || "http://127.0.0.1:9486";
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
  try {
    for (const [name, width, height, touch] of [["desktop",1440,1000,false],["tablet",1024,768,true],["phone",390,844,true]]) {
      const ca = await browser.newContext({ viewport: { width,height }, hasTouch: touch });
      const cb = await browser.newContext();
      const page = await ca.newPage();
      const errors=[]; page.on("pageerror",e=>errors.push(e.message));
      await ca.request.get(base+"/__qa/login");
      await cb.request.get(base+"/__qa/login?user=1");
      async function post(context,path,data) {
        const r=await context.request.post(base+path,{data});
        assert.ok(r.ok(),await r.text()); return (await r.json()).battle;
      }
      const battle = await post(ca,"/api/student/puzzle-battles",{mode:"survival",duration:180});
      const path="/api/student/puzzle-battles/"+battle.id;
      await post(cb,"/api/student/puzzle-battles",{action:"join",code:battle.code});
      await post(ca,path,{type:"ready",actionId:randomUUID()});
      await post(cb,path,{type:"ready",actionId:randomUUID()});
      await page.goto(base+"/student/training/battle?id="+battle.id);
      await page.locator('[data-square="e2"]').first().waitFor();
      const click=async(s)=> {
        const target=page.locator(`[data-square="${s}"]`).first();
        if(touch) await target.tap(); else await target.click();
      };
      const reply=()=>page.waitForResponse(r=>r.url().endsWith(path)&&r.request().method()==="POST");
      // Desktop begins with a drag; touch screens begin with two taps.
      let pending=reply();
      if(name==="desktop") {
        const from=await page.locator('[data-square="e2"]').first().boundingBox();
        const to=await page.locator('[data-square="e4"]').first().boundingBox();
        await page.mouse.move(from.x+from.width/2,from.y+from.height/2);
        await page.mouse.down(); await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8}); await page.mouse.up();
      } else { await click("e2"); await click("e4"); }
      let result=(await (await pending).json()).battle;
      assert.equal(result.state.players[0].moveIndex,2);
      await page.waitForFunction(()=>document.querySelector('[data-board-square="a6"]')?.getAttribute("aria-label")?.includes("black pawn"));
      // No re-selection of e4: only tap the next destination.
      pending=reply(); await click("e5");
      result=(await (await pending).json()).battle;
      assert.equal(result.state.players[0].moveIndex,4);
      await page.waitForFunction(()=>document.querySelector('[data-board-square="b6"]')?.getAttribute("aria-label")?.includes("black pawn"));
      pending=reply(); await click("e6");
      result=(await (await pending).json()).battle;
      assert.equal(result.state.players[0].score,1);
      await page.getByText("Solved! +1 point",{exact:true}).waitFor();
      assert.equal(await page.getByTestId("my-score").innerText(),"1");
      // New board has no retained selection. Selecting another piece still works.
      await click("e2"); await click("g1"); await click("e2");
      let failed=false;
      await page.route("**"+path,async route=>{
        if(route.request().method()==="POST"&&!failed){failed=true;await route.abort("failed");}
        else await route.continue();
      });
      await click("e4");
      await page.waitForFunction(()=>document.querySelector('[data-board-square="a6"]')?.getAttribute("aria-label")?.includes("black pawn"));
      await page.unroute("**"+path);
      // Retry restores authoritative state; explicitly select the piece after a failed save.
      if(await page.locator('[data-board-square="e4"]').getAttribute('aria-pressed')!=="true") await click("e4");
      pending=reply(); await click("e5");
      result=(await (await pending).json()).battle;
      assert.equal(result.state.players[0].moveIndex,4);
      assert.equal(result.state.players[0].score,1);
      assert.deepEqual(errors,[]);
      await page.screenshot({path:`work/puzzle-battle/continuation-${name}.png`});
      await post(ca,path,{type:"leave",actionId:randomUUID()});
      await ca.close(); await cb.close();
      console.log(`PASS ${name}: consecutive destinations, drag/tap, piece switching, new board reset, failed request/retry.`);
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
