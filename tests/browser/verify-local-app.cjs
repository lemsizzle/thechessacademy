const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
 const results=[];
 for(const [width,height]of [[390,844],[844,390],[820,1180],[1180,820],[1440,900]]){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  for(const path of ['/','/admin-login','/student','/student/training','/student/studies','/admin','/admin/students']){
   const response=await page.goto('http://127.0.0.1:9430'+path);await page.waitForTimeout(150);
   const text=await page.locator('body').innerText();
   results.push({width,height,path,status:response.status(),url:page.url(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),content:text.slice(0,150),errors:[...errors]});
   if(path==='/')await page.screenshot({path:`work/comprehensive-qa/app-home-${width}.png`,fullPage:true});
  }
  await page.close();
 }
 const request=await browser.newContext();
 for(const path of ['/api/auth/session','/api/admin/students','/api/student/chess-history','/api/chess/studies','/api/student/live-games','/api/admin/quests']){
  const response=await request.request.get('http://127.0.0.1:9430'+path);results.push({path,status:response.status(),body:(await response.text()).slice(0,160)});
 }
 fs.writeFileSync('work/comprehensive-qa/local-app.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
