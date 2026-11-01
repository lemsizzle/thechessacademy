require("tsx/cjs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { findStarWarsSolution, initialStarWarsState } = require("../../lib/puzzle-training/starWars.ts");
const assert = require("node:assert/strict");
const base = process.env.BATTLE_PREVIEW_URL || "http://127.0.0.1:9482";
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
  const context = await browser.newContext({viewport:{width:1366,height:900},hasTouch:true});
  await context.routeWebSocket(/.*/,ws=>ws.close());
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  const errors=[]; page.on("pageerror",e=>errors.push(e.message));
  const square = s => page.locator(`[data-square="${s}"]`).first().click();
  const state = async id => (await (await context.request.get(base+"/api/student/puzzle-battles/"+id)).json()).battle;
  const deck = async id => (await (await context.request.get(base+"/__qa/deck?id="+id)).json());
  async function postClick(name) {
    const reply = page.waitForResponse(r=>r.url().endsWith("/api/student/puzzle-battles")&&r.request().method()==="POST");
    await page.getByRole("button",{name,exact:true}).click();
    const response=await reply; assert.equal(response.status(),201,await response.text());
    return (await response.json()).battle;
  }
  try {
    await page.goto(base+"/__qa/login");
    await page.getByRole("button",{name:"Computer",exact:true}).click();
    for (const [label,level,viewport] of [
      ["Survival","Swift",{width:1366,height:900}],
      ["Star Wars","Steady",{width:1024,height:768}],
      ["Hide and Seek","Gentle",{width:390,height:844}],
    ]) {
      await page.setViewportSize(viewport);
      await page.getByRole("button",{name:new RegExp("^"+label)}).click();
      await page.getByRole("button",{name:level,exact:true}).click();
      await page.getByRole("button",{name:"1 min",exact:true}).click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await page.screenshot({path:`work/puzzle-battle/bot-lobby-${level}.png`});
      const battle=await postClick("Play against bot");
      assert.equal(battle.state.status,"playing");
      assert.equal(battle.state.bot.level,level.toLowerCase());
      assert.equal(battle.state.players[1].id,"bot:"+level.toLowerCase());
      assert.ok(!JSON.stringify(battle).includes("solved"));
      assert.equal((await (await context.request.get(base+"/api/student/puzzle-battles")).json()).battles.length,0);
      await page.getByText("Get ready!",{exact:true}).waitFor();
      await page.locator("[data-square]").first().waitFor();
      const firstDeck=await deck(battle.id);
      if(label==="Survival") {
        await square("d8"); await square("h4");
        await page.getByTestId("my-score").filter({hasText:"1"}).waitFor();
        // Wait for a naturally scheduled bot event, with no test clock or state reads.
        let reads=0;
        const count=r=>{if(r.method()==="GET"&&r.url().endsWith("/"+battle.id)) reads++;};
        page.on("request",count);
        let dropped=false;
        await page.route("**/api/student/puzzle-battles/"+battle.id,async route=>{
          if(route.request().method()==="GET"&&!dropped&&Date.now()>=battle.state.bot.nextAt) {
            dropped=true; await route.abort("failed");
          } else await route.continue();
        });
        await page.waitForTimeout(Math.max(0,battle.state.bot.nextAt-Date.now()+6800));
        await page.unroute("**/api/student/puzzle-battles/"+battle.id);
        assert.equal(dropped,true,"Exercise a failed bot boundary refresh");
        page.off("request",count);
        assert.ok(reads<=3,`Event-driven bot should not poll each second (${reads})`);
        const progressed=await state(battle.id);
        assert.ok(progressed.state.players[1].index>=1);
        assert.equal(Number(await page.getByTestId("opponent-score").innerText()),progressed.state.players[1].score);
        await page.reload(); await page.locator("[data-square]").first().waitFor();
        const resumed=await state(battle.id);
        assert.equal(resumed.state.startsAt,battle.state.startsAt);
        assert.equal(resumed.state.players[0].score,1);
      } else if(label==="Star Wars") {
        const moves=findStarWarsSolution(initialStarWarsState(firstDeck[0].puzzle));
        assert.ok(moves?.length); let selected=null;
        for(const move of moves) {if(selected!==move.from) await square(move.from);await square(move.to);selected=move.to;}
        await page.getByTestId("my-score").filter({hasText:"1"}).waitFor();
      } else {
        assert.equal(firstDeck.length,1);
        for(const safe of firstDeck[0].puzzle.safeSquares) await square(safe);
        await page.getByRole("heading",{name:"You won! Nicely solved!"}).waitFor();
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await page.screenshot({path:`work/puzzle-battle/bot-match-${level}.png`});
      if(label!=="Hide and Seek") {
        await page.getByRole("button",{name:"Leave battle",exact:true}).click();
        await page.getByRole("button",{name:"Confirm leave",exact:true}).click();
        await page.getByRole("heading",{name:"Good effort — keep practicing!"}).waitFor();
      } else {
        const next=await postClick("Rematch");
        assert.notEqual(next.id,battle.id); assert.equal(next.state.bot.level,"gentle");
        assert.equal(next.state.status,"playing");
        const fresh=await deck(next.id); assert.notEqual(fresh[0].puzzle.seed,firstDeck[0].puzzle.seed);
        await page.locator("[data-square]").first().waitFor();
        const puzzle=fresh[0].puzzle;
        const unsafe=Array.from({length:64},(_,i)=>`${String.fromCharCode(97+i%8)}${1+Math.floor(i/8)}`)
          .find(s=>!puzzle.safeSquares.includes(s)&&!puzzle.pieces.some(p=>p.square===s));
        await square(unsafe);
        await page.getByRole("heading",{name:"Good effort — keep practicing!"}).waitFor();
        await page.reload();
        await page.getByRole("heading",{name:"Good effort — keep practicing!"}).waitFor();
      }
      await page.getByRole("button",{name:"New challenge",exact:true}).click();
    }
    assert.deepEqual(errors,[]);
    console.log("PASS bot browser: all three modes/difficulties, automatic countdown, natural bot updates with bounded reads, real board solves, reload, forfeit, Hide race/rematch/wrong-square loss, desktop/tablet/phone.");
  } catch(error) {
    console.error((await page.locator("body").innerText()).slice(-4000));
    await page.screenshot({path:"work/puzzle-battle/bot-failure.png"});
    throw error;
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
