import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { AdminClassManager } from '../../components/admin/AdminClassManager';
import { AdminStorageNotice } from '../../components/admin/AdminStorageNotice';
import { ADMIN_STORE_KEY, ADMIN_STORE_UPDATED_EVENT } from '../../lib/mockStorage';
import { readAdminStorageArchive } from '../../lib/adminStorageBackup';
// Local test data only. Mimic a server with sessionStorage so reloads retain saves.
if (!sessionStorage.getItem('recovery-fixture-seeded')) {
  localStorage.setItem(ADMIN_STORE_KEY, JSON.stringify({classGroups:[{id:'local-knights',name:'Test Knights',outschoolClassUrl:'https://outschool.com/classes/test-knights',outschoolSectionId:'test-section',syncStatus:'linked'}],resources:[{id:'local-resource',title:'Keep me'}],lichessActivitySnapshots:[{id:'snapshot',data:{games:'x'.repeat(3000000)}}]}));
  sessionStorage.setItem('recovery-fixture-seeded','true');
}
const realSet = Storage.prototype.setItem;
Storage.prototype.setItem = function(key,value) {
  if (this === localStorage && key === ADMIN_STORE_KEY && value.length > 100000) throw new DOMException('Fixture quota','QuotaExceededError');
  return realSet.call(this,key,value);
};
let server=JSON.parse(sessionStorage.getItem('fixture-class-server')||'{"groups":[],"revision":0}');
window.fetch=async (url,options={})=>{
  let body=server,status=200;
  if(options.method==='POST') {
    const input=JSON.parse(options.body);
    if (input.import && server.revision>0) body={...server,imported:false};
    else if(input.revision!==server.revision) {status=409;body={error:'Another tab changed these classes. Reload classes before saving; your draft is still here.'};}
    else {server={groups:input.groups,revision:server.revision+1};sessionStorage.setItem('fixture-class-server',JSON.stringify(server));body=server;}
  }
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
};
function Preview(){
 const [bytes,setBytes]=useState(localStorage.getItem(ADMIN_STORE_KEY)?.length||0);const [backup,setBackup]=useState(false);
 useEffect(()=>{const refresh=()=>{setBytes(localStorage.getItem(ADMIN_STORE_KEY)?.length||0);readAdminStorageArchive().then(x=>setBackup(!!x));};window.addEventListener(ADMIN_STORE_UPDATED_EVENT,refresh);refresh();return()=>window.removeEventListener(ADMIN_STORE_UPDATED_EVENT,refresh);},[]);
 return <><h1 className="text-2xl font-bold">Class settings recovery · local test</h1><p className="py-4">Browser cache: {bytes} characters · Original backup retained: {backup?'yes':'no'}</p><AdminStorageNotice/><AdminClassManager/><button className="mt-6 underline" onClick={()=>{server.revision++;sessionStorage.setItem('fixture-class-server',JSON.stringify(server));}}>Simulate other tab save</button></>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
