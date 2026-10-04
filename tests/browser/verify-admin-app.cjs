// Local production build only, started with the documented disposable admin password.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
const paths=['/admin','/admin/students','/admin/students/duplicates','/admin/submissions','/admin/submissions/games','/admin/submissions/scores','/admin/leaderboard','/admin/classes','/admin/badges','/admin/quests','/admin/tournaments','/admin/tournaments/results','/admin/tournaments/awards','/admin/resources','/admin/avatar','/admin/live-games','/admin/chess-performance','/admin/adaptive-training','/admin/chess-ratings','/admin/studies','/admin/activity','/admin/game-analyzer','/admin/game-review','/admin/xp'];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});const results=[];
 const context=await browser.newContext();await context.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const page=await context.newPage();page.setDefaultTimeout(8000);
 await page.goto('http://localhost:9430/login?mode=admin');
 await page.getByLabel('Teacher password').fill('wrong-local-password');await page.getByRole('button',{name:'Enter Dashboard',exact:true}).click();
 await page.getByText('Incorrect teacher password.',{exact:true}).waitFor();
 await page.evaluate(()=>{const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='quest-board-admin')throw new DOMException('QA full storage','QuotaExceededError');return setItem.call(this,key,value);};});
 await page.getByLabel('Teacher password').fill('chessquest-local-qa-only');await page.getByRole('button',{name:'Enter Dashboard',exact:true}).click();
 await page.waitForURL('**/admin');console.log('Local wrong-password, valid-password with full localStorage and cookie session: PASS');
 for(const [width,height]of [[390,844],[820,1180],[1180,820],[1440,900]]){
  await page.setViewportSize({width,height});
  for(const path of (process.env.QA_ADMIN_PATHS?.split(',')||paths)){
   const errors=[];const listener=e=>errors.push(e.message);page.on('pageerror',listener);
   try {const response=await page.goto('http://localhost:9430'+path);await page.waitForTimeout(250);
    const content=await page.locator('body').innerText();
    results.push({width,height,path,status:response.status(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),errors,content:content.slice(0,250),databaseUnavailable:/not configured|unavailable|could not|missing.*supabase/i.test(content)});
    if(width===390)await page.screenshot({path:'work/comprehensive-qa/admin-'+path.replaceAll('/','-')+'.png',fullPage:true});
   }catch(e){results.push({width,height,path,error:e.message});}
   page.off('pageerror',listener);console.log(JSON.stringify(results.at(-1)));fs.writeFileSync('work/comprehensive-qa/admin-app.json',JSON.stringify(results,null,2));
  }
 }
 await page.getByRole('button',{name:'Log Out',exact:true}).click();
 await page.waitForURL('**/login?mode=admin');
 assert.equal((await context.request.get('http://localhost:9430/api/admin/session')).status(),200);
 assert.equal((await (await context.request.get('http://localhost:9430/api/admin/session')).json()).authenticated,false);
 console.log('Local logout clears session: PASS');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
