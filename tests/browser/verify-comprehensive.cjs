// Run with comprehensive-harness on 9420 and the areas fixture on 9418.
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const output='work/comprehensive-qa';fs.mkdirSync(output,{recursive:true});
const devices=[['phone',390,844,true],['phone-landscape',844,390,true],['tablet',820,1180,true],['tablet-landscape',1180,820,true],['desktop',1440,900,false]];
const fixtures=(process.env.QA_FIXTURES||'studies,navigation,history,store,classes,admin,dashboard,rewards,chat,achievements,badges').split(',');
const results=[];
async function dialogCheck(page,open,label){
 await open.focus();await page.keyboard.press('Enter');const dialog=page.getByRole('dialog');await dialog.waitFor();
 assert(await dialog.evaluate(el=>el.contains(document.activeElement)),label+' focus outside');
 const box=await dialog.boundingBox();const size=page.viewportSize();
 assert(box.y>=0 && box.y+box.height<=size.height+1,label+' clipped vertically');
 for(let i=0;i<35;i++) {await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)),label+' Tab escaped');}
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 assert(await open.evaluate(el=>el===document.activeElement),label+' focus not restored');
}
(async()=>{
 for(const engine of (process.env.QA_ENGINES||'chromium,webkit').split(',')){
  const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'&&process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
  for(const [device,width,height,hasTouch] of devices){
   for(const fixture of fixtures){
    const page=await browser.newPage({viewport:{width,height},hasTouch});page.setDefaultTimeout(7000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    let extra=fixture==='studies'?'&teacher':fixture==='rewards'?'&hide':'';
    const url='http://127.0.0.1:9420/'+(fixture==='navigation'?'student/training':'')+'?fixture='+fixture+extra;
    try {
     await page.goto(url);await page.waitForFunction(()=>document.querySelector('#root')?.textContent.length>40);await page.waitForTimeout(250);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal page overflow');
     if(fixture==='studies'){
      await page.locator('[data-square="e2"]').waitFor();
      for(const label of ['+ PGN / FEN','+ Completed Game','Manage Access','Assign Review'])await dialogCheck(page,page.getByRole('button',{name:label,exact:true}),label);
      await page.goto('http://127.0.0.1:9420/?fixture=studies&failSave&failAdd');
      await page.locator('[data-square="e2"]').click();await page.locator('[data-square="e4"]').click();
      await page.getByRole('button',{name:'Retry saving',exact:true}).click();
      await page.getByText('All changes saved',{exact:true}).waitFor();
      assert(await page.evaluate(()=>Object.values(window.studyQA.chapter.tree.nodes).some(n=>n.uci==='e2e4')),'Retry lost move');
      assert.equal(await page.evaluate(()=>window.studyQA.requests.filter(r=>r.method==='PATCH').length),2);
      await page.getByRole('button',{name:'+ Completed Game',exact:true}).click();
      await page.getByRole('button',{name:'Add',exact:true}).click();
      await page.getByRole('alert').filter({hasText:'Failed to fetch'}).waitFor();
      await page.getByRole('button',{name:'Add',exact:true}).click();
      await page.getByRole('dialog').waitFor({state:'hidden'});
      await page.goto('http://127.0.0.1:9420/?fixture=studies&library');
      await dialogCheck(page,page.getByRole('button',{name:'Add to Study',exact:true}),'Add to Study');
     }
     if(fixture==='admin')for(const mode of ['students','badges','quests','xp','classes']){await page.getByRole('button',{name:mode,exact:true}).click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,mode+' horizontal page overflow');}
     if(fixture==='history'){
      await page.goto('http://127.0.0.1:9420/student/play/history?fixture=history');
      await page.getByRole('heading',{name:'Game History',exact:true}).waitFor();
     }
     assert.deepEqual(errors,[],'Uncaught browser errors');
     if(device==='phone'||device==='tablet-landscape')await page.screenshot({path:`${output}/${engine}-${device}-${fixture}.png`,fullPage:true});
     fs.writeFileSync(`${output}/${engine}-${device}-${fixture}.txt`,await page.locator('body').innerText());
     results.push({engine,device,fixture,result:'PASS'});
    }catch(e){
     results.push({engine,device,fixture,result:'FAIL',error:e.message,errors});
     await page.screenshot({path:`${output}/FAIL-${engine}-${device}-${fixture}.png`,fullPage:true}).catch(()=>{});
     fs.writeFileSync(`${output}/FAIL-${engine}-${device}-${fixture}.txt`,await page.locator('body').innerText());
    }
    console.log(JSON.stringify(results.at(-1)));await page.close();
    fs.writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2));
   }
  }
  await browser.close();
 }
 console.log(`Passed ${results.filter(r=>r.result==='PASS').length}/${results.length}`);
 if(results.some(r=>r.result==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
