const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');const results=[];
(async()=>{
 for(const name of ['chromium','webkit']){
  const browser=await (name==='webkit'?webkit:chromium).launch({headless:true,...(name==='chromium'&&process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});page.setDefaultTimeout(10000);
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:9418/?area=bot&viewport');
  await page.getByRole('button',{name:'Start vs Pawny',exact:true}).click();
  await page.locator('[data-square="e2"]').tap();await page.locator('[data-square="e4"]').tap();
  await page.waitForFunction(()=>document.querySelector('[data-square="c6"] [data-piece]'));
  for(const [width,height]of [[390,844],[844,390],[768,1024],[1024,768],[820,1180],[1180,820],[1024,1366],[1366,1024],[1440,900],[820,1180]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(180);
   const measurement=await page.locator('[id$="-board"]').filter({has:page.locator('[data-square="e4"]')}).evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth};});
   assert(!measurement.overflow && Math.abs(measurement.width-measurement.height)<1 && measurement.width>150,JSON.stringify(measurement));
   assert.equal(await page.locator('[data-square="e4"] [data-piece]').count(),1);
   assert.equal(await page.locator('[data-square]').count(),64);
   results.push({engine:name,scenario:'bot rotation with existing moves',viewport:[width,height],measurement,result:'PASS'});
   if(width===1180||width===390)await page.screenshot({path:`work/comprehensive-qa/${name}-rotation-${width}.png`,fullPage:true});
  }
  await page.getByRole('button',{name:/Flip Board/}).click();
  await page.waitForFunction(()=>document.querySelector('[data-square]')?.dataset.square==='h1');
  results.push({engine:name,scenario:'Flip board after rotation',result:'PASS'});
  for(const [width,height]of [[390,844],[820,1180],[1180,820],[1440,900]]){
   await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:9420/?fixture=store&failEquip');
   const card=page.locator('section').filter({has:page.getByText('Dark King Armor',{exact:true})}).last();
   await card.getByRole('button',{name:'Preview',exact:true}).click();
   await page.getByRole('button',{name:'Close preview',exact:true}).click();
   await card.getByRole('button',{name:'Purchase and equip',exact:true}).click();
   await page.getByText(/Dark King Armor is purchased and safely/).waitFor();
   await card.getByRole('button',{name:'Equip',exact:true}).click();
   await card.getByRole('button',{name:'Equipped',exact:true}).waitFor();
   const counts=await page.getByRole('complementary',{name:'Store test measurements'}).innerText();
   assert(counts.includes('Purchases: 1')&&counts.includes('equips: 1')&&counts.includes('coins: 865'),counts);
   results.push({engine:name,scenario:'store preview, purchase, failed equip and retry without rebuy',viewport:[width,height],result:'PASS'});
  }
  await browser.close();
 }
 fs.writeFileSync('work/comprehensive-qa/device-interactions.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);fs.writeFileSync('work/comprehensive-qa/device-interactions.json',JSON.stringify([...results,{result:'FAIL',error:e.message}],null,2));process.exit(1);});
