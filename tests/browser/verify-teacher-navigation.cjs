// Run against the isolated TEACHER_QA fixture, never production.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const origin = process.env.TEACHER_QA_ORIGIN || 'http://127.0.0.1:9570';
assert.equal(new URL(origin).hostname, '127.0.0.1');
const output = 'work/teacher-navigation-qa';
fs.mkdirSync(output, { recursive: true });
const destinations = [
  ['/admin', null], ['/admin/students', null], ['/admin/live-games', null], ['/admin/tournaments', null], ['/admin/classes', null],
  ...['submissions', 'assessments', 'leaderboard', 'chess-performance', 'adaptive-training', 'chess-ratings', 'studies', 'activity'].map(p => [`/admin/${p}`, 'Review & progress']),
  ...['badges', 'quests', 'resources', 'avatar'].map(p => [`/admin/${p}`, 'Content & rewards'])
];
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const results = [];
  for (const [name, width, height] of [['desktop',1440,900],['tablet-portrait',820,1180],['tablet-landscape',1180,820],['mobile',390,844]]) {
    const context = await browser.newContext({viewport:{width,height},hasTouch:name !== 'desktop'});
    await context.route('**/*', route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.goto(`${origin}/__qa/teacher`);
    await page.goto(`${origin}/admin`);
    for (const [path, group] of destinations) {
      const errors = [], failures = [];
      const onError = e => errors.push(e.message);
      const onResponse = r => { if (r.status() >= 400 && new URL(r.url()).origin === origin) failures.push(`${r.status()} ${new URL(r.url()).pathname}`); };
      page.on('pageerror',onError);page.on('response',onResponse);
      try {
        if (width < 768) await page.locator('header summary').click();
        else if (group) {
          const details = page.locator('aside details').filter({has:page.locator('summary',{hasText:group})});
          if (!(await details.getAttribute('open')) && !(await details.evaluate(el => el.open))) await details.locator('summary').click();
        }
        const root = width < 768 ? page.locator('header details') : page.locator('aside');
        await root.locator(`a[href="${path}"]`).last().click();
        await page.waitForURL(`${origin}${path}`);
        await page.waitForTimeout(400);
        const body = await page.locator('main').innerText();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        const controls = await page.locator('main button,main summary,main select,main input,main a').evaluateAll(els => els.filter(el => el.getClientRects().length).map(el => ({tag:el.tagName,label:(el.getAttribute('aria-label')||el.textContent||el.getAttribute('placeholder')||'').trim().slice(0,90)})));
        const result = {device:name,path,overflow,errors,failures,body:body.slice(0,450),controls};
        if (width < 768) result.menuClosed = !(await page.locator('header details').evaluate(el=>el.open));
        results.push(result);
        await page.screenshot({path:`${output}/${name}-${path.replaceAll('/','_')}.png`});
      } catch(e) {results.push({device:name,path,error:e.message,errors,failures});await page.goto(`${origin}/admin`);}
      page.off('pageerror',onError);page.off('response',onResponse);
      fs.writeFileSync(`${output}/navigation.json`,JSON.stringify(results,null,2));
      const {controls,body,...brief}=results.at(-1);console.log(JSON.stringify(brief));
    }
    await context.close();
  }
  await browser.close();
  assert.equal(results.filter(r=>r.error||r.errors.length||r.failures.length||r.overflow||r.menuClosed===false).length,0,'Navigation or layout failures; see report');
})().catch(e=>{console.error(e);process.exitCode=1;});
