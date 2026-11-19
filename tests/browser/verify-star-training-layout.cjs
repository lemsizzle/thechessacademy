const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TRAINING_REWARDS_URL || 'http://127.0.0.1:9520';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  fs.mkdirSync('work/puzzle-layout/star-modes', { recursive: true });
  try {
    for (const mode of ['path','hide']) {
      await page.setViewportSize({width:1440,height:900});
      await page.goto(base+'/student/training?launcher&layout');
      await page.getByRole('button',{name:mode==='path'?'Launch Path Finder':'Start Hide and Seek',exact:true}).click();
      await page.locator(mode==='path'?'[data-square]':'[role="gridcell"]').first().waitFor();
      const primary = page.getByRole('button',{name:mode==='path'?'Back to Training Modes':'Stop & Score',exact:true});
      for (const [name,width,height] of [
        ['desktop',1920,1080],['laptop',1440,900],['short-laptop',1280,720],
        ['tablet-landscape',1024,768],['tablet-portrait',768,1024],['tablet-rotate-back',1024,768],
        ['phone',390,844],['small-phone',320,568],['phone-landscape',844,390],['split-screen',960,1080]
      ]) {
        await page.setViewportSize({width,height}); await page.evaluate(()=>scrollTo(0,0)); await page.waitForTimeout(350);
        const geometry = await page.evaluate(async()=>{
          const board=document.querySelector('[data-chess-board]'), rect=board.getBoundingClientRect();
          const nav=document.querySelector('nav[aria-label="Primary student navigation"]')?.getBoundingClientRect();
          const availableBottom=nav?.height&&nav.top<innerHeight?nav.top:innerHeight;
          const samples=[];
          for(let n=0;n<45;n++){await new Promise(requestAnimationFrame);const r=board.getBoundingClientRect();samples.push([r.x,r.y,r.width,r.height]);}
          return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom,availableBottom,overflow:document.documentElement.scrollWidth-innerWidth,spread:[0,1,2,3].map(i=>Math.max(...samples.map(r=>r[i]))-Math.min(...samples.map(r=>r[i])))};
        });
        assert.ok(Math.abs(geometry.width-geometry.height)<1,`${mode}/${name} square board`);
        assert.ok(geometry.overflow<=1 && geometry.x>=0 && geometry.right<=width,`${mode}/${name} no horizontal clipping`);
        assert.ok(geometry.y>=0 && geometry.bottom<=geometry.availableBottom+1,`${mode}/${name} full board: ${JSON.stringify(geometry)}`);
        assert.ok(Math.max(...geometry.spread)<1,`${mode}/${name} stable size while clock ticks`);
        if(width>=1280)assert.ok(geometry.width>=height-155,`${mode}/${name} uses screen height`);
        if(width===1024)assert.ok(geometry.width>=600,`${mode}/${name} landscape tablet board maximized`);
        if(width<768&&height>width)assert.ok(geometry.width>=width-48,`${mode}/${name} phone uses full width`);
        const controls=await primary.boundingBox();
        assert.ok(controls.x>=geometry.right-1 || controls.y>=geometry.bottom-1,`${mode}/${name} controls do not cover board`);
        assert.ok(controls.y+controls.height<=geometry.availableBottom+1,`${mode}/${name} main action visible without scrolling`);
        assert.equal(await page.evaluate(()=>window.trainingQA.startRequests.length),1,'rotation preserves the current run');
        await page.screenshot({path:`work/puzzle-layout/star-modes/${mode}-${name}.png`});
        console.log(`${mode}/${name}: ${Math.round(geometry.width)}px board; controls visible; stable.`);
      }
      await page.setViewportSize({width:390,height:844});
      await page.getByRole('button',{name:'Board settings',exact:true}).click();
      await page.getByRole('dialog',{name:'Board settings',exact:true}).waitFor(); await page.keyboard.press('Escape');
      if(mode==='hide'){
        const squares=await page.evaluate(()=>window.trainingQA.safeSquares);
        await page.getByRole('gridcell',{name:new RegExp('^'+squares[0]+'\\b')}).click();
        await page.getByRole('button',{name:'Clear Marks',exact:true}).click();
        for(const square of squares)await page.getByRole('gridcell',{name:new RegExp('^'+square+'\\b')}).click();
        await primary.click(); await page.getByRole('heading',{name:'Search complete',exact:true}).waitFor();
        await page.getByRole('button',{name:'Play Again',exact:true}).click();
        await page.getByRole('gridcell').first().waitFor();
      }else{
        let last=null;for(const m of await page.evaluate(()=>window.trainingQA.solution(0))){
          if(last!==m.from)await page.locator(`[data-square="${m.from}"]`).click();
          await page.locator(`[data-square="${m.to}"]`).click();last=m.to;
        }
        await page.waitForFunction(()=>document.querySelector('[data-session-xp]')?.textContent==='2');
      }
    }
    assert.deepEqual(errors,[]);
    console.log('Both modes: responsive layouts, rotation, settings, mobile controls and completed puzzles passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
