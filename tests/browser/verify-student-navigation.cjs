// Actual Next pages and menus against isolated local data. Never production.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const origin=process.env.STUDENT_QA_ORIGIN||'http://127.0.0.1:9574';
assert.equal(new URL(origin).hostname,'127.0.0.1');
const output='work/student-navigation-qa';fs.mkdirSync(output,{recursive:true});
const links=[['/student'],['/student/training'],['/student/play'],['/student/quests'],['/student/avatar'],
 ...['learn','endgames','assessment','battle','dashboard'].map(p=>['/student/training/'+p,'/student/training']),
 ['/student/play/history','/student/play'],['/student/play/correspondence','/student/play'],['/student/tournaments','/student/play'],
 ...['badges','achievements','studies','submit','?progress=overview','leaderboard','resources'].map(p=>[p.startsWith('?')?'/student'+p:'/student/'+p,'more'])];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}),results=[];
 for(const [device,width,height]of [['desktop',1440,900],['tablet-portrait',820,1180],['tablet-landscape',1180,820],['mobile',390,844]]){
  if(process.env.QA_DEVICE&&process.env.QA_DEVICE!==device)continue;
  const context=await browser.newContext({viewport:{width,height},hasTouch:device!=='desktop'});
  await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await context.routeWebSocket(/.*/,ws=>ws.close());
  const page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(origin+'/__qa/login');
  for(const [href,parent]of links){
   if(process.env.QA_HREF&&process.env.QA_HREF!==href)continue;
   const errors=[],failures=[];
   const err=e=>errors.push(e.message),response=r=>{if(r.status()>=400&&new URL(r.url()).origin===origin)failures.push(`${r.status()} ${new URL(r.url()).pathname}`)};
   try{
    await page.goto(origin+'/student');await page.getByRole('button',{name:/Open account menu/}).waitFor();
    page.on('pageerror',err);page.on('response',response);
    let root;
    if(width<768){
     if(href==='/student')root=page.locator('header');
     else if(parent){await page.getByRole('navigation',{name:'Primary student navigation'}).getByRole('button',{name:'More',exact:true}).click();root=page.getByRole('dialog',{name:'More',exact:true});}
     else root=page.getByRole('navigation',{name:'Primary student navigation'});
    }else{
     root=page.locator('aside');
     if(parent==='more')await root.getByRole('button',{name:'More',exact:true}).click();
     else if(parent){await root.locator(`a[href="${parent}"]`).click();await page.waitForURL(origin+parent);}
    }
    await root.locator(`a[href="${href}"]`).last().click();await page.waitForURL(origin+href);await page.waitForTimeout(300);
    const text=await page.locator('main').innerText();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    const controls=await page.locator('main button,main select,main a,main summary').evaluateAll(els=>els.filter(el=>el.checkVisibility()).map(el=>({tag:el.tagName,label:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,110)})));
    results.push({device,href,errors,failures,overflow,body:text.slice(0,600),controls});
    await page.screenshot({path:`${output}/${device}-${href.replaceAll(/[^a-z0-9]/gi,'_')}.png`});
   }catch(e){results.push({device,href,error:e.message,errors,failures});}
   page.off('pageerror',err);page.off('response',response);
   fs.writeFileSync(`${output}/navigation${process.env.QA_DEVICE?'-'+device:''}.json`,JSON.stringify(results,null,2));
   const {controls,body,...brief}=results.at(-1);console.log(JSON.stringify(brief));
  }
  await context.close();
 }
 await browser.close();assert.equal(results.filter(r=>r.error||r.errors.length||r.failures.length||r.overflow).length,0,'Navigation failures; see report');
})().catch(e=>{console.error(e);process.exitCode=1});
