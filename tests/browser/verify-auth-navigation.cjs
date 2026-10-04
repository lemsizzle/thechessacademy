// Run against a local production build; OAuth endpoints are intercepted.
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const origin=process.env.QA_AUTH_ORIGIN||'http://localhost:9430';
(async()=>{
 let passed=0;
 for(const engine of ['chromium','webkit']){
  const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'&&process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
  for(const [path,label,endpoint] of [['/','Log in with Lichess','/api/auth/lichess/start'],['/login','Continue with Google','/api/auth/google/start']]){
   const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await context.newPage();const requests=[];const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname===endpoint){requests.push({navigation:req.isNavigationRequest(),type:req.resourceType()});return route.fulfill({contentType:'text/html',body:'<h1>QA OAuth destination</h1>'});}
    if(url.origin!==new URL(origin).origin)return route.abort();
    return route.continue();
   });
   await page.goto(origin+path,{waitUntil:'networkidle'});const link=page.getByRole('link',{name:label,exact:true});await link.scrollIntoViewIfNeeded();await link.hover();await page.waitForTimeout(600);
   assert.deepEqual(requests,[],'Viewing or hovering the login link started OAuth');
   await link.click();await page.getByRole('heading',{name:'QA OAuth destination'}).waitFor();
   assert.deepEqual(requests,[{navigation:true,type:'document'}],'OAuth must be exactly one document navigation after clicking');
   assert.deepEqual(errors,[]);console.log(JSON.stringify({engine,path,result:'PASS'}));passed++;await context.close();
  }
  await browser.close();
 }
 console.log('Passed '+passed+'/4');
})().catch(e=>{console.error(e);process.exit(1);});
