// Isolated Next application; test accounts only, external requests blocked.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const origin=process.env.STUDENT_QA_ORIGIN||'http://127.0.0.1:9576';
assert.equal(new URL(origin).hostname,'127.0.0.1');
const output='work/student-navigation-qa';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}),results=[];
 for(const [device,width,height]of [['desktop',1440,900],['tablet-portrait',820,1180],['tablet-landscape',1180,820],['mobile',390,844]]){
  if(process.env.QA_DEVICE&&device!==process.env.QA_DEVICE)continue;
  const context=await browser.newContext({viewport:{width,height},hasTouch:device!=='desktop'});
  await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await context.routeWebSocket(/.*/,ws=>ws.close());
  const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto(origin+'/__qa/login');
  const button=name=>page.getByRole('button',{name,exact:true});
  const go=path=>page.goto(origin+path);
  const menu=async href=>{
   let links=page.locator(`aside a[href="${href}"], nav[aria-label="Primary student navigation"] a[href="${href}"]`).filter({visible:true});
   if(!await links.count()){await button('Menu').click();links=page.getByRole('dialog',{name:'More',exact:true}).locator(`a[href="${href}"]`);}
   await links.last().click();
  };
  const check=async(name,fn)=>{
   if(process.env.QA_CHECK&&name!==process.env.QA_CHECK)return;
   const errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
   try{await fn();assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');results.push({device,name,pass:true});}
   catch(e){results.push({device,name,pass:false,error:e.message,errors});await page.screenshot({path:`${output}/${device}-${name.replaceAll(/[^a-z0-9]/gi,'_')}-failure.png`}).catch(()=>{});}
   page.off('pageerror',onError);console.log(JSON.stringify(results.at(-1)));fs.writeFileSync(`${output}/controls${process.env.QA_DEVICE?'-'+device:''}${process.env.QA_CHECK?'-targeted':''}.json`,JSON.stringify(results,null,2));
  };
  await check('account updates and progress',async()=>{
   await go('/student');await button("What's new").click();const news=page.getByRole('dialog',{name:"What's new",exact:true});await news.waitFor();await page.keyboard.press('Tab');assert.equal(await news.evaluate(el=>el.contains(document.activeElement)),true);await page.keyboard.press('Escape');await news.waitFor({state:'hidden'});
   await button('View Progress').click();const progress=page.getByRole('dialog');await progress.waitFor();for(const tab of ['Training','Achievements','Activity','Overview'])await progress.getByRole('tab',{name:tab,exact:true}).click();await button('Close progress window').click();
   await page.getByRole('button',{name:/Open account menu/}).click();await page.locator('#student-account-menu').getByRole('link',{name:'Trophy Case',exact:true}).click();await page.waitForURL('**/student#trophy-case');await page.locator('#trophy-case').waitFor();
  });
  await check('training controls and active menu',async()=>{
   await go('/student/training');await button('Survival settings').click();await button('← Back to modes').click();
   await button('Start Survival').click();await page.locator('[data-square]').first().waitFor();await button('Hint').click();
   const auto=page.getByRole('switch');if(await auto.count())await auto.first().click();
   await menu('/student/training');await button('Start Survival').waitFor();assert.equal(await page.locator('[data-square]').count(),0);
   await button('Start Survival').click();await page.locator('[data-square]').first().waitFor();await menu('/student/play');await page.waitForURL('**/student/play');await button('Start vs Pawny').waitFor();
  });
  await check('bot settings board and zen',async()=>{
   await go('/student/play');await page.locator('summary').filter({hasText:'Game settings'}).click();
   await page.getByLabel('Clock',{exact:true}).selectOption({label:'3 + 2'});await button('Start vs Pawny').click();await page.locator('[data-chess-board]').waitFor();
   await page.getByRole('button',{name:/Flip Board/i}).click();await page.waitForFunction(()=>document.querySelector('[data-square]')?.dataset.square==='h1');
   await page.getByRole('button',{name:/^Zen mode/i}).click();await page.getByRole('button',{name:/^Exit Zen/i}).waitFor();
   await page.keyboard.press('Escape');await page.getByRole('button',{name:/^Zen mode/i}).waitFor();
   await menu('/student/training');await page.waitForURL('**/student/training');await button('Start Survival').waitFor();
  });
  await check('badges quests and history',async()=>{
   await go('/student/badges');await page.locator('main').getByRole('button').first().click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
   await go('/student/quests');await page.getByRole('dialog',{name:'Your quests',exact:true}).waitFor();await menu('/student/play');await page.waitForURL('**/student/play');
   await go('/student/play/history');await page.getByLabel('Filter by opponent type').selectOption({label:'Computer'});await page.getByLabel('Filter by game result').selectOption({label:'Wins'});
   await go('/student/play/correspondence');await button('Refresh').click();await page.getByRole('link',{name:'New Challenge',exact:true}).click();await page.waitForURL(/\/student\/play/);
  });
  await check('battle lobby and tournament links',async()=>{
   await go('/student/training/battle');await button('Computer').click();await button('Gentle').click();await button('1 min').click();
   for(const name of ['Path Finder','Hide and Seek','Survival'])await page.getByRole('button',{name:new RegExp('^'+name)}).click();
   await button('Classmate').click();await button('Refresh').click();await page.getByRole('link',{name:'Puzzle tournaments',exact:true}).click();await page.waitForURL('**/student/tournaments/puzzle');
  });
  await check('statistics submissions resources',async()=>{
   await go('/student/training');await page.getByRole('link',{name:'Stats & leaderboards',exact:true}).click();await page.waitForURL('**/student/training/stats');
   await go('/student/training/dashboard');await page.locator('main select').first().selectOption({label:'Last 7 days'});await button('Update').click();await page.locator('main').getByRole('link',{name:/Puzzle history/}).click();
   await go('/student/submit');await button('Game').click();await button('Puzzle Score').click();
   await go('/student/leaderboard');await page.locator('main select').nth(1).selectOption({label:'All Time'});await page.locator('main select').nth(2).selectOption({label:'Survival Puzzles'});
   await go('/student/resources');await page.locator('summary').filter({hasText:'Resources FAQ'}).click();await page.locator('main select').selectOption({label:'Puzzles'});
  });
  await check('navigation dismissal rotation logout',async()=>{
   await go('/student');const inbox=page.getByRole('button',{name:/^Moves and challenges/});await inbox.waitFor();
   if(width<768){const box=await inbox.boundingBox(),nav=await page.getByRole('navigation',{name:'Primary student navigation'}).boundingBox();assert.ok(box.y+box.height<=nav.y,'Inbox button covers bottom navigation');}
   await inbox.click();await page.getByRole('dialog',{name:'Moves & challenges',exact:true}).waitFor();await button('Close correspondence inbox').click();
   await go('/student');if(width<768){await page.getByRole('navigation',{name:'Primary student navigation'}).getByRole('button',{name:'More',exact:true}).click();await page.getByRole('dialog',{name:'More',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'More',exact:true}).waitFor({state:'hidden'});}
   else{await button('Collapse side navigation').click();await button('Expand side navigation').click();}
   await page.getByRole('button',{name:/Open account menu/}).click();await page.keyboard.press('Escape');await page.locator('#student-account-menu').waitFor({state:'hidden'});
   await page.getByRole('button',{name:/Open account menu/}).click();await button('Logout').click();await page.waitForURL(origin+'/');
   assert.equal((await(await context.request.get(origin+'/api/auth/session')).json()).user,null);
  });
  await context.close();
 }
 await browser.close();assert.equal(results.filter(r=>!r.pass).length,0,'Student control failures; see report');
})().catch(e=>{console.error(e);process.exitCode=1});
