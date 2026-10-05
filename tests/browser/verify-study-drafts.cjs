const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
const base='http://127.0.0.1:9422';const results=[];const out='work/study-drafts';fs.mkdirSync(out,{recursive:true});
const snapshots=page=>page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('chessquest:study-draft:v1:')).map(([,v])=>JSON.parse(v)));
const move=async(page,from,to)=>{await page.locator(`[data-square="${from}"]`).click();await page.locator(`[data-square="${to}"]`).click();};
const open=async(context,suffix='')=>{const page=await context.newPage();page.setDefaultTimeout(8000);await page.goto(base+'/?'+suffix);await page.locator('[data-square="e2"]').waitFor();return page;};
(async()=>{
 for(const engine of (process.env.QA_ENGINES||'chromium,webkit').split(',')){
  const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'&&process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
  const cases={
   async navigationAndCrash(context){
    let page=await open(context,'jsonb&offline');await move(page,'e2','e4');assert.equal((await snapshots(page)).length,1);
    await page.getByRole('link',{name:'Test library navigation'}).click();await page.getByText('Study library. Use browser Back to reopen.').waitFor();await page.goBack();
    await page.getByRole('region',{name:'Study recovery'}).waitFor();await page.getByRole('button',{name:'Restore draft',exact:true}).click();
    await page.getByRole('button',{name:'Retry saving',exact:true}).waitFor();
    await page.close({runBeforeUnload:false});page=await open(context,'jsonb');await page.getByRole('region',{name:'Study recovery'}).waitFor();await page.getByRole('button',{name:'Restore draft',exact:true}).click();
    await page.getByText('All changes saved',{exact:true}).waitFor();await page.reload();await page.locator('[data-square="e2"]').waitFor();
    assert.equal(await page.getByRole('region',{name:'Study recovery'}).count(),0);
    assert(await page.evaluate(()=>Object.values(studyQA.read()[0].tree.nodes).some(n=>n.uci==='e2e4')));
    assert.equal((await snapshots(page)).length,0);
   },
   async serverConflict(context){
    const page=await open(context,'offline');await move(page,'e2','e4');await page.getByRole('button',{name:'Retry saving'}).waitFor();await page.evaluate(()=>studyQA.remoteEdit());await page.reload();
    await page.getByText('The saved chapter has changed or was deleted.',{exact:false}).waitFor();await page.getByRole('button',{name:'Review draft',exact:true}).click();
    await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>studyQA.requests.filter(r=>r.method==='PATCH').length),0,'A conflicting recovery overwrote the server');
    await page.evaluate(()=>{studyQA.fail=false;});
    await page.getByRole('button',{name:'Save draft as new chapter',exact:true}).evaluate(b=>{b.click();b.click();});
    await page.waitForFunction(()=>studyQA.read().length===3);await page.waitForTimeout(150);
    const rows=await page.evaluate(()=>studyQA.read());assert.equal(rows.length,3);assert.equal(rows[0].tree.nodes[rows[0].tree.rootId].comment,'Saved by another editor');assert(!Object.values(rows[0].tree.nodes).some(n=>n.uci==='e2e4'));assert(Object.values(rows[2].tree.nodes).some(n=>n.uci==='e2e4'));
   },
   async tabsAndAccountIsolation(context){
    const a=await open(context,'offline'),b=await open(context,'offline');await move(a,'e2','e4');await move(b,'d2','d4');
    await a.getByRole('button',{name:'Retry saving'}).waitFor();await b.getByRole('button',{name:'Retry saving'}).waitFor();assert.equal((await snapshots(a)).length,2);
    await a.evaluate(()=>{studyQA.fail=false;});await a.getByRole('button',{name:'Retry saving'}).click();await a.getByText('All changes saved',{exact:true}).waitFor();assert.equal((await snapshots(b)).length,1);
    await b.evaluate(()=>{studyQA.fail=false;});await b.getByRole('button',{name:'Retry saving'}).click();await b.getByText('This chapter changed elsewhere.',{exact:false}).waitFor();
    const other=await open(context,'owner=student:bob');assert.equal(await other.getByRole('region',{name:'Study recovery'}).count(),0);
    await a.evaluate(()=>studyQA.logout());await b.getByText('Your session ended.',{exact:false}).waitFor();assert.equal((await snapshots(b)).length,0);
   },
   async storageFailure(context){
    await context.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('chessquest:study-draft:v1:'))throw new DOMException('full','QuotaExceededError');return set.call(this,k,v);};});
    const page=await open(context,'offline');await move(page,'e2','e4');await page.getByText('This browser could not save the latest recovery copy.',{exact:false}).waitFor();
    page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('link',{name:'Test library navigation'}).click();assert.equal(await page.getByText('Study library. Use browser Back to reopen.').count(),0);
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download draft',exact:true}).click();const download=await downloadPromise;const file=`${out}/${engine}-draft.json`;await download.saveAs(file);assert(Object.values(JSON.parse(fs.readFileSync(file)).tree.nodes).some(n=>n.uci==='e2e4'));
    await page.getByRole('button',{name:'Retry saving'}).waitFor();await page.evaluate(()=>{studyQA.fail=false;});await page.getByRole('button',{name:'Retry saving'}).click();await page.getByText('All changes saved',{exact:true}).waitFor();
   },
   async olderResponseAndLogout(context){
    const page=await open(context);await page.evaluate(()=>{studyQA.delay=1500;});await move(page,'e2','e4');await page.waitForFunction(()=>studyQA.requests.some(r=>r.method==='PATCH'));
    await move(page,'e7','e5');await page.waitForFunction(()=>studyQA.read()[0].version===2);const copy=await snapshots(page);assert(copy.some(d=>Object.values(d.tree.nodes).some(n=>n.uci==='e7e5')),'Older save cleared the latest edit');
    await page.evaluate(()=>studyQA.logout());await page.waitForTimeout(1800);assert.equal((await snapshots(page)).length,0);await page.getByText('Your session ended.',{exact:false}).waitFor();
   },
   async multipleRecoveries(context){
    const a=await open(context,'offline'),b=await open(context,'offline');await move(a,'e2','e4');await move(b,'d2','d4');
    await a.getByRole('button',{name:'Retry saving'}).waitFor();await b.getByRole('button',{name:'Retry saving'}).waitFor();await a.reload();
    await a.getByRole('region',{name:'Study recovery'}).waitFor();assert.equal(await a.getByRole('button',{name:'Restore draft',exact:true}).count(),2);
    await a.getByRole('button',{name:'Restore draft',exact:true}).first().click();const protectedCopies=await snapshots(a);
    await a.getByRole('button',{name:'Restore draft',exact:true}).click();await a.getByRole('alert').filter({hasText:'Save or discard the current chapter draft before restoring another.'}).waitFor();
    assert.deepEqual(await snapshots(a),protectedCopies,'Restoring another recovery discarded unsaved edits');
   },
   async retryCopyAfterLostResponse(context){
    const page=await open(context,'offline');await move(page,'e2','e4');await page.getByRole('button',{name:'Retry saving'}).waitFor();await page.reload();await page.getByRole('region',{name:'Study recovery'}).waitFor();
    await page.evaluate(()=>{studyQA.fail=false;studyQA.loseCopyResponse=true;});await page.getByRole('button',{name:'Save recovered copy',exact:true}).click();
    await page.getByText('Synthetic lost copy response',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>studyQA.read().length),3);assert.equal((await snapshots(page)).length,1);
    await page.getByRole('button',{name:'Save recovered copy',exact:true}).click();await page.getByRole('region',{name:'Study recovery'}).waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>studyQA.read().length),3,'A retry created a second recovered chapter');assert.equal((await snapshots(page)).length,0);
   },
   async committedBeforeCrash(context){
    const page=await open(context,'offline');await move(page,'e2','e4');await page.getByRole('button',{name:'Retry saving'}).waitFor();const [draft]=await snapshots(page);
    await page.evaluate(d=>{const rows=studyQA.read();rows[0].tree=d.tree;rows[0].version++;localStorage.setItem('qa-study-drafts-server',JSON.stringify(rows));},draft);
    await page.reload();await page.locator('[data-square="e2"]').waitFor();await page.getByRole('button',{name:'Next move',exact:true}).click();await page.locator('[data-square="e4"] [data-piece]').waitFor();assert.equal(await page.getByRole('region',{name:'Study recovery'}).count(),0);assert.equal((await snapshots(page)).length,0);
   },
   async sessionOutageKeepsRecovery(context){
    const page=await open(context,'offline');await move(page,'e2','e4');await page.getByRole('button',{name:'Retry saving'}).waitFor();
    await page.evaluate(()=>studyQA.sessionLookupFailed());assert.equal((await snapshots(page)).length,1);await page.reload();await page.getByRole('region',{name:'Study recovery'}).waitFor();
   },
   async strictModeRecovery(context){
    const page=await open(context,'strict&offline');await move(page,'e2','e4');await page.getByRole('button',{name:'Retry saving'}).waitFor();await page.reload();await page.getByRole('region',{name:'Study recovery'}).waitFor();
    await page.evaluate(()=>{studyQA.fail=false;});await page.getByRole('button',{name:'Restore draft',exact:true}).click();await page.getByText('All changes saved',{exact:true}).waitFor();
    assert.equal((await snapshots(page)).length,0);assert.equal(await page.evaluate(()=>studyQA.requests.filter(r=>r.method==='PATCH').length),1);
   },
   async restrictedMessagingAndViewer(context){
    await context.addInitScript(()=>{window.BroadcastChannel=function(){throw new DOMException('blocked','SecurityError');};});
    const page=await open(context,'offline');await move(page,'e2','e4');await page.getByRole('button',{name:'Retry saving'}).waitFor();
    const viewer=await open(context,'viewer');assert.equal(await viewer.getByRole('region',{name:'Study recovery'}).count(),0);assert.equal(await viewer.getByText('Chapter actions',{exact:true}).count(),0);
    await move(viewer,'d2','d4');assert.equal(await viewer.evaluate(()=>studyQA.requests.filter(r=>r.method==='PATCH').length),0);
    await page.evaluate(()=>studyQA.logout());await page.getByText('Your session ended.',{exact:false}).waitFor();assert.equal((await snapshots(page)).length,0);
   },
   async navigationDuringPendingRetry(context){
    const page=await open(context,'offline');await move(page,'e2','e4');await page.getByRole('button',{name:'Retry saving'}).waitFor();
    await page.evaluate(()=>{studyQA.fail=false;studyQA.delay=2000;});await page.getByRole('button',{name:'Retry saving'}).click();
    await move(page,'e7','e5');await page.waitForTimeout(1000);await page.getByRole('link',{name:'Test library navigation'}).click();
    await page.waitForTimeout(2200);assert.equal(await page.evaluate(()=>studyQA.requests.filter(r=>r.method==='PATCH').length),2,'Unmount restarted an old save');
    assert((await snapshots(page)).some(d=>Object.values(d.tree.nodes).some(n=>n.uci==='e7e5')),'Navigation lost the newer edit');
   },
   async newerEditDuringDiscard(context){
    const page=await open(context,'offline');await move(page,'e2','e4');await page.getByRole('button',{name:'Retry saving'}).waitFor();
    await page.evaluate(()=>{studyQA.remoteEdit();studyQA.fail=false;});await page.getByRole('button',{name:'Retry saving'}).click();await page.getByText('This chapter changed elsewhere.',{exact:false}).waitFor();
    await page.evaluate(()=>{studyQA.readDelay=1000;});page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Use saved chapter',exact:true}).click();
    await move(page,'e7','e5');await page.getByRole('alert').filter({hasText:'You made newer edits while the saved chapter was loading.'}).waitFor();
    assert((await snapshots(page)).some(d=>Object.values(d.tree.nodes).some(n=>n.uci==='e7e5')),'Slow reload discarded a newer edit');
   },
   async recoverFromLiveTab(context){
    const a=await open(context,'offline');await move(a,'e2','e4');await a.getByRole('button',{name:'Retry saving'}).waitFor();const [original]=await snapshots(a);
    const b=await open(context,'offline');await b.getByRole('button',{name:'Restore draft',exact:true}).click();
    assert((await snapshots(a)).some(d=>d.id===original.id),'Restoring in another tab removed the live tab recovery copy');
    await b.getByRole('button',{name:'Next move',exact:true}).click();await move(b,'e7','e5');await b.getByRole('button',{name:'Retry saving'}).waitFor();
    await b.close({runBeforeUnload:false});await a.reload();await a.getByRole('region',{name:'Study recovery'}).waitFor();
    assert.equal(await a.getByRole('button',{name:'Restore draft',exact:true}).count(),2,'Distinct tab branches were lost');
    assert((await snapshots(a)).some(d=>d.id===original.id));
   },
   async touchControls(context){
    const page=await open(context);
    for(const [width,height]of [[390,844],[844,390],[820,1180],[1180,820],[1440,900]]){
     await page.setViewportSize({width,height});await page.getByText('Chapter actions',{exact:true}).tap();
     for(const name of ['Move chapter left','Move chapter right','Rename chapter','Delete chapter']){const button=page.getByRole('button',{name,exact:true});const box=await button.boundingBox();assert(box.height>=44&&box.width>=44,'Small touch target '+name);assert(box.x>=0&&box.x+box.width<=width,'Menu outside viewport');}
     assert(await page.getByRole('button',{name:'Move chapter left',exact:true}).isDisabled());await page.getByRole('button',{name:'Move chapter right',exact:true}).tap();
     await page.waitForFunction(()=>studyQA.read()[1].id==='chapter');await page.getByText('Chapter actions',{exact:true}).click();assert(await page.getByRole('button',{name:'Move chapter right',exact:true}).isDisabled());await page.getByRole('button',{name:'Move chapter left',exact:true}).click();
     await page.waitForFunction(()=>studyQA.read()[0].id==='chapter');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     const summary=page.getByText('Chapter actions',{exact:true});await summary.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Rename chapter',exact:true}).waitFor();
     await page.screenshot({path:`${out}/${engine}-${width}.png`,fullPage:true});await page.keyboard.press('Escape');assert(await summary.evaluate(el=>el===document.activeElement));assert.equal(await page.getByRole('button',{name:'Rename chapter',exact:true}).isVisible(),false);
    }
   }
  };
  const selected=process.env.QA_DRAFT_CASES?.split(',');if(selected?.some(name=>!cases[name]))throw new Error('Unknown QA_DRAFT_CASES selection');
  for(const [name,check]of Object.entries(cases).filter(([name])=>!selected||selected.includes(name))){
   const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const errors=[];context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
   await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   try{await check(context);assert.deepEqual(errors,[]);results.push({engine,name,result:'PASS'});}catch(e){results.push({engine,name,result:'FAIL',error:e.message,errors});for(const [i,p]of context.pages().entries())await p.screenshot({path:`${out}/FAIL-${engine}-${name}-${i}.png`,fullPage:true}).catch(()=>{});}
   console.log(JSON.stringify(results.at(-1)));await context.close();fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
  }
  await browser.close();
 }
 const failures=results.filter(r=>r.result==='FAIL');console.log(`Passed ${results.length-failures.length}/${results.length}`);if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
