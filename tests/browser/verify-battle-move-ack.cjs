const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const base=process.env.BATTLE_PREVIEW_URL || 'http://127.0.0.1:9482';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context=await browser.newContext({viewport:{width:1366,height:900}});await context.routeWebSocket(/.*/,ws=>ws.close());
const page=await context.newPage();page.setDefaultTimeout(12000);let battle;
try{
 await context.request.get(base+'/__qa/login');
 const response=await context.request.post(base+'/api/student/puzzle-battles',{data:{mode:'survival',duration:600,botLevel:'gentle'}});
 assert.ok(response.ok(),await response.text());battle=(await response.json()).battle;
 const path='/api/student/puzzle-battles/'+battle.id;
 await page.goto(base+'/student/training/battle?id='+battle.id);await page.locator('[data-square]').first().waitFor();
 const snapshot=(await (await context.request.get(base+path)).json()).battle;
 const requests=[];
 await page.route('**'+path,async route=>{
  if(route.request().method()==='POST'){
   requests.push(route.request().postDataJSON());
   if(requests.length===1) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({battle:{...snapshot,serverNow:Date.now()}})});
  }
  return route.continue();
 });
 await page.locator('[data-square="d8"]').first().click();await page.locator('[data-square="h4"]').first().click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="my-score"]')?.textContent==='1',null,{timeout:5000});
 assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);
 await page.unroute('**'+path);
 const saved=(await (await context.request.get(base+path)).json()).battle;
 assert.equal(saved.state.players[0].score,1);assert.equal(saved.state.players[0].revision,1);
 // A server which repeatedly returns an unchanged position must never look like
 // a saved move. Stop bounded recovery and offer the visible Resume control.
 let unchanged=0;
 await page.route('**'+path,async route=>{
  if(route.request().method()==='POST') {unchanged++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({battle:{...saved,serverNow:Date.now()}})});}
  return route.continue();
 });
 await page.locator('[data-square="d8"]').first().click();await page.locator('[data-square="h4"]').first().click();
 await page.getByRole('button',{name:'Resume puzzle',exact:true}).waitFor();assert.equal(unchanged,2);
 assert.equal(await page.getByTestId('my-score').innerText(),'1');
 await page.screenshot({path:'work/puzzle-battle/move-not-acknowledged.png'});
 await page.unroute('**'+path);await page.getByRole('button',{name:'Resume puzzle',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="my-score"]')?.textContent==='2');
 console.log('PASS unchanged HTTP 200 is not a move acknowledgement: automatic reconcile/retry, one award, explicit bounded failure, resume.');
}catch(error){console.error((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:'work/puzzle-battle/ack-failure.png'});throw error;}
finally{if(battle)await context.request.post(base+'/api/student/puzzle-battles/'+battle.id,{data:{type:'leave',actionId:randomUUID()}});await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
