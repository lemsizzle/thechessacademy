const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
 const a=await b.newPage({viewport:{width:390,height:844},hasTouch:true});const other=await b.newPage({viewport:{width:1180,height:820},hasTouch:true});
 a.setDefaultTimeout(15000);other.setDefaultTimeout(15000);
 await a.goto('http://127.0.0.1:9421/?student=a');await other.goto('http://127.0.0.1:9421/?student=b');
 await a.getByRole('button',{name:'Challenge Blair',exact:true}).click();
 await a.getByRole('button',{name:'Cancel',exact:true}).click();await a.getByText('Blair: challenge cancelled.',{exact:true}).waitFor();
 await a.getByRole('button',{name:'Challenge Blair',exact:true}).click();await a.getByRole('button',{name:'Cancel',exact:true}).waitFor();await other.reload();
 await other.getByRole('complementary',{name:'Incoming live challenge'}).getByRole('button',{name:'Decline',exact:true}).click();await other.getByRole('complementary',{name:'Incoming live challenge'}).waitFor({state:'hidden'});await a.reload();await a.getByText('Blair: challenge declined.',{exact:true}).waitFor();
 await a.getByRole('button',{name:'Challenge Blair',exact:true}).click();await a.getByRole('button',{name:'Cancel',exact:true}).waitFor();await other.reload();
 await other.getByRole('complementary',{name:'Incoming live challenge'}).getByRole('button',{name:'Accept',exact:true}).click();
 await other.locator('#navigation').filter({hasText:'/student/play/live/fixture-game'}).waitFor();
 await a.reload();await a.getByRole('link',{name:'Open game with Blair',exact:true}).waitFor();
 assert(!await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 console.log('PASS: two isolated local sessions; challenge, cancel, rechallenge, decline, accept, game destination at phone/tablet sizes. Transport is fixture HTTP, not production Realtime.');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
