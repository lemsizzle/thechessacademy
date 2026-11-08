require("tsx/cjs");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || "C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const {findStarWarsSolution,initialStarWarsState}=require("../../lib/puzzle-training/starWars.ts");
const assert=require("node:assert/strict"), fs=require("node:fs");
const base=process.env.BATTLE_PREVIEW_URL || "http://127.0.0.1:9498";
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
  try {
    const tc=await browser.newContext({viewport:{width:1440,height:1000}}), sc=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
    await tc.routeWebSocket(/.*/,ws=>ws.close());await sc.routeWebSocket(/.*/,ws=>ws.close());
    const teacher=await tc.newPage(), student=await sc.newPage(), errors=[];
    for(const p of [teacher,student]) {p.setDefaultTimeout(20000);p.on("pageerror",e=>errors.push(e.message));}
    await teacher.goto(base+"/__qa/teacher");await student.goto(base+"/__qa/login");
    fs.mkdirSync("work/puzzle-tournaments",{recursive:true});
    for(const mode of ["survival","star-wars","hide-and-seek"]) {
      await teacher.goto(base+"/admin/tournaments/puzzle");
      await teacher.getByLabel("Tournament name",{exact:true}).fill(`${mode} Cup`);
      await teacher.getByLabel(/^Battle mode/).selectOption(mode);
      await teacher.getByLabel(/^Time per battle/).selectOption("60");
      await teacher.getByLabel("Number of rounds",{exact:true}).fill("1");
      await teacher.getByRole("button",{name:"Create tournament",exact:true}).click();
      await teacher.getByRole("button",{name:"Add player",exact:true}).waitFor();
      const id=new URL(teacher.url()).searchParams.get("id");
      await teacher.getByLabel("Player name",{exact:true}).fill("Cedar Fox");
      await teacher.getByLabel("Bot Elo",{exact:true}).fill("400");
      await teacher.getByRole("button",{name:"Add player",exact:true}).click();
      await teacher.getByText("Bot · 400 Elo",{exact:true}).waitFor();
      await student.goto(base+"/student/tournaments/puzzle?id="+id);
      await student.getByRole("button",{name:"Join tournament",exact:true}).click();
      await student.getByRole("button",{name:"Leave tournament",exact:true}).waitFor();
      assert.doesNotMatch(await student.locator("body").innerText(),/Bot ·|Bot Elo|Computer opponent/);
      await teacher.getByRole("button",{name:"Refresh",exact:true}).click();
      await teacher.getByRole("button",{name:"Start tournament",exact:true}).waitFor();
      await teacher.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Start tournament'&&!b.disabled));
      await teacher.getByRole("button",{name:"Start tournament",exact:true}).click();
      await teacher.getByText(/Round 1 starts after/).waitFor();
      await student.getByRole("button",{name:"Refresh",exact:true}).click();
      await student.getByRole("link",{name:"Play your battle",exact:true}).waitFor();
      assert.equal(await student.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await student.screenshot({path:`work/puzzle-tournaments/${mode}-lobby-phone.png`,fullPage:true});
      await student.getByRole("link",{name:"Play your battle",exact:true}).click();
      await student.getByRole("link",{name:"Tournament lobby",exact:true}).waitFor();
      const battleId=new URL(student.url()).searchParams.get("id");
      const deck=await(await sc.request.get(base+"/__qa/deck?id="+battleId)).json();
      const square=s=>student.locator(`[data-square="${s}"]`).first().click();
      await student.locator("[data-square]").first().waitFor();
      assert.doesNotMatch(await student.locator("body").innerText(),/Computer opponent|Elo/);
      if(mode==="survival") {
        await square("d8");await square("h4");
        await student.getByTestId("my-score").filter({hasText:"1"}).waitFor();
      } else if(mode==="star-wars") {
        const moves=findStarWarsSolution(initialStarWarsState(deck[0].puzzle));assert.ok(moves?.length);
        let selected=null;for(const m of moves){if(selected!==m.from) await square(m.from);await square(m.to);selected=m.to;}
        await student.getByTestId("my-score").filter({hasText:"1"}).waitFor();
      } else {
        for(const s of deck[0].puzzle.safeSquares) await square(s);
        await student.getByRole("link",{name:"Return to standings",exact:true}).waitFor();
      }
      await student.reload();await student.getByRole("link",{name:"Tournament lobby",exact:true}).waitFor();
      const state=(await(await sc.request.get(base+"/api/student/puzzle-battles/"+battleId)).json()).battle;
      assert.equal(state.state.players[0].score,1);
      assert.equal(state.state.tournament.id,id);
      assert.equal((await sc.request.post(base+"/api/student/puzzle-battles",{data:{action:"rematch",battleId}})).status(),409);
      await tc.request.get(base+"/__qa/tournament-expire");
      await student.getByRole("link",{name:"Tournament lobby",exact:true}).click();
      await student.getByText(/Tournament complete!/).waitFor();
      await student.reload();await student.getByText(/Tournament complete!/).waitFor();
      assert.doesNotMatch(await student.locator("body").innerText(),/Bot ·|Bot Elo|Computer opponent/);
      await teacher.getByRole("button",{name:"Refresh",exact:true}).click();
      await teacher.getByText(/Tournament complete!/).waitFor();
      console.log(mode+": teacher create, private Elo, join, pairing, solving, reload, result passed");
    }
    const anon=await browser.newContext();
    assert.equal((await anon.request.get(base+"/api/admin/puzzle-tournaments")).status(),401);
    assert.equal((await anon.request.get(base+"/api/student/puzzle-tournaments")).status(),401);
    assert.equal((await sc.request.post(base+"/api/student/puzzle-tournaments",{data:{action:"bot",id:crypto.randomUUID()}})).status(),403);
    assert.deepEqual(errors,[]);
    console.log("Puzzle tournament browser checks passed.");
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
