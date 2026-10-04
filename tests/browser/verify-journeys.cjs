const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
const out='work/comprehensive-qa';fs.mkdirSync(out,{recursive:true});const results=[];
const devices=[['phone',390,844,true],['tablet',820,1180,true],['tablet-landscape',1180,820,true],['desktop',1440,900,false]];
const visible=async locator=>{await locator.first().waitFor({state:'attached'});for(const el of await locator.all())if(await el.isVisible())return el;throw new Error('No visible matching control');};
(async()=>{
 for(const engine of ['chromium','webkit']){
  const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'&&process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
  for(const [device,width,height,hasTouch] of devices){
   const checks={
    async navigation(page){
     await page.goto('http://127.0.0.1:9420/student/training?fixture=navigation');
     await (await visible(page.getByRole('link',{name:/^Play$/}))).click();
     await page.waitForURL('**/student/play');
     await page.getByRole('dialog').focus();await page.keyboard.press('Escape');
     await page.getByRole('button',{name:'Start vs Pawny',exact:true}).click();
     await page.locator('[data-square="e2"]').click();await page.locator('[data-square="e4"]').click();
     await page.waitForFunction(()=>document.querySelector('[data-square="c6"] [data-piece]'));
     await (await visible(page.getByRole('link',{name:/^Play$/}))).click();
     await page.getByRole('dialog').focus();await page.keyboard.press('Escape');
     assert.equal(await page.locator('[data-square="e4"] [data-piece]').count(),1,'Reopening Play reset game');
     await (await visible(page.getByRole('link',{name:/^Train$/}))).click();
     await page.waitForURL('**/student/training');
     await page.getByRole('button',{name:/Survival 50/}).click();
     await page.getByRole('button',{name:'Start Survival',exact:true}).click();
     await (await visible(page.getByRole('link',{name:/^Train$/}))).click();
     await page.getByRole('button',{name:/Survival 50/}).waitFor();
     assert.equal(await page.locator('[data-square]').count(),0,'Cancelled puzzle restored board');
    },
    async classes(page){
     await page.goto('http://127.0.0.1:9420/?fixture=classes');
     await page.getByLabel('Class name',{exact:true}).first().fill('QA edited class');
     await page.getByRole('button',{name:'Save Classes',exact:true}).click();
     await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('fixture-class-server')).groups.some(g=>g.name==='QA edited class'));
     await page.reload();assert.equal(await page.getByLabel('Class name',{exact:true}).first().inputValue(),'QA edited class');
     await page.getByRole('button',{name:'Simulate other tab save',exact:true}).click();
     await page.getByLabel('Class name',{exact:true}).first().fill('Unsaved local draft');
     await page.getByRole('button',{name:'Save Classes',exact:true}).click();
     await page.getByText(/Another tab changed/).waitFor();
     assert.equal(await page.getByLabel('Class name',{exact:true}).first().inputValue(),'Unsaved local draft');
    },
    async chat(page){
     await page.goto('http://127.0.0.1:9420/?fixture=chat');
     const input=page.getByRole('textbox',{name:'Tournament message'});await input.fill('Local QA message');
     await page.getByRole('button',{name:'Send',exact:true}).click();
     await page.getByText('Test interruption. Please send again.',{exact:true}).waitFor();
     assert.equal(await input.inputValue(),'Local QA message');
     await page.getByRole('button',{name:'Send',exact:true}).click();
     await page.getByText('Local QA message',{exact:true}).waitFor();
     await page.waitForFunction(()=>document.querySelector('textarea')?.value==='');
     await page.getByRole('button',{name:'Tournament chat Hide',exact:true}).click();
     await page.getByRole('button',{name:'Tournament chat Show',exact:true}).click();
     assert.equal(await page.getByText('Local QA message',{exact:true}).count(),1);
    },
    async trainingVariants(page){
     for(const [variant,start]of [[null,'Start Classic Search'],['Time Trial','Start 60-Second Trial'],['Hard Mode','Start Hard Search']]){
      await page.goto('http://127.0.0.1:9420/?fixture=rewards&hide&retry');
      const text=await page.getByRole('complementary',{name:'Test instructions'}).innerText();const square=text.split(': ')[1].split(', ')[0];
      if(variant)await page.getByRole('radio',{name:new RegExp(variant)}).check();
      await page.getByRole('button',{name:start,exact:true}).click();
      await page.getByRole('gridcell',{name:new RegExp('^'+square+':')}).click();
      if(variant==='Hard Mode') {
       const safe=text.split(': ')[1].split(', ');
       const unsafe=await page.getByRole('gridcell').evaluateAll((cells,safe)=>cells.find(el=>el.getAttribute('aria-disabled')!=='true'&&!safe.includes(el.getAttribute('aria-label').slice(0,2)))?.getAttribute('aria-label'),safe);
       assert(unsafe,'No unsafe empty square in fixture');
       await page.getByRole('gridcell',{name:unsafe,exact:true}).click();
      }
      else await page.getByRole('button',{name:variant?'Finish Now':'Stop & Score',exact:true}).click();
      await page.getByText('Simulated save failure',{exact:true}).waitFor();
      if(variant==='Hard Mode')assert.equal(await page.getByRole('gridcell').evaluateAll(cells=>cells.filter(c=>c.getAttribute('aria-disabled')!=='true').length),0,'Completed hard board unlocked after failed save');
      await page.getByRole('button',{name:variant==='Hard Mode'?'Retry Score':variant?'Finish Now':'Stop & Score',exact:true}).click();
      await page.getByRole('button',{name:'Play Again',exact:true}).waitFor();
      const attempts=await page.evaluate(()=>window.trainingQA.finishRequests);
      assert.equal(attempts.length,2);assert.deepEqual(attempts[0],attempts[1],'Retry changed submitted round');
      await page.getByRole('button',{name:'Play Again',exact:true}).click();
      await page.getByRole('gridcell',{name:new RegExp('^'+square+':')}).click();
     }
    },
    async studiesLatestDraft(page){
     await page.goto('http://127.0.0.1:9420/?fixture=studies&failSave');
     await page.locator('[data-square="e2"]').click();await page.locator('[data-square="e4"]').click();
     await page.getByRole('button',{name:'Retry saving',exact:true}).waitFor();
     await page.locator('[data-square="e7"]').click();await page.locator('[data-square="e5"]').click();
     await page.getByText('All changes saved',{exact:true}).waitFor();
     assert(await page.evaluate(()=>Object.values(window.studyQA.chapter.tree.nodes).some(n=>n.uci==='e7e5')));
    },
    async starVariants(page){
     for(const trial of [false,true]){
      await page.goto('http://127.0.0.1:9420/?fixture=rewards&retry');
      const moves=(await page.getByRole('complementary',{name:'Test instructions'}).innerText()).match(/[a-h][1-8]/g);
      if(trial)await page.getByRole('radio',{name:/Time Trial/}).check();
      await page.getByRole('button',{name:trial?/Start .*Minute Trial/:'Start Classic Run',exact:!trial}).click();
      let previous;for(let i=0;i<moves.length;i+=2){if(moves[i]!==previous)await page.locator(`[data-square="${moves[i]}"]`).click();await page.locator(`[data-square="${moves[i+1]}"]`).click();previous=moves[i+1];}
      await page.getByRole('button',{name:'Retry Save',exact:true}).click();
      await page.getByRole('button',{name:'Retry Save',exact:true}).waitFor({state:'hidden'});
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
     }
    }
   };
   for(const [name,check] of Object.entries(checks).filter(([name])=>!process.env.QA_JOURNEYS||process.env.QA_JOURNEYS.split(',').includes(name))){
    const page=await browser.newPage({viewport:{width,height},hasTouch});page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
    try{await check(page);assert.deepEqual(errors,[]);results.push({engine,device,name,result:'PASS'});}catch(e){results.push({engine,device,name,result:'FAIL',error:e.message,errors});fs.writeFileSync(`${out}/FAIL-${engine}-${device}-${name}-journey.txt`,await page.locator('body').innerText());await page.screenshot({path:`${out}/FAIL-${engine}-${device}-${name}-journey.png`,fullPage:true});}
    console.log(JSON.stringify(results.at(-1)));await page.close();fs.writeFileSync(`${out}/journeys.json`,JSON.stringify(results,null,2));
   }
  }
  await browser.close();
 }
 if(results.some(r=>r.result==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
