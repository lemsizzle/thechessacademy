import { createRoot } from 'react-dom/client';
import { StudyEditor } from '../../chess/components/StudyEditor';
import { StudyLibrary } from '../../chess/components/StudyLibrary';
import { createEmptyAnalysisTree } from '../../chess/analysis/tree';
const params = new URLSearchParams(location.search);
const tree = createEmptyAnalysisTree();
const chapter = { id:'chapter', studyId:'fixture', title:'Opening practice', sortOrder:0, initialFen:tree.nodes[tree.rootId].fen, tree, sourceGameId:null, metadata:{}, version:1, updatedAt:new Date().toISOString() };
const chapterTwo = {...chapter, id:'second',title:'Endgame practice'};
const study = {id:'fixture', title:'QA notebook', description:'Local synthetic study', visibility:'private', ownerKind:'teacher', accessRole:params.has('viewer')?'viewer':'owner', updatedAt:new Date().toISOString()};
let failSave = params.has('failSave'), failAdd = params.has('failAdd');
window.studyQA = {requests:[], chapter, chapterTwo, failNext:()=>{failSave=true;}};
window.fetch = async (url, options={}) => {
  const path=String(url), method=options.method||'GET', body=options.body?JSON.parse(options.body):{};
  window.studyQA.requests.push({path,method,body});
  if(path.endsWith('/chapters/chapter') && method==='PATCH') {
    await new Promise(resolve=>setTimeout(resolve,150));
    if(failSave) {failSave=false;return Response.json({error:'Simulated interrupted save'},{status:503});}
    Object.assign(chapter,body,{version:chapter.version+1});
    return Response.json({chapter});
  }
  if(path.endsWith('/chapters') && method==='POST') {
    if(failAdd){failAdd=false;throw new TypeError('Failed to fetch');}
    return Response.json({chapter:{...chapter,id:'added',title:body.title||'Imported game'}});
  }
  if(path.endsWith('/studies/fixture')) return Response.json({study,chapters:[chapter,chapterTwo],draftOwnerKey:params.has('teacher')?'admin':'student:qa'});
  if(path.endsWith('/studies')) return Response.json({studies:[{...study,chapterCount:2}]});
  if(path.includes('/games?')) return Response.json({games:[{id:'game',opponentName:'QA bot',result:'win',completedAt:new Date().toISOString(),moves:[]}]});
  if(path.includes('/members'))return Response.json({members:[]});
  if(path.includes('/students'))return Response.json({students:[{id:'local-student',name:'QA student',slug:'qa'}]});
  return Response.json({assignments:[],progress:[],exercises:[]});
};
createRoot(document.getElementById('root')).render(<main className="p-4">{params.has('library')?<StudyLibrary basePath="/student"/>:<StudyEditor studyId="fixture" basePath={params.has('teacher')?'/admin':'/student'}/>}</main>);
