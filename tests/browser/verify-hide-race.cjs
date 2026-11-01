const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const assert = require("node:assert/strict");
const base = process.env.BATTLE_PREVIEW_URL || "http://127.0.0.1:9486";
(async () => {
  const browser = await chromium.launch({ headless:true, executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
  const ca=await browser.newContext({viewport:{width:1366,height:768}});
  const cb=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  const cc=await browser.newContext();
  for (const context of [ca,cb,cc]) await context.routeWebSocket(/.*/, ws => ws.close());
  const a=await ca.newPage(), b=await cb.newPage();
  for(const page of [a,b]) page.setDefaultTimeout(20000);
  const errors=[];
  for(const page of [a,b]) page.on("pageerror",e=>errors.push(e.message));
  const square=(page,s)=>page.locator(`[data-square="${s}"]`).first().click();
  const result=(page,won)=>page.getByRole("heading",{name:won?"You won! Nicely solved!":"Good effort — keep practicing!"}).waitFor();
  const state=async id=>(await (await ca.request.get(base+"/api/student/puzzle-battles/"+id)).json()).battle;
  const deck=async id=>(await (await ca.request.get(base+"/__qa/deck?id="+id)).json());
  async function rematch(page) {
    const response=page.waitForResponse(r=>r.url().endsWith("/api/student/puzzle-battles")&&r.request().method()==="POST");
    await page.getByRole("button",{name:/^(Accept rematch|Rematch)$/}).click();
    const r=await response; assert.equal(r.status(),201,await r.text());
    return (await r.json()).battle;
  }
  try {
    await a.goto(base+"/__qa/login");
    await b.goto(base+"/__qa/login?user=1");
    await cc.request.get(base+"/__qa/login?user=2");
    await a.getByRole("button",{name:/^Hide and Seek/}).click();
    await a.getByRole("button",{name:"3 min",exact:true}).click();
    const created=a.waitForResponse(r=>r.url().endsWith("/api/student/puzzle-battles")&&r.request().method()==="POST");
    await a.getByRole("button",{name:"Create challenge",exact:true}).click();
    const first=(await (await created).json()).battle;
    await b.getByLabel("Join with a code").fill(first.code);
    await b.getByRole("button",{name:"Join battle",exact:true}).click();
    await a.locator("[data-square]").first().waitFor();
    await b.locator("[data-square]").first().waitFor();
    assert.equal(await a.getByRole("button",{name:"I'm ready",exact:true}).count(),0);
    const firstDeck=await deck(first.id); assert.equal(firstDeck.length,1);
    for(const s of firstDeck[0].puzzle.safeSquares) await square(a,s);
    await result(a,true); await result(b,false);
    assert.ok((await state(first.id)).state.endsAt>Date.now()+60000,"Win does not wait for the timer");
    // Both choose rematch together: the server reuses one room and starts it.
    const [ra,rb]=await Promise.all([rematch(a),rematch(b)]);
    assert.equal(ra.id,rb.id); assert.notEqual(ra.id,first.id);
    await a.locator("[data-square]").first().waitFor();
    await b.locator("[data-square]").first().waitFor();
    const nextDeck=await deck(ra.id); assert.equal(nextDeck.length,1);
    assert.notEqual(nextDeck[0].puzzle.seed,firstDeck[0].puzzle.seed);
    const puzzle=nextDeck[0].puzzle;
    const unsafe=Array.from({length:64},(_,i)=>`${String.fromCharCode(97+i%8)}${1+Math.floor(i/8)}`)
      .find(s=>!puzzle.safeSquares.includes(s)&&!puzzle.pieces.some(p=>p.square===s));
    let release;
    const held=new Promise(resolve=>{release=resolve;}); let dropped=false;
    await b.route("**/api/student/puzzle-battles/"+ra.id,async route=>{
      if(route.request().method()==="POST"&&!dropped){dropped=true;await held;await route.fetch();await route.abort("failed");}
      else await route.continue();
    });
    await square(b,unsafe);
    await b.getByText("Wrong square — you lost this battle.",{exact:true}).waitFor();
    assert.equal(await b.locator("[data-square]:not(:disabled)").count(),0,"Wrong tap locks instantly, before network reply");
    release();
    await result(b,false);
    await b.unroute("**/api/student/puzzle-battles/"+ra.id);
    await result(a,true); await result(b,false);
    const lost=await state(ra.id);
    assert.equal(lost.state.players.find(p=>p.id!==first.me).mistakes,1);
    await b.reload(); await result(b,false);
    // A one-sided request invites only the original opponent, and survives reload.
    const third=await rematch(a);
    const outsider=await cc.request.post(base+"/api/student/puzzle-battles",{data:{action:"join",code:third.code}});
    assert.equal(outsider.status(),403);
    await b.getByRole("button",{name:"Accept rematch",exact:true}).waitFor();
    assert.equal((await rematch(b)).id,third.id);
    await a.locator("[data-square]").first().waitFor();
    await b.locator("[data-square]").first().waitFor();
    await ca.request.get(base+"/__qa/expire?id="+third.id);
    await a.reload(); await b.reload();
    await a.getByRole("heading",{name:"A draw! Well played, both of you."}).waitFor();
    await b.getByRole("heading",{name:"A draw! Well played, both of you."}).waitFor();
    await b.locator("[data-square]").first().waitFor();
    const rematchBox = await b.getByRole("button", { name:"Rematch",exact:true }).boundingBox();
    assert.ok(rematchBox.y + rematchBox.height < 240, "Rematch stays near the top on phones");
    assert.deepEqual(errors,[]);
    await b.screenshot({path:"work/puzzle-battle/hide-race-phone.png"});
    console.log("PASS single-board race: first finish, instant wrong-square loss, lost response/retry, two-way and invited rematches, fresh board, reserved opponent, reload, timeout draw, automatic start.");
  } catch(e) {
    console.error((await b.locator("body").innerText()).slice(-3000));
    await b.screenshot({path:"work/puzzle-battle/hide-race-failure.png"});
    throw e;
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
