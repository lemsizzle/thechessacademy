// Requires npm run build, then node tests/browser/displayed-badge-server.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BADGE_PREVIEW_URL || 'http://127.0.0.1:3109';
const output = 'work/displayed-badge';
const badgeId = n => `30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const adamantium=badgeId(1), fork=badgeId(2), locked=badgeId(3), bronze=badgeId(4), gold=badgeId(5);
fs.mkdirSync(output,{recursive:true});

async function main() {
  const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',route => ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  const page = await context.newPage(); const errors = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror',error => errors.push(error.message));
  const chosen = async () => (await (await page.request.get(`${base}/api/student/displayed-badge`)).json()).displayedBadge?.id ?? null;
  const navIcon = () => page.locator('header [data-displayed-badge]');
  const noOverflow = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),'Page must fit the viewport');
  const open = async name => { await page.locator('#trophy-case').getByRole('button',{name:`View ${name} badge details`,exact:true}).click(); await page.getByRole('dialog').waitFor(); };
  const close = async () => page.getByRole('button',{name:'Close badge details',exact:true}).click();
  const feature = async name => {
    await page.getByRole('dialog').getByRole('button',{name:'Feature badge',exact:true}).click();
    await page.getByRole('dialog').getByRole('status').filter({hasText:`${name} is now featured`}).waitFor();
    await page.getByRole('dialog').getByRole('button',{name:'Unfeature badge',exact:true}).waitFor();
  };
  try {
    await page.request.get(`${base}/__qa/reset`);
    assert.equal((await page.request.patch(`${base}/api/student/displayed-badge`,{data:{badgeId:adamantium}})).status(),401);
    await page.goto(`${base}/__qa/login`);
    assert.equal(await page.locator('select').count(),0,'The old dropdown must be removed');
    await page.getByRole('link',{name:'Go to Trophy Case',exact:true}).click();
    await page.locator('#trophy-case').waitFor();
    assert.equal(await page.locator('#trophy-case').getByRole('button',{name:'View Pawn Mate badge details',exact:true}).count(),0,'Unearned badges must not appear in the trophy case');
    await open('Survival Adamantium'); await feature('Survival Adamantium');
    assert.equal(await chosen(),adamantium); assert.equal(await navIcon().getAttribute('data-displayed-badge'),adamantium);
    await page.screenshot({path:`${output}/feature-popup-desktop.png`});
    await close();
    await page.locator('#trophy-case').getByText('★ Featured',{exact:true}).waitFor();
    await page.reload(); await open('Survival Adamantium');
    await page.getByRole('dialog').getByRole('button',{name:'Unfeature badge',exact:true}).waitFor(); await close();
    await open('Royal Family Fork'); await feature('Royal Family Fork'); await close();
    assert.equal(await chosen(),fork);
    const forged = await page.request.patch(`${base}/api/student/displayed-badge`,{data:{badgeId:locked,studentId:'20000000-0000-4000-8000-000000000003'}});
    assert.equal(forged.status(),403); assert.equal(await chosen(),fork);
    await page.request.get(`${base}/__qa/fail-next`); await open('Survival Adamantium');
    await page.getByRole('dialog').getByRole('button',{name:'Feature badge',exact:true}).click();
    await page.getByRole('dialog').getByRole('alert').filter({hasText:'could not be saved'}).waitFor();
    assert.equal(await chosen(),fork); assert.equal(await navIcon().getAttribute('data-displayed-badge'),fork);
    await feature('Survival Adamantium'); await close();
    // Use the selected earned tier's ID, not the group card's highest tier.
    await open('Fork Finder Gold');
    await page.getByRole('dialog').getByRole('button',{name:'View Fork Finder Bronze Bronze tier',exact:true}).click();
    await feature('Fork Finder Bronze'); assert.equal(await chosen(),bronze); await close();
    await open('Fork Finder Gold'); await feature('Fork Finder Gold'); assert.equal(await chosen(),gold); await close();
    await open('Survival Adamantium'); await feature('Survival Adamantium'); await close();
    await noOverflow(); await page.screenshot({path:`${output}/trophy-case-desktop.png`,fullPage:true});
    // Catalog and read-only trophy dialogs must never offer feature controls.
    await page.goto(`${base}/student/badges`);
    assert.equal(await page.locator('select').count(),0);
    await page.getByRole('button',{name:'Pawn Mate',exact:true}).click();
    assert.equal(await page.getByRole('dialog').getByRole('button',{name:/^(?:Unfeature|Feature) badge$/}).count(),0); await close();
    await page.goto(`${base}/student/students/quest-knight`);
    await open('Pawn Mate');
    assert.equal(await page.getByRole('dialog').getByRole('button',{name:/^(?:Unfeature|Feature) badge$/}).count(),0); await close();
    for (const [path,name] of [['/student/students/puzzle-explorer','profile'],['/student/leaderboard','leaderboard'],['/student/play','computer']]) {
      await page.goto(`${base}${path}`);
      await page.locator('[data-displayed-badge]').first().waitFor();
      if (name === 'computer') {
        await page.getByRole('button',{name:'Computer Choose a bot and play right away.',exact:true}).click();
        await page.getByRole('button',{name:'Start vs Pawny',exact:true}).click(); await page.getByRole('grid').waitFor();
      }
      await page.waitForFunction(id => document.querySelectorAll(`[data-displayed-badge="${id}"]`).length >= 2,adamantium);
      await noOverflow();
    }
    for (const [width,height,name] of [[1024,768,'tablet'],[390,844,'mobile']]) {
      await page.setViewportSize({width,height}); await page.goto(`${base}/student#trophy-case`); await open('Royal Family Fork');
      if (await page.getByRole('dialog').getByRole('button',{name:'Unfeature badge',exact:true}).count()) {
        await page.getByRole('dialog').getByRole('button',{name:'Unfeature badge',exact:true}).click();
        await page.getByRole('dialog').getByRole('status').filter({hasText:'has been removed'}).waitFor();
      }
      await feature('Royal Family Fork'); assert.equal(await chosen(),fork);
      await page.getByRole('dialog').getByRole('button',{name:'Unfeature badge',exact:true}).click();
      await page.getByRole('dialog').getByRole('status').filter({hasText:'has been removed'}).waitFor();
      assert.equal(await chosen(),null); assert.equal(await navIcon().count(),0);
      await feature('Royal Family Fork'); await noOverflow();
      assert(await page.getByRole('dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth),'Popup must not overflow horizontally');
      await page.screenshot({path:`${output}/feature-popup-${name}.png`}); await close();
    }
    await open('Royal Family Fork');
    await page.getByRole('dialog').getByRole('button',{name:'Unfeature badge',exact:true}).click();
    await page.getByRole('dialog').getByRole('status').filter({hasText:'has been removed'}).waitFor(); await close();
    await page.reload(); assert.equal(await chosen(),null); assert.equal(await navIcon().count(),0);
    const state = await (await page.request.get(`${base}/__qa/state`)).json();
    assert.equal(state.coins,500); assert.equal(state.students[0].total_xp,1000);
    assert(state.earned.find(row=>row.badge_id===locked).is_displayed,'Another student must be unaffected');
    await page.request.get(`${base}/__qa/empty`); await page.reload();
    await page.getByText('Your first trophy spot is ready.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:/^(?:Unfeature|Feature) badge$/}).count(),0);
    assert.deepEqual(errors,[]);
    await page.request.get(`${base}/__qa/reset`);
    assert.equal((await page.request.patch(`${base}/api/student/displayed-badge`,{data:{badgeId:adamantium}})).status(),200);
    console.log(JSON.stringify({verified:['only trophy popups can feature badges','save and reload','switch and lower earned tier','unearned and other students excluded','failure and retry','name tags','desktop, tablet and mobile popup controls','unfeature and empty case','unchanged rewards'],writes:state.writes.length,screenshots:output},null,2));
  } catch(error) {
    await page.screenshot({path:`${output}/failure.png`,fullPage:true}); console.error('Browser check failed at',page.url()); throw error;
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
