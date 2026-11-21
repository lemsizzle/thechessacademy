const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const origin=process.env.ASSESSMENT_QA_ORIGIN || 'http://127.0.0.1:9528';
const output='work/assessment';
const authored=Object.fromEntries([...fs.readFileSync('lib/assessment/questions.ts','utf8').matchAll(/q\("([^"]+)",[^\n]*?, (\["[^\n]*?"\]), ([0-3]), /g)].map(match=>[match[1],JSON.parse(match[2])[Number(match[3])]]));
async function visible(locator){await locator.waitFor({state:'visible',timeout:20000});}
async function saved(page){await visible(page.getByText('All answers saved',{exact:true}));}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/__qa/login');await page.goto(origin+'/student/training/assessment');
    await page.getByRole('button',{name:'Start 30-minute test'}).click();
    await visible(page.getByText('Question 1 of 30 · Rules',{exact:true}));
    let payload=await (await context.request.get(origin+'/api/student/assessment')).json();
    const id=payload.attempt.id;
    assert.equal(payload.questions.length,30);assert.equal(payload.review,undefined);assert.ok(payload.questions.every(q=>!('answer'in q)&&!('explanation'in q)));
    const questions=payload.questions;
    assert.equal(Object.keys(authored).length,30);
    const keys=Object.fromEntries(questions.map(q=>[q.id,q.options.find(o=>o.text===authored[q.id]).id]));
    for(let i=0;i<questions.length;i++){
      const q=questions[i];
      if(i===5){
        await context.setOffline(true);await page.locator(`input[name="${q.id}"][value="${keys[q.id]}"]`).check();
        await visible(page.getByText('Not saved yet. Reconnect and retry before time runs out.',{exact:true}));
        await page.getByRole('button',{name:'Retry save',exact:true}).click();
        await context.setOffline(false);await saved(page);
        await page.reload();await visible(page.getByText('Question 1 of 30 · Rules',{exact:true}));
        await page.getByRole('button',{name:/All questions/}).click();await page.getByRole('button',{name:'Question 6, answered',exact:true}).click();
        assert.equal(await page.locator(`input[name="${q.id}"][value="${keys[q.id]}"]`).isChecked(),true);
      }else if(i!==29){await page.locator(`input[name="${q.id}"][value="${i===0?q.options.find(o=>o.id!==keys[q.id]).id:keys[q.id]}"]`).check();}
      if(i===4){
        await page.screenshot({path:output+'/desktop.png',fullPage:true});
        for(const [name,width,height] of [['tablet',820,1180],['phone',390,844]]){
          await page.setViewportSize({width,height});await page.screenshot({path:output+'/'+name+'.png',fullPage:true});
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow '+name);
        }
        await page.setViewportSize({width:1440,height:1000});
      }
      if(i<29)await page.getByRole('button',{name:'Next',exact:true}).click();
    }
    await page.getByRole('button',{name:'Finish test',exact:true}).click();await visible(page.getByText(/1 question is unanswered/));
    await page.getByRole('button',{name:'Keep working',exact:true}).click();
    await page.getByRole('button',{name:'Finish test',exact:true}).click();await page.getByRole('button',{name:'Submit answers',exact:true}).click();
    await visible(page.getByRole('heading',{name:'Your score: 93/100'}));
    await page.screenshot({path:output+'/result.png',fullPage:true});
    const result=await (await context.request.get(origin+'/api/student/assessment?attempt='+id)).json();
    assert.equal(result.attempt.correct_count,28);assert.equal(result.review.length,30);
    const replay=await (await context.request.post(origin+'/api/student/assessment',{data:{action:'submit',attemptId:id,answers:keys}})).json();assert.equal(replay.attempt.correct_count,28);
    await page.reload();await visible(page.getByRole('heading',{name:'Your previous results'}));await page.getByRole('button',{name:'Review result',exact:true}).click();await visible(page.getByRole('heading',{name:'Your score: 93/100'}));
    const other=await browser.newContext(),b=await other.newPage();await b.goto(origin+'/__qa/login?user=1');
    const denied=await (await other.request.get(origin+'/api/student/assessment?attempt='+id)).json();assert.equal(denied.attempt,null);
    assert.equal((await other.request.post(origin+'/api/student/assessment',{data:{action:'save',attemptId:id,answers:{r1:'a'}}})).status(),503);
    await b.goto(origin+'/student/training/assessment');await b.getByRole('button',{name:'Start 30-minute test'}).click();await b.getByRole('radio',{name:'Knight',exact:true}).check();await saved(b);
    const active=await (await other.request.get(origin+'/api/student/assessment')).json();
    await other.request.get(origin+'/__qa/assessment-expire?id='+active.attempt.id+'&seconds=4');await b.reload();
    await visible(b.getByRole('heading',{name:'Your score: 3/100'}));
    const late=await (await other.request.post(origin+'/api/student/assessment',{data:{action:'submit',attemptId:active.attempt.id,answers:keys}})).json();assert.equal(late.attempt.correct_count,1);
    const teacher=await browser.newContext(),t=await teacher.newPage();await t.goto(origin+'/__qa/teacher');await t.goto(origin+'/admin/assessments');await visible(t.getByRole('cell',{name:/93\s*\/100\s*28\s*\/30/}));await visible(t.getByRole('rowheader',{name:'Explorer A'}));await t.screenshot({path:output+'/teacher.png',fullPage:true});
    const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(origin+'/api/student/assessment')).status(),401);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,checks:['30-question flow','correct/wrong/blank scoring','private answer keys','offline retry','reload resume','early-submit confirmation','immutable results','history','ownership','automatic deadline','late-answer rejection','teacher persisted results','desktop/tablet/phone'],screenshots:output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
