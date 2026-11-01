// Run the isolated preview with BATTLE_PROMOTION=1 on port 9490.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const base = process.env.BATTLE_PREVIEW_URL || "http://127.0.0.1:9490";
const black = process.env.BATTLE_PROMOTION_COLOR === 'black';
const pawnSquare = black ? 'a2' : 'a7', promotionSquare = black ? 'a1' : 'a8';
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
  try {
    for(const [name,width,height,touch] of [["desktop",1366,900,false],["tablet",1024,768,true],["phone",390,844,true]]) {
      const context=await browser.newContext({viewport:{width,height},hasTouch:touch});
      await context.routeWebSocket(/.*/,ws=>ws.close());
      const page=await context.newPage();page.setDefaultTimeout(20000);
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await context.request.get(base+'/__qa/login');
      const response=await context.request.post(base+'/api/student/puzzle-battles',{data:{mode:'survival',duration:600,botLevel:'gentle'}});
      assert.ok(response.ok(),await response.text());const battle=(await response.json()).battle;
      const path='/api/student/puzzle-battles/'+battle.id;
      const square=async s=>{const el=page.locator(`[data-square="${s}"]`).first();if(touch)await el.tap();else await el.click();};
      const choose=async()=>{
        await page.waitForFunction(()=>document.querySelector('[role=grid]')?.getAttribute('aria-readonly')==='false');
        if(await page.locator(`[data-board-square="${pawnSquare}"]`).getAttribute('aria-pressed')!=='true')await square(pawnSquare);
        await square(promotionSquare);
        await page.getByRole('dialog',{name:'Choose a promotion'}).waitFor();
      };
      const score=async n=>page.waitForFunction(n=>document.querySelector('[data-testid="my-score"]')?.textContent===String(n),n);
      try {
        await page.goto(base+'/student/training/battle?id='+battle.id);
        await page.locator('[data-square]').first().waitFor();
        await choose();
        for (const piece of ['Queen','Rook','Bishop','Knight'])
          assert.equal(await page.getByRole('button',{name:'Promote to '+piece,exact:true}).count(),1);
        assert.ok((await page.getByRole('button',{name:'Promote to Queen',exact:true}).innerText()).includes(black?'♛':'♕'));
        assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Promote to Queen');
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Cancel');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Promote to Queen');
        const box=await page.getByRole('dialog',{name:'Choose a promotion'}).boundingBox();
        assert.ok(box.y>=0&&box.y+box.height<height,`Promotion must be visible without scrolling: ${JSON.stringify(box)}`);
        await page.screenshot({path:`work/puzzle-battle/promotion-${black?'black-':''}${name}.png`});
        await page.getByRole('button',{name:'Cancel',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('[role=grid]')?.getAttribute('aria-readonly')==='false');
        await choose();await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('dialog',{name:'Choose a promotion'}).count(),0);
        // Request fails before it saves: reconcile and retry the exact same action once.
        let submitted=[];
        await page.route('**'+path,async route=>{
          if(route.request().method()==='POST') {
            submitted.push(route.request().postDataJSON());
            if(submitted.length===1)return route.abort('failed');
          }
          await route.continue();
        });
        await choose();await page.getByRole('button',{name:'Promote to Queen',exact:true}).click();await score(1);
        assert.equal(submitted.length,2);assert.deepEqual(submitted[0],submitted[1]);
        await page.unroute('**'+path);
        // Request saves but its response disappears: recover from GET, no second award.
        submitted=[];
        await page.route('**'+path,async route=>{
          if(route.request().method()==='POST') {
            submitted.push(route.request().postDataJSON());await route.fetch();return route.abort('failed');
          }
          await route.continue();
        });
        await choose();await page.getByRole('button',{name:'Promote to Queen',exact:true}).click();await score(2);
        assert.equal(submitted.length,1);
        await page.unroute('**'+path);
        // An extended outage stops automatically after bounded retries and puts
        // the resume control directly on the board, not below the mobile fold.
        let failures=0;
        await page.route('**'+path,async route=>{failures++;await route.abort('failed');});
        await choose();await page.getByRole('button',{name:'Promote to Queen',exact:true}).click();
        const resume=page.getByRole('button',{name:'Resume puzzle',exact:true});await resume.waitFor();
        const resumeBox=await resume.boundingBox();assert.ok(resumeBox.y+resumeBox.height<height);
        assert.ok(failures>=3&&failures<=5,`Bounded recovery, got ${failures} requests`);
        await page.screenshot({path:`work/puzzle-battle/recovery-${name}.png`});
        await page.unroute('**'+path);await resume.click();await score(3);
        await page.waitForFunction(()=>document.querySelector('[role=grid]')?.getAttribute('aria-readonly')==='false');
        if(name==='desktop') {
          submitted=[];
          await page.route('**'+path,async route=>{
            if(route.request().method()==='POST') {
              submitted.push(route.request().postDataJSON());
              if(submitted.length===1) {
                await new Promise(resolve=>setTimeout(resolve,8000));
                await route.abort('timedout').catch(()=>{});return;
              }
            }
            await route.continue();
          });
          await choose();await page.getByRole('button',{name:'Promote to Queen',exact:true}).click();
          await page.getByText('Checking your move…',{exact:true}).waitFor();
          await score(4);assert.equal(submitted.length,2);assert.deepEqual(submitted[0],submitted[1]);
          await page.unroute('**'+path);
        }
        await page.reload();await score(name==='desktop'?4:3);
        assert.deepEqual(errors,[]);
        console.log(`PASS ${name}: visible/cancellable promotion, failed request recovery, saved-response recovery, bounded outage and visible resume, reload and no duplicate score.`);
      } catch(error) {
        console.error((await page.locator('body').innerText()).slice(-3500));
        await page.screenshot({path:'work/puzzle-battle/input-recovery-failure.png'});throw error;
      } finally {
        await context.request.post(base+path,{data:{type:'leave',actionId:randomUUID()}});
        await context.close();
      }
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
