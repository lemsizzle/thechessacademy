const {chromium}=require(process.env.PLAYWRIGHT_MODULE || "C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const assert=require("node:assert/strict"),fs=require("node:fs"),{randomUUID}=require("node:crypto");
const base=process.env.BATTLE_PREVIEW_URL || "http://127.0.0.1:9498";
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
  try {
    const tc=await browser.newContext(),sc=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
    await tc.routeWebSocket(/.*/,ws=>ws.close());await sc.routeWebSocket(/.*/,ws=>ws.close());
    const teacher=await tc.newPage(),student=await sc.newPage(),errors=[];
    student.setDefaultTimeout(25000);student.on("pageerror",e=>errors.push(e.message));
    await teacher.goto(base+"/__qa/teacher");await student.goto(base+"/__qa/login");
    await tc.request.get(base+"/__qa/tournament-expire");
    const action=async(data)=>{
      const response=await tc.request.post(base+"/api/admin/puzzle-tournaments",{data});assert.equal(response.status(),200);
      return (await response.json()).tournament;
    };
    let t=await action({action:"create",requestId:randomUUID(),title:"Automatic Round Cup",mode:"hide-and-seek",duration:60,rounds:2});
    t=await action({action:"bot",id:t.id,requestId:randomUUID(),name:"Cedar Fox",elo:400});
    await student.goto(base+"/student/tournaments/puzzle?id="+t.id);
    await student.getByRole("button",{name:"Join tournament",exact:true}).click();
    await student.getByRole("button",{name:"Leave tournament",exact:true}).waitFor();
    t=(await(await tc.request.get(base+"/api/admin/puzzle-tournaments?id="+t.id)).json()).tournament;
    t=await action({action:"start",id:t.id,version:t.version});
    await teacher.close(); // No teacher page remains to advance rounds.
    await student.getByRole("button",{name:"Refresh",exact:true}).click();
    await student.getByText(/Round 1 starts in/).waitFor();
    await student.getByRole("link",{name:"Play your battle",exact:true}).click();
    await student.getByRole("link",{name:"Tournament lobby",exact:true}).waitFor();
    const first=new URL(student.url()).searchParams.get("id");
    await student.locator("[data-square]").first().waitFor();
    const deck=await(await sc.request.get(base+"/__qa/deck?id="+first)).json();
    const p=deck[0].puzzle;
    const unsafe=Array.from({length:64},(_,i)=>"abcdefgh"[i%8]+(1+Math.floor(i/8))).find(s=>!p.safeSquares.includes(s)&&!p.pieces.some(x=>x.square===s));
    await student.locator(`[data-square="${unsafe}"]`).first().click();
    await student.waitForURL(url=>url.searchParams.get("id")!==first);
    const second=new URL(student.url()).searchParams.get("id");assert.ok(second);
    const next=(await(await sc.request.get(base+"/api/student/puzzle-tournaments?id="+t.id)).json()).tournament;
    assert.equal(next.round,2);assert.ok(next.roundStartsAt>Date.now());
    assert.equal(next.matches.filter(m=>m.round===2).length,1);
    const concurrent=await Promise.all(Array.from({length:5},()=>sc.request.get(base+"/api/student/puzzle-tournaments?id="+t.id)));
    for(const r of concurrent) assert.equal((await r.json()).tournament.round,2);
    await student.reload();
    await student.getByRole("link",{name:"Tournament lobby",exact:true}).waitFor();
    assert.equal(new URL(student.url()).searchParams.get("id"),second);
    fs.mkdirSync("work/puzzle-tournaments",{recursive:true});
    await student.screenshot({path:"work/puzzle-tournaments/auto-round-countdown.png",fullPage:true});
    await student.locator("[data-square]").first().waitFor();
    const deck2=await(await sc.request.get(base+"/__qa/deck?id="+second)).json();
    for(const square of deck2[0].puzzle.safeSquares) await student.locator(`[data-square="${square}"]`).first().click();
    await student.getByText("Tournament complete! See the final standings below.",{exact:true}).waitFor();
    const final=(await(await sc.request.get(base+"/api/student/puzzle-tournaments?id="+t.id)).json()).tournament;
    assert.equal(final.status,"finished");assert.equal(final.round,2);assert.equal(final.matches.length,2);
    assert.ok(final.entries.every(e=>e.elo===undefined&&e.studentId===null));
    assert.deepEqual(errors,[]);
    console.log("Automatic round handoff, countdown, concurrent reads, reload, privacy, and final-round stop passed with teacher page closed.");
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
