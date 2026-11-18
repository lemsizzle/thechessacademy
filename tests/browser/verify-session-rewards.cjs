const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('work/session-tally',{recursive:true});
 const tally=async n=>{await page.waitForFunction(n=>document.querySelector('[data-session-xp]')?.textContent===String(n)&&document.querySelector('[data-session-coins]')?.textContent===String(n),n);};
 const move=async(from,to)=>{await page.locator(`[data-square="${from}"]`).click();await page.locator(`[data-square="${to}"]`).click();};
 try{
 await page.goto('http://127.0.0.1:9507/student/training');
 await page.getByRole('button',{name:/^♥/}).click();await page.getByRole('button',{name:'Start Survival',exact:true}).click();await tally(0);
 await move('e5','c6');await tally(2);await page.getByRole('button',{name:'Next Puzzle',exact:true}).click();await page.locator('[data-square="g2"] [data-piece]').waitFor();await move('g2','c6');await tally(4);
 for(const [name,width,height]of [['desktop',1440,900],['tablet',1024,768],['phone',390,844]]){
 await page.setViewportSize({width,height});await page.waitForTimeout(300);await page.getByRole('region',{name:'Training session rewards'}).scrollIntoViewIfNeeded();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const box=await page.getByRole('region',{name:'Training session rewards'}).boundingBox(),board=await page.locator('[data-chess-board]').boundingBox();
 assert.ok(box.x>=board.x+board.width-1||box.y>=board.y+board.height-1);await page.screenshot({path:`work/session-tally/${name}.png`});}
 await page.reload();await page.getByRole('button',{name:/^♥/}).click();await page.getByRole('button',{name:'Start Survival',exact:true}).click();await tally(4);
 await page.getByRole('button',{name:'Reset tally',exact:true}).click();await tally(0);
 console.log('Survival: 0 → 2 → 4, reload preserved, reset, desktop/tablet/phone layout passed.');
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:9508/?retry=1');
 await page.getByRole('button',{name:'Start Classic Run',exact:true}).click();await tally(0);
 for(const score of [0,1]){const route=await page.evaluate(n=>window.trainingQA.solution(n),score);let last=null;for(const m of route){if(last!==m.from)await page.locator(`[data-square="${m.from}"]`).click();await page.locator(`[data-square="${m.to}"]`).click();last=m.to;}
 if(score===0){await page.getByRole('button',{name:/retry/i}).click();}
 await tally((score+1)*3);await page.waitForTimeout(600);}
 await page.getByRole('button',{name:'Reset tally',exact:true}).click();await tally(0);
 let last=null;for(const m of await page.evaluate(()=>window.trainingQA.solution(2))){if(last!==m.from)await page.locator(`[data-square="${m.from}"]`).click();await page.locator(`[data-square="${m.to}"]`).click();last=m.to;}await tally(3);
 console.log('Star Wars: failed save/retry counted once; cumulative 3 → 6; reset then next level adds only 3.');
 await page.goto('http://127.0.0.1:9508/?hide=1');await tally(3);await page.getByRole('button',{name:'Start Classic Search',exact:true}).click();
 const squares=await page.evaluate(()=>window.trainingQA.safeSquares);
 for(const round of [0,1]){
 for(const sq of squares)await page.getByRole('gridcell',{name:new RegExp('^'+sq+'\\b')}).click();
 await page.getByRole('button',{name:'Stop & Score',exact:true}).click();await tally(13+round*10);
 if(round===0)await page.getByRole('button',{name:'Play Again',exact:true}).click();}
 await page.reload();await tally(23);assert.deepEqual(errors,[]);
 console.log('Hide and Seek: carries Star Wars total, successive rounds add 10 each, reload preserves 23.');
 }catch(e){await page.screenshot({path:'work/session-tally/failure.png',fullPage:true});console.log(await page.locator('body').innerText());throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
