import React from 'react';
import { createRoot } from 'react-dom/client';
import { Chess } from 'chess.js';
import { LiveChessGame } from '../../chess/components/LiveChessGame';
const initial = new Chess().fen();
const messages = [{id:'coach', senderRole:'teacher',senderName:'Coach',message:'Good luck, everyone!',createdAt:new Date().toISOString()}];
const game = {id:'fixture',arenaTournamentId:'arena',status:'active',version:1,realtimeTopic:'',gameMode:'live',viewer:{studentId:'white',color:'white'},players:{white:{id:'white',name:'Alex'},black:{id:'black',name:'Jamie'}},avatarItems:[],timeControl:{id:'10+0',name:'10 + 0',initialMs:600000,incrementMs:0},initialFen:initial,fen:initial,moves:[],activeColor:'white',clocks:{whiteMs:600000,blackMs:600000,startedAt:new Date().toISOString()},drawOfferedBy:null,winnerColor:null,resultReason:null,startedAt:new Date().toISOString(),completedAt:null,serverNow:new Date().toISOString()};
let fail = true;
window.fetch = async (url, options={}) => {
 const path=String(url);
 if(path.endsWith('/chat')) return Response.json({messages,canChat:true});
 if(path.endsWith('/lobby')) {
   if(fail){fail=false;return Response.json({error:'Test interruption. Please send again.'},{status:503});}
   const message={id:'sent',senderRole:'student',senderName:'Alex',message:JSON.parse(options.body).message,createdAt:new Date().toISOString()};messages.push(message);return Response.json({ok:true,message});
 }
 if(path.includes('/presence')) return Response.json({queue:{gameId:'fixture',status:'playing',tournamentStatus:'active'}});
 if(path.includes('/live-games/')) return Response.json({ok:true,game:{...game,serverNow:new Date().toISOString()}});
 return Response.json({});
};
createRoot(document.getElementById('root')).render(<main className="p-4"><LiveChessGame gameId="fixture"/></main>);
