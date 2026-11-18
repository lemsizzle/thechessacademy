const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const base = process.env.ENDGAME_PREVIEW_URL || 'http://127.0.0.1:9504';
const storageKey = 'chessquest:endgames:v1:30000000-0000-4000-8000-000000000001';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.routeWebSocket(/.*/, ws=>ws.close());
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/__qa/login'); await page.goto(base+'/student/training/endgames');
    let coldDownloads=0;
    await page.route('**/stockfish-18-lite-single.wasm',async route=>{
      if (++coldDownloads === 1) await new Promise(resolve=>setTimeout(resolve,18000));
      await route.continue();
    });
    const start=()=>page.getByRole('button',{name:'New position: King & queen checkmate',exact:true}).click();
    const ready=()=>page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Hint'&&!b.disabled));
    const board=page.getByTestId('endgame-board');
    await start(); await page.getByText('Still preparing your computer opponent.',{exact:false}).waitFor();
    await board.waitFor(); await ready();
    console.log('Cold 18-second download succeeds.');
    await page.unroute('**/stockfish-18-lite-single.wasm');
    const initialBalance=await (await context.request.get(base+'/__qa/endgame-balance')).json();
    let loseReceipt=true;
    await page.route('**/api/student/endgames',async route=>{
      if (route.request().postDataJSON().action==='complete' && loseReceipt) {
        loseReceipt=false; const response=await route.fetch(); assert.equal(response.status(),200);
        return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Simulated lost reward receipt; please retry.'})});
      }
      await route.continue();
    });
    // Test driver computes learner moves independently; never clicks the app's
    // hint button for the positive reward case. The defender remains real.
    const bestMove=fen=>page.evaluate(async fen=>{
      if (!window.qaEndgameEngine) {
        const worker=new Worker('/vendor/stockfish/stockfish-18-lite-single.js');
        const ready=new Promise((resolve,reject)=>{
          worker.onerror=()=>reject(new Error('QA engine failed'));
          worker.onmessage=e=>{if(e.data==='uciok')worker.postMessage('isready');if(e.data==='readyok')resolve();};
          worker.postMessage('uci');
        });
        window.qaEndgameEngine={worker,ready};
      }
      const {worker,ready}=window.qaEndgameEngine;await ready;
      return new Promise(resolve=>{
        worker.onmessage=e=>{if(String(e.data).startsWith('bestmove '))resolve(String(e.data).split(' ')[1]);};
        worker.postMessage('position fen '+fen);worker.postMessage('go movetime 350');
      });
    },fen);
    const playMove=async uci=>{
      const b=await board.boundingBox(),color=await board.getAttribute('data-color');
      for(const square of [uci.slice(0,2),uci.slice(2,4)]){
        const f=square.charCodeAt(0)-97,r=Number(square[1])-1;
        await page.mouse.click(b.x+((color==='white'?f:7-f)+.5)*b.width/8,b.y+((color==='white'?7-r:r)+.5)*b.height/8);
      }
    };
    const finish=async()=>{
      for(let turn=0;turn<65;turn++){
        if(await page.getByRole('heading',{name:'Win converted!',exact:true}).count()) return;
        await ready(); const before=await board.getAttribute('data-fen'); const uci=await bestMove(before);
        assert.doesNotThrow(()=>new Chess(before).move({from:uci.slice(0,2),to:uci.slice(2,4)}));
        await playMove(uci);
        await page.waitForFunction(before=>document.querySelector('[data-testid="endgame-board"]')?.getAttribute('data-fen')!==before && ([...document.querySelectorAll('button')].some(b=>b.textContent==='Hint'&&!b.disabled)||[...document.querySelectorAll('h2')].some(h=>h.textContent==='Win converted!')),before);
      }
      throw new Error('Generated queen ending did not finish');
    };
    await finish(); await page.getByRole('button',{name:'Retry reward save'}).click();
    await page.getByText('3 XP + 3 coins earned for this position',{exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('[data-session-xp]')?.textContent==='3'&&document.querySelector('[data-session-coins]')?.textContent==='3');
    const balance=await (await context.request.get(base+'/__qa/endgame-balance')).json();
    assert.equal(balance.xp-initialBalance.xp,3);assert.equal(balance.coins-initialBalance.coins,3);assert.equal(balance.events-initialBalance.events,1);
    const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).attempts['queen-mate'],storageKey);
    const won=await saved();
    const completion={action:'complete',token:won.rewardToken,candidateIndex:won.candidateIndex,moves:won.moves,assisted:false};
    const duplicate=await context.request.post(base+'/api/student/endgames',{data:completion});assert.equal(duplicate.status(),200);assert.equal((await duplicate.json()).awarded,false);
    await page.reload();await page.getByText('3 XP + 3 coins earned for this position',{exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('[data-session-xp]')?.textContent==='3');
    const second=await browser.newContext();await second.request.get(base+'/__qa/login?user=1');
    assert.equal((await second.request.post(base+'/api/student/endgames',{data:completion})).status(),400);await second.close();
    assert.equal((await context.request.post(base+'/api/student/endgames',{data:{...completion,moves:[]}})).status(),400);
    await page.getByRole('button',{name:'All endgames'}).click();await start();await board.waitFor();await ready();
    await page.getByRole('button',{name:'Hint',exact:true}).click();await page.locator('[role="status"]').filter({hasText:/^Try /}).waitFor();
    await page.getByRole('button',{name:'Retry position',exact:true}).click();await page.reload();await ready();
    await page.getByText('Practice with help · no reward for this position',{exact:true}).waitFor();
    await finish();
    assert.equal(await page.locator('[data-session-xp]').textContent(),'3');
    const helped=await saved();
    const forged=await context.request.post(base+'/api/student/endgames',{data:{action:'complete',token:helped.rewardToken,candidateIndex:helped.candidateIndex,moves:helped.moves,assisted:false}});
    assert.equal(forged.status(),200);assert.equal((await forged.json()).rewardXp,0);
    assert.deepEqual(await (await context.request.get(base+'/__qa/endgame-balance')).json(),balance);
    assert.deepEqual(errors,[]);
    console.log('Verified: real unassisted checkmate → 3 XP + 3 coins; lost receipt/retry/reload/duplicate are idempotent; other student and invalid games rejected; help survives retry/reload and blocks a forged eligibility flag.');
    const cache=await context.request.get(base+'/vendor/stockfish/stockfish-18-lite-single.js');assert.match(cache.headers()['cache-control'],/immutable/);
    // A transient worker request failure recovers without a student retry.
    const recovery=await browser.newContext();await recovery.routeWebSocket(/.*/,ws=>ws.close());
    let workerRequests=0;await recovery.route('**/stockfish-18-lite-single.js',route=>++workerRequests===1?route.abort():route.continue());
    const rp=await recovery.newPage();await rp.goto(base+'/__qa/login');await rp.goto(base+'/student/training/endgames');
    await rp.getByRole('button',{name:'New position: King & queen checkmate',exact:true}).click();await rp.getByTestId('endgame-board').waitFor({timeout:45000});
    assert.equal(workerRequests,2);await recovery.close();
    console.log('Verified automatic worker recovery and immutable asset caching.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
