const {chromium}=require(process.env.PLAYWRIGHT_MODULE || "C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const assert=require("node:assert/strict"),{randomUUID}=require("node:crypto"),fs=require("node:fs");
const base=process.env.BATTLE_PREVIEW_URL || "http://127.0.0.1:9498";
const seconds=s=>{const [m,n]=s.trim().split(':').map(Number);return m*60+n;};
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
  try {
    const tc=await browser.newContext({viewport:{width:1440,height:1000}}),sc=await browser.newContext();
    await tc.routeWebSocket(/.*/,ws=>ws.close());await sc.routeWebSocket(/.*/,ws=>ws.close());
    const teacher=await tc.newPage(),student=await sc.newPage(),errors=[];
    for(const p of [teacher,student]) {p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));}
    await teacher.goto(base+'/__qa/teacher');await student.goto(base+'/__qa/login');
    await tc.request.get(base+'/__qa/tournament-expire');
    const act=async(data)=>{const r=await tc.request.post(base+'/api/admin/puzzle-tournaments',{data});assert.equal(r.status(),200);return(await r.json()).tournament;};
    let t=await act({action:'create',requestId:randomUUID(),title:'Clock Cup',mode:'survival',duration:60,rounds:2});
    t=await act({action:'bot',id:t.id,requestId:randomUUID(),name:'Cedar Fox',elo:400});
    assert.equal((await sc.request.post(base+'/api/student/puzzle-tournaments',{data:{action:'join',id:t.id}})).status(),200);
    t=(await(await tc.request.get(base+'/api/admin/puzzle-tournaments?id='+t.id)).json()).tournament;
    t=await act({action:'start',id:t.id,version:t.version});
    await teacher.goto(base+'/admin/tournaments/puzzle?id='+t.id);
    const timer=teacher.getByTestId('teacher-round-timer');
    await timer.getByText('Round starts in',{exact:true}).waitFor();
    const duel=t.matches.find(m=>m.battleId);
    await student.goto(base+'/student/training/battle?id='+duel.battleId);
    await timer.getByText('Round time left',{exact:true}).waitFor();
    await student.getByTestId('battle-clock').waitFor();
    const read=async()=>seconds(await timer.getByRole('timer').innerText());
    assert.ok(Math.abs(await read()-seconds(await student.getByTestId('battle-clock').innerText()))<=1);
    let polls=0;teacher.on('request',r=>{if(r.url().includes('/api/admin/puzzle-tournaments'))polls++;});
    const before=await read();await teacher.waitForTimeout(2200);assert.ok(await read()<before);assert.ok(polls<=1);
    await teacher.reload();await teacher.getByTestId('teacher-round-timer').getByText('Round time left',{exact:true}).waitFor();
    assert.ok(Math.abs(await read()-seconds(await student.getByTestId('battle-clock').innerText()))<=1);
    fs.mkdirSync('work/puzzle-tournaments',{recursive:true});
    await teacher.screenshot({path:'work/puzzle-tournaments/teacher-round-timer-desktop.png',fullPage:true});
    await teacher.setViewportSize({width:390,height:844});
    assert.equal(await teacher.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await timer.scrollIntoViewIfNeeded();await teacher.screenshot({path:'work/puzzle-tournaments/teacher-round-timer-phone.png'});
    await tc.request.get(base+'/__qa/tournament-expire');
    await teacher.getByRole('button',{name:'Refresh',exact:true}).click();
    await timer.getByText('Round 2 of 2',{exact:true}).waitFor();
    await timer.getByText('Round starts in',{exact:true}).waitFor();
    await act({action:'cancel',id:t.id});
    await teacher.getByRole('button',{name:'Refresh',exact:true}).click();
    await timer.getByText('Tournament cancelled',{exact:true}).waitFor();assert.equal(await read(),0);
    assert.deepEqual(errors,[]);
    console.log('Teacher timer: pre-round, ticking, student sync, reload, desktop/mobile, automatic next round, cancellation, and request budget passed.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
