import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { PuzzleSurvival } from '../../components/training/PuzzleSurvival';
import { emptyPuzzleTrainingOverview } from '../../lib/puzzle-training/overview';
import { prepareTrainingPuzzle, validatePuzzleMove } from '../../lib/puzzle-training/engine';
import { forkPuzzle, pinPuzzle, skewerPuzzle } from '../fixtures/lichessPuzzles';

// Isolated actual UI, real chess validation, delayed fake network; no production calls.
const failPreload = new URLSearchParams(location.search).has('failPreload');
let holdMoves = false, releaseMove = null;
const rows = [forkPuzzle, pinPuzzle, skewerPuzzle];
const issued = new Map();
let nextIndex=0, gets=0, moves=0, prepared=0, pending=null, transition='none yet';
const notify=()=>window.dispatchEvent(new Event('fixture-stats'));
const delay=(ms,signal)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(resolve,ms);
 signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});
});
function publicPuzzle(row,index){const board=prepareTrainingPuzzle(row);const token=row.id;issued.set(token,row);return {id:row.id,displayFen:board.displayFen,orientation:board.orientation,sideToMove:board.sideToMove,prompt:`Practice position ${index+1}`,sourceKind:'lichess',token,daily:null};}
window.fetch=async(url,options={})=>{
 const path=String(url);
 if(path.includes('/puzzle?')){
  gets++;const requestNumber=gets;notify();const query=new URL(path,location.origin).searchParams;const index=nextIndex++%rows.length;
  const row=query.get('puzzleId')?rows.find(r=>r.id===query.get('puzzleId')):rows[index];
  await delay(1200,options.signal);
  if(failPreload&&requestNumber===2)return Response.json({error:'Simulated preload failure'},{status:503});
  prepared++;notify();return Response.json({puzzle:publicPuzzle(row,index)});
 }
 if(path.endsWith('/move')){
  moves++;notify();const started=performance.now();const input=JSON.parse(options.body);const row=issued.get(input.token.replace(':active',''));
  const result=validatePuzzleMove(row,1,input.move);
  if(holdMoves)await new Promise(resolve=>{releaseMove=resolve;notify();});
  await delay(result.accepted&&!input.nextPuzzleToken?550:50,options.signal);
  if(!result.accepted)return Response.json({...result,token:input.token,message:'Try again.'});
  const next=issued.get(input.nextPuzzleToken);
  const acknowledged=performance.now();pending={started,acknowledged,previous:row.id};
  return Response.json({...result,token:input.token,message:'Correct!',completion:{themes:row.themes,rating:row.rating,mistakes:0,hintsUsed:0,elapsedSeconds:4},preparedNextPuzzle:next?{id:next.id,token:next.id+':active'}:undefined});
 }
 return Response.json({});
};
function Stats(){const [,render]=useState(0);useEffect(()=>{const fn=()=>render(n=>n+1);window.addEventListener('fixture-stats',fn);return()=>window.removeEventListener('fixture-stats',fn);},[]);return <aside className="rounded bg-slate-800 p-3 mb-3" aria-label="Test measurements">AFTER · puzzle requests {gets} · ready responses {prepared} · moves {moves} · transition {transition}<label className="ml-4"><input type="checkbox" checked={holdMoves} onChange={e=>{holdMoves=e.target.checked;notify();}}/> Hold move response</label><button className="ml-4" disabled={!releaseMove} onClick={()=>{releaseMove?.();releaseMove=null;notify();}}>Release response</button></aside>;}
const observer=new MutationObserver(()=>{
 if(!pending)return;
 const expected=rows.find(r=>r.id!==pending.previous&&document.querySelector(`[data-square="${r===pinPuzzle?'g2':r===skewerPuzzle?'a4':'e5'}"] [data-piece]`));
 if(expected){transition=`${Math.round(performance.now()-pending.started)} ms from move; ${Math.round(performance.now()-pending.acknowledged)} ms after confirmation`;pending=null;notify();}
});
observer.observe(document.getElementById('root'),{childList:true,subtree:true});
createRoot(document.getElementById('root')).render(<><Stats/><PuzzleSurvival initialOverview={emptyPuzzleTrainingOverview}/></>);
