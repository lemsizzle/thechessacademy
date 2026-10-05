import { createRoot } from 'react-dom/client';
import { StrictMode, useEffect, useState } from 'react';
import { StudyEditor } from '../../chess/components/StudyEditor';
import { createEmptyAnalysisTree } from '../../chess/analysis/tree';
import { clearStudyDraftsOnLogout } from '../../chess/analysis/studyDrafts';
import { clearCurrentStudentUser } from '../../lib/auth/getCurrentUser';

const params = new URLSearchParams(location.search);
const ownerKey = params.get('owner') || 'student:alice';
const serverKey = 'qa-study-drafts-server';
const chapter = id => { const tree = createEmptyAnalysisTree(); return {id,studyId:'fixture',title:id==='chapter'?'Opening practice':'Endgame practice',sortOrder:id==='chapter'?0:100,initialFen:tree.nodes[tree.rootId].fen,tree,sourceGameId:null,metadata:{},version:1,updatedAt:new Date().toISOString()}; };
if (!localStorage.getItem(serverKey)) localStorage.setItem(serverKey,JSON.stringify([chapter('chapter'),chapter('second')]));
const read=()=>JSON.parse(localStorage.getItem(serverKey));
const write=chapters=>localStorage.setItem(serverKey,JSON.stringify(chapters,params.has('jsonb')?(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value:undefined));
window.studyQA={requests:[],fail:params.has('offline'),delay:150,readDelay:0,loseCopyResponse:false,read,logout:clearStudyDraftsOnLogout,sessionLookupFailed:clearCurrentStudentUser,remoteEdit(){const rows=read();rows[0].version++;rows[0].tree.nodes[rows[0].tree.rootId].comment='Saved by another editor';write(rows);}};
window.fetch=async(url,options={})=>{
 const path=String(url),method=options.method||'GET',body=options.body?JSON.parse(options.body):{};
 window.studyQA.requests.push({path,method,body});
 const id=path.match(/\/chapters\/([^/]+)$/)?.[1];
 if(id && method==='PATCH'){
  await new Promise(resolve=>setTimeout(resolve,window.studyQA.delay));
  if(window.studyQA.fail)return Response.json({error:'Simulated connection interrupted'},{status:503});
  const rows=read(),saved=rows.find(c=>c.id===id);
  if(body.version!==saved.version)return Response.json({error:'Chapter changed elsewhere. Reload before saving.'},{status:409});
  Object.assign(saved,body,{version:saved.version+1,updatedAt:new Date().toISOString()});write(rows);return Response.json({chapter:saved});
 }
 if(path.endsWith('/chapters') && method==='POST'){
  await new Promise(resolve=>setTimeout(resolve,100));
  if(window.studyQA.fail)return Response.json({error:'Simulated connection interrupted'},{status:503});
  const rows=read();const existing=body.recoveryId&&rows.find(c=>c.id===body.recoveryId);if(existing)return Response.json({chapter:existing});
  const saved={...chapter(body.recoveryId||crypto.randomUUID()),title:body.title||'New chapter',tree:body.analysisTree||createEmptyAnalysisTree(),sortOrder:rows.length*100};rows.push(saved);write(rows);
  if(window.studyQA.loseCopyResponse){window.studyQA.loseCopyResponse=false;throw new TypeError('Synthetic lost copy response');}
  return Response.json({chapter:saved});
 }
 if(path.endsWith('/chapters') && method==='PATCH'){const rows=read();write(body.chapterIds.map((id,i)=>({...rows.find(c=>c.id===id),sortOrder:i*100})));return Response.json({ok:true});}
 if(path.endsWith('/studies/fixture')){
  await new Promise(resolve=>setTimeout(resolve,window.studyQA.readDelay));
  return Response.json({study:{id:'fixture',title:'Recovery notebook',description:'Synthetic local test only',visibility:'private',ownerKind:'student',accessRole:params.has('viewer')?'viewer':'owner',updatedAt:new Date().toISOString()},chapters:read(),draftOwnerKey:ownerKey});
 }
 return Response.json({assignments:[],progress:[],exercises:[]});
};
function App(){
 const [library,setLibrary]=useState(new URLSearchParams(location.search).has('library'));
 useEffect(()=>{const update=()=>setLibrary(new URLSearchParams(location.search).has('library'));addEventListener('popstate',update);return()=>removeEventListener('popstate',update);},[]);
 return <main className="mx-auto max-w-7xl p-4"><a href={'/?'+params.toString()+'&library=1'} className="mb-4 inline-flex min-h-11 items-center underline" onClick={e=>{e.preventDefault();history.pushState({},'',e.currentTarget.href);setLibrary(true);}}>Test library navigation</a>{library?<p>Study library. Use browser Back to reopen.</p>:<StudyEditor studyId="fixture" basePath="/student"/>}</main>;
}
createRoot(document.getElementById('root')).render(params.has('strict')?<StrictMode><App/></StrictMode>:<App/>);
