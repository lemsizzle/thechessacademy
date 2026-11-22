// Teacher controls against the isolated QA server; no production records or services.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const origin = process.env.TEACHER_QA_ORIGIN || 'http://127.0.0.1:9572';
assert.equal(new URL(origin).hostname, '127.0.0.1');
const output = 'work/teacher-navigation-qa';
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  const results=[];
  for(const [device,width,height] of [['desktop',1440,900],['tablet-portrait',820,1180],['tablet-landscape',1180,820],['mobile',390,844]]) {
    if (process.env.QA_DEVICE && process.env.QA_DEVICE !== device) continue;
    const context=await browser.newContext({viewport:{width,height},hasTouch:device!=='desktop'});
    await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
    const page=await context.newPage();page.setDefaultTimeout(10000);
    await page.goto(origin+'/__qa/teacher');
    const button=name=>page.getByRole('button',{name,exact:true});
    const valueIs=async(locator,value)=>page.waitForFunction(({input,value})=>input.value===value,{input:await locator.elementHandle(),value});
    const check=async(name,fn)=>{
      const errors=[];const listen=e=>errors.push(e.message);page.on('pageerror',listen);
      try {await fn();assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');results.push({device,name,pass:true});}
      catch(e){results.push({device,name,pass:false,error:e.message,errors});await page.screenshot({path:`${output}/${device}-${name.replaceAll(/[^a-z0-9]/gi,'-')}-failure.png`}).catch(()=>{});}
      page.off('pageerror',listen);console.log(JSON.stringify(results.at(-1)));fs.writeFileSync(`${output}/controls${process.env.QA_DEVICE ? '-'+process.env.QA_DEVICE : ''}.json`,JSON.stringify(results,null,2));
    };
    await check('navigation controls',async()=>{
      await page.goto(origin+'/admin');
      if(width>=768){
        await button('Collapse side navigation').click();
        await button('Expand side navigation').waitFor();
        await page.locator('aside summary').first().click();
        await button('Collapse side navigation').waitFor();
        await page.locator('aside a[href="/admin/assessments"]').click();await page.waitForURL('**/admin/assessments');
        await page.reload();assert.equal(await page.locator('aside details').first().evaluate(el=>el.open),true);
      }else{
        const menu=page.locator('header details');
        await menu.locator('summary').click();await page.keyboard.press('Escape');assert.equal(await menu.evaluate(el=>el.open),false);
        await menu.locator('summary').click();await page.locator('h1').click({position:{x:1,y:1}});assert.equal(await menu.evaluate(el=>el.open),false);
        await page.getByRole('navigation',{name:'Teacher quick navigation'}).getByRole('link',{name:'Students',exact:true}).click();await page.waitForURL('**/admin/students');
      }
    });
    await check('student tools and switching',async()=>{
      await page.goto(origin+'/admin/students');
      await page.locator('summary').filter({hasText:'Create Academy login'}).click();
      await page.getByLabel('Student display name',{exact:true}).fill('QA draft only');
      await button('Generate password').click();assert.equal((await page.getByLabel('Temporary password',{exact:true}).inputValue()).length,12);
      await page.locator('summary').filter({hasText:'Create Academy login'}).click();
      await page.getByLabel('Name',{exact:true}).fill('Explorer draft');
      for(const tab of ['Games','Tests','Rewards','Quests','Activity','Profile']){
        await page.getByRole('navigation',{name:'Student sections'}).getByRole('button',{name:tab,exact:true}).click();
        await page.waitForTimeout(200);
        assert.equal(await button(tab).getAttribute('aria-pressed'),'true');
        if(tab==='Games'){await page.getByText('No completed games on this page yet.',{exact:true}).waitFor();await button('Refresh games').click();}
        if(tab==='Rewards'){await page.getByRole('heading',{name:'Avatar Rewards & Academy Coins',exact:true}).waitFor();await page.getByLabel('Coins To Give Or Take',{exact:true}).fill('0');assert.equal(await button('Give Coins').isEnabled(),false);}
      }
      assert.equal(await page.getByLabel('Name',{exact:true}).inputValue(),'Explorer draft');
      await page.getByLabel('Name',{exact:true}).fill('Explorer A');
      await page.getByLabel(/^Student To Edit/).selectOption('30000000-0000-4000-8000-000000000002');
      await valueIs(page.getByLabel('Name',{exact:true}),'Explorer B');
      await button('Games').click();await page.getByRole('heading',{name:'Recent games · Explorer B',exact:true}).waitFor();
      await button('Profile').click();await page.screenshot({path:`${output}/${device}-student-tools.png`});
    });
    await check('class editing and reload',async()=>{
      await page.goto(origin+'/admin/classes');await button('Add Class').click();
      await page.getByLabel('Class name',{exact:true}).fill('QA unsaved class');
      await page.getByLabel('Outschool class link',{exact:true}).fill('https://example.com/class');
      page.once('dialog',dialog=>dialog.accept());await button('Reload Classes').click();
      await page.getByText('Loaded the latest server classes.',{exact:true}).waitFor();
      assert.equal(await page.getByLabel('Class name',{exact:true}).count(),0);
      const download=page.waitForEvent('download');await button('Download browser backup').click();assert.ok((await download).suggestedFilename().endsWith('.json'));
    });
    await check('student drilldown links',async()=>{
      await page.goto(origin+'/admin/adaptive-training');await page.locator('main a[href="/admin/students?student=30000000-0000-4000-8000-000000000002"]').click();
      await page.waitForURL('**/admin/students?student=30000000-0000-4000-8000-000000000002');
      await page.waitForFunction(()=>document.querySelector('input')!==null);
      await page.getByLabel('Name',{exact:true}).waitFor();
      await valueIs(page.getByLabel(/^Student To Edit/),'30000000-0000-4000-8000-000000000002');
      await page.goto(origin+'/admin/avatar');await page.getByRole('link',{name:'Explorer B',exact:true}).click();
      await page.waitForURL('**/admin/students?student=30000000-0000-4000-8000-000000000002');
      await valueIs(page.getByLabel('Name',{exact:true}),'Explorer B');
    });
    await check('avatar editing and coupon confirmations',async()=>{
      await page.goto(origin+'/admin/avatar');await button('View resolved').click();
      await page.getByText('No resolved class requests.',{exact:true}).waitFor();
      await button('Pending requests').click();await button('Mark redeemed').click();await button('Confirm').waitFor();await button('Cancel').click();
      await button('Refund coins').click();await button('Confirm').waitFor();await button('Cancel').click();
      await page.getByLabel('Name',{exact:true}).fill('QA item draft');
      await page.getByLabel(/^Unlock Type/).selectOption('purchase');
      await page.getByLabel('Store Price (Academy Coins)',{exact:false}).fill('75');
      assert.equal(await page.getByLabel('Store Price (Academy Coins)',{exact:false}).inputValue(),'75');
      await page.screenshot({path:`${output}/${device}-avatar-controls.png`});
    });
    await check('filters refresh and secondary routes',async()=>{
      await page.goto(origin+'/admin/live-games');await button('Refresh').click();
      await page.goto(origin+'/admin/activity');await page.getByPlaceholder('Student, quest, badge, or reason').fill('Explorer');await button('Refresh').click();
      await page.goto(origin+'/admin/leaderboard');const selects=page.locator('main select');await selects.nth(1).selectOption({label:'All Time'});await selects.nth(2).selectOption({label:'Survival Puzzles'});
      await page.goto(origin+'/admin/submissions');await page.locator('main').getByRole('link',{name:'Review Games',exact:true}).click();await page.waitForURL('**/admin/submissions/games');
      await page.locator('main').getByRole('link',{name:'Scores',exact:true}).click();await page.waitForURL('**/admin/submissions/scores');
      await page.goto(origin+'/admin/tournaments');await page.getByRole('link',{name:'Host a puzzle tournament',exact:true}).click();await page.waitForURL('**/admin/tournaments/puzzle');
      await page.getByLabel('Tournament name',{exact:true}).fill('QA draft tournament');
      await page.getByLabel(/^Battle mode/).selectOption('hide-and-seek');
    });
    await check('badge quest resource and study editors',async()=>{
      await page.goto(origin+'/admin/badges');await button('Create Badge').click();await button('Save Badge').waitFor();
      await page.goto(origin+'/admin/quests');await button('Create Quest').click();await button('Save Quest').waitFor();
      await page.goto(origin+'/admin/resources');await page.getByPlaceholder('Search resources').fill('ChessKid');
      await page.getByRole('button',{name:/ChessKid/}).click();
      await page.waitForFunction(input=>input.value==='ChessKid',await page.getByLabel('Title',{exact:true}).elementHandle());
      await page.getByLabel('URL',{exact:true}).fill('invalid');await page.getByText(/Use a full http/).waitFor();
      await page.goto(origin+'/admin/studies');await button('New Study').click();await page.getByText('Study could not be created.',{exact:true}).waitFor();assert.equal(await button('New Study').isEnabled(),true);
    });
    await check('portal and logout',async()=>{
      await page.goto(origin+'/admin');if(width<768)await page.locator('header summary').click();
      await page.locator('header').getByRole('link',{name:'View Portal',exact:true}).filter({visible:true}).click();await page.waitForURL('**/app');
      await page.goto(origin+'/admin');if(width<768)await page.locator('header summary').click();
      await button('Log Out').filter({visible:true}).click();await page.waitForURL('**/login?mode=admin');
      assert.equal((await(await context.request.get(origin+'/api/admin/session')).json()).authenticated,false);
    });
    await context.close();
  }
  await browser.close();assert.equal(results.filter(r=>!r.pass).length,0,'Teacher control failures; see report');
})().catch(error=>{console.error(error);process.exitCode=1;});
