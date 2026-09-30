// Local presentation fixture; every request is intercepted and uses synthetic data.
import { createRoot } from 'react-dom/client';
import { AppShell } from '../../components/AppShell';
import { StudentJourneyDashboard } from '../../components/student/StudentJourneyDashboard';
import { StudentLichessQuestList } from '../../components/quests/StudentLichessQuestList';
import { AdminPanel } from '../../components/admin/AdminPanel';
import { buildStudentDashboardProgress, emptyStudentDashboardQuestSummary, emptyStudentDashboardTraining } from '../../lib/student/dashboardProjection';
const student = { id:'student-fixture',name:'Alex',slug:'alex',avatar:'A',classGroup:'Chess Club',totalXp:500,badgeIds:[],encouragement:'Keep exploring.' };
const quest = {id:'fixture-quest',title:'Play a Chess Quest game',description:'Complete a game here.',source:'internal_games',conditionType:'internal_games_played_count',requiredCount:1,timeWindow:'all_time',type:'weekly',status:'available',isLive:true,isActive:true,xpReward:100};
window.fetch = async (url,options={}) => {
  const path=String(url);
  if(path.includes('/api/lichess/')) throw new Error('Unexpected Lichess activity request');
  if(path==='/api/auth/session')return Response.json({user:{id:'fixture',studentId:student.id,name:student.name,role:'student',authProvider:'lichess',lichessUsername:'Alex',onboardingCompleted:true}});
  if(path==='/api/quests')return Response.json({data:[quest,{...quest,id:'old',title:'Retired external quest',source:'lichess_games'}]});
  if(path.includes('/api/quests/evaluate/'))return Response.json({progress:[],newAwards:[],autoCompletions:[]});
  if(path==='/api/admin/quests')return Response.json({quests:[quest]});
  return Response.json({progress:[],attempts:[],completions:[],transactions:[],games:[],summary:{total:0,wins:0,draws:0,losses:0,winRate:0},pagination:{page:1,totalPages:1,total:0},live:false});
};
const data={student,progress:buildStudentDashboardProgress(student),wallet:{academyCoins:500,totalCoinsEarned:500,totalCoinsSpent:0},avatar:null,lichess:null,training:emptyStudentDashboardTraining,quests:emptyStudentDashboardQuestSummary,badges:[],activity:[],unavailableSections:[]};
const teacher=new URLSearchParams(location.search).has('teacher');
createRoot(document.getElementById('root')).render(<AppShell title={teacher?'Students':'Your Chess Quest journey'} variant={teacher?'admin':'student'}>{teacher?<AdminPanel mode="students" initialStudents={[student]} initialQuests={[quest]} initialBadges={[]} initialStudentLichessAccounts={[]}/>:<><StudentJourneyDashboard data={data}/><StudentLichessQuestList/></>}</AppShell>);
