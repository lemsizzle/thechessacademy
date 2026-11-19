import { Sidebar } from '../../components/Sidebar';
import { StudentNavigation } from '../../components/student/StudentNavigation';
import { StudentMenuNavigation, StudentMenuPage } from '../../components/student/StudentMenuNavigation';
import { StrictMode } from "react";
import { PuzzleSurvival } from "../../components/training/PuzzleSurvival";
import { emptyPuzzleTrainingOverview } from "../../lib/puzzle-training/overview";
import { TrainingSessionRewardsProvider } from "../../components/training/TrainingSessionRewards";
// Actual game components with isolated reward responses. Never spends or grants real currency.
import { createRoot } from 'react-dom/client';
import { StarWarsTraining } from '../../components/training/StarWarsTraining';
import { HideAndSeekTraining } from '../../components/training/HideAndSeekTraining';
import { starWarsPuzzleForScore, initialStarWarsState, findStarWarsSolution } from '../../lib/puzzle-training/starWars';
import { generateHideAndSeekBoard, calculateHideAndSeekScore } from '../../lib/puzzle-training/hideAndSeek';
const query = new URLSearchParams(location.search);
const hide = query.has('hide');
let board;
for(let n=0;n<1000;n++) { const b=generateHideAndSeekBoard(n.toString(16).padStart(32,'0')); if(b.safeSquares.length>=10&&b.safeSquares.length<=24){board=b;break;} }
let savedScore=0, mode='classic', hideResult, failSave=query.has('retry');
window.trainingQA = { startRequests: [], finishRequests: [], safeSquares: board.safeSquares, solution: score => findStarWarsSolution(initialStarWarsState(starWarsPuzzleForScore(score,0))) };
let runId;
window.fetch=async(url,options={})=>{
  const path=String(url), body=options.body?JSON.parse(options.body):{};
  await new Promise(r=>setTimeout(r,80));
  const now=new Date().toISOString();
  if(path.endsWith('/star-wars/start')) { window.trainingQA.startRequests.push({mode:'path',...body}); savedScore=0; runId=crypto.randomUUID(); return Response.json({run:{runId,runVariant:0,score:0,personalBest:0,mode:body.mode,timeLimitMs:body.timeLimitMs,startedAt:now,serverSentAt:now},serverReceivedAt:now}); }
  if(path.endsWith('/star-wars/progress')) {
    if(failSave){failSave=false;return Response.json({error:'Simulated save failure'},{status:503});}
    savedScore=Math.max(savedScore,body.startScore+body.routes.length);
    return Response.json({result:{score:savedScore,personalBest:savedScore,rewardXp:savedScore*2}});
  }
  if(path.endsWith('/hide-and-seek/start')) { window.trainingQA.startRequests.push({mode:'hide',...body}); mode=body.mode;hideResult=null;return Response.json({round:{id:crypto.randomUUID(),pieces:board.pieces,mode,timeLimitMs:mode==='time_trial'?60000:null,startedAt:now,expiresAt:new Date(Date.now()+1800000).toISOString()},token:'fixture',serverReceivedAt:now,serverSentAt:now}); }
  if(path.endsWith('/hide-and-seek/finish')) {
    window.trainingQA.finishRequests.push(body);
    if(failSave){failSave=false;return Response.json({error:'Simulated save failure'},{status:503});}
    const score=calculateHideAndSeekScore({safeSquares:board.safeSquares,selectedSquares:body.selectedSquares,elapsedMs:5000,mode});
    hideResult??={...score,mode,personalBest:score.score,completedAt:now,rewardXp:score.correctCount===score.totalSafe&&!(mode==='hard'&&score.wrongCount>0)?10:0};
    return Response.json({result:hideResult});
  }
  return Response.json({events:[],cursor:now});
};
const route=findStarWarsSolution(initialStarWarsState(starWarsPuzzleForScore(0,0)));
const content = <TrainingSessionRewardsProvider studentId="fixture">{!query.has('layout') && <aside aria-label="Test instructions" className="mb-4 text-sm">{hide?'Safe squares: '+board.safeSquares.join(', '):'First mission: '+route.map(m=>m.from+' → '+m.to).join(', ')}</aside>}{query.has('launcher')?<PuzzleSurvival initialOverview={emptyPuzzleTrainingOverview}/>:hide?<HideAndSeekTraining onExit={()=>{}}/>:<StarWarsTraining onExit={()=>{}}/>}</TrainingSessionRewardsProvider>;
createRoot(document.getElementById('root')).render(<StrictMode>{query.has('layout') ? <StudentMenuNavigation>
  <div className="student-portal-shell academy-grid min-h-screen"><div className="flex min-h-screen">
    <Sidebar variant="student" /><div className="min-w-0 flex-1">
      <StudentNavigation studentName="Puzzle Explorer" onLogout={()=>{}} />
      <main className="student-play-area mx-auto w-full max-w-7xl px-4 pb-28 pt-6 md:pb-6 lg:px-6">
        <div data-page-heading className="mb-6"><h1 className="text-2xl font-black">Puzzle Training</h1></div>
        <StudentMenuPage>{content}</StudentMenuPage>
      </main>
    </div>
  </div></div>
</StudentMenuNavigation> : content}</StrictMode>);
