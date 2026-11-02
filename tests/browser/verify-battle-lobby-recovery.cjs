const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = process.env.BATTLE_PREVIEW_URL || 'http://127.0.0.1:9482';
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  await context.routeWebSocket(/.*/,ws=>ws.close());
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const created=[];
  async function create(bot=false) {
    const response=await context.request.post(base+'/api/student/puzzle-battles',{data:{mode:'hide-and-seek',duration:600,...(bot?{botLevel:'gentle'}:{})}});
    assert.equal(response.status(),201,await response.text());
    const battle=(await response.json()).battle;created.push(battle.id);return battle;
  }
  async function lobby() {
    await page.goto(base+'/student/training/battle');
    await page.getByRole('heading',{name:'Puzzle Battle',exact:true}).waitFor();
  }
  try {
    await context.request.get(base+'/__qa/login');
    const waiting=await create();await lobby();
    const card=page.getByTestId('current-battle');
    await card.getByRole('button',{name:'Close challenge',exact:true}).click();
    await card.waitFor({state:'detached'});
    const closed=(await (await context.request.get(base+'/api/student/puzzle-battles/'+waiting.id)).json()).battle;
    assert.equal(closed.state.status,'cancelled');

    const bot=await create(true);await page.reload();
    await card.getByRole('button',{name:'Resume battle',exact:true}).click();
    await page.locator('[data-square]').first().waitFor();
    assert.ok(page.url().includes(bot.id));
    await page.getByRole('button',{name:'Battle lobby',exact:true}).click();
    await card.getByRole('button',{name:'Leave battle',exact:true}).click();
    await card.getByText('Leaving an ongoing battle gives your opponent the win.',{exact:true}).waitFor();
    await page.screenshot({path:'work/puzzle-battle/lobby-recovery-phone.png'});
    await card.getByRole('button',{name:'Confirm leave',exact:true}).click();
    await card.waitFor({state:'detached'});
    const left=(await (await context.request.get(base+'/api/student/puzzle-battles/'+bot.id)).json()).battle;
    assert.equal(left.state.status,'finished');assert.ok(left.state.players[0].forfeited);

    // Another tab starts a room after this page's last refresh. The conflict
    // immediately exposes recovery controls rather than an unhelpful dead end.
    const otherTab=await create();
    await page.getByRole('button',{name:'Create challenge',exact:true}).click();
    await card.getByRole('button',{name:'Close challenge',exact:true}).waitFor();
    await card.getByRole('button',{name:'Close challenge',exact:true}).click();
    await card.waitFor({state:'detached'});
    assert.notEqual(otherTab.id,waiting.id);
    await page.getByRole('button',{name:'Hide and Seek',exact:false}).click();
    const nextResponse=page.waitForResponse(r=>r.url().endsWith('/api/student/puzzle-battles')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Create challenge',exact:true}).click();
    const response=await nextResponse;assert.equal(response.status(),201,await response.text());
    const next=(await response.json()).battle;created.push(next.id);
    await page.getByRole('button',{name:'Battle lobby',exact:true}).waitFor();
    // Expiration should release the blocker without deleting its record.
    await context.request.get(base+'/__qa/expire?id='+next.id);
    await lobby();
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await card.waitFor({state:'detached'});
    const another=await create(true);assert.notEqual(another.id,next.id);
    const list=await (await context.request.get(base+'/api/student/puzzle-battles')).json();
    assert.equal(list.currentBattle.id,another.id);
    assert.equal(list.battles.some(item=>item.id===another.id),false,'Ongoing battles stay out of Open challenges');
    await context.request.get(base+'/__qa/bot-due?id='+another.id);
    const afterBotFinish=await create();
    assert.notEqual(afterBotFinish.id,another.id);
    const settled=(await (await context.request.get(base+'/api/student/puzzle-battles/'+another.id)).json()).battle;
    assert.equal(settled.state.status,'finished','Creation settles a bot that finished while its page was closed');
    const guest=await browser.newContext({viewport:{width:1366,height:900}});
    await guest.routeWebSocket(/.*/,ws=>ws.close());
    await guest.request.get(base+'/__qa/login?user=1');
    const joined=await guest.request.post(base+'/api/student/puzzle-battles',{data:{action:'join',code:afterBotFinish.code}});
    assert.equal(joined.status(),201,await joined.text());
    const guestPage=await guest.newPage();guestPage.setDefaultTimeout(15000);
    await guestPage.goto(base+'/student/training/battle');
    const guestCard=guestPage.getByTestId('current-battle');
    await guestCard.getByRole('button',{name:'Resume battle',exact:true}).waitFor();
    await guestPage.screenshot({path:'work/puzzle-battle/lobby-recovery-desktop.png'});
    await guestCard.getByRole('button',{name:'Leave battle',exact:true}).click();
    await guestCard.getByRole('button',{name:'Confirm leave',exact:true}).click();
    await guestCard.waitFor({state:'detached'});
    const guestNext=await guest.request.post(base+'/api/student/puzzle-battles',{data:{mode:'hide-and-seek',duration:60}});
    assert.equal(guestNext.status(),201,await guestNext.text());
    const guestId=(await guestNext.json()).battle.id;
    await guest.request.post(base+'/api/student/puzzle-battles/'+guestId,{data:{type:'leave',actionId:randomUUID()}});
    await guest.close();
    assert.deepEqual(errors,[]);
    console.log('PASS lobby recovery: close waiting, resume bot, confirmed leave, create again, other-tab conflict recovery, expiration, overdue bot settlement, separate open list, host/guest controls on phone/desktop.');
  } catch(error) { await page.screenshot({path:'work/puzzle-battle/lobby-recovery-failure.png'});throw error; }
  finally {
    for(const id of created) await context.request.post(base+'/api/student/puzzle-battles/'+id,{data:{type:'leave',actionId:randomUUID()}});
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
