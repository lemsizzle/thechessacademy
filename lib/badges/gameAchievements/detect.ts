import { Chess, DEFAULT_POSITION, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import { achievementByKey } from "./catalog";

export type AchievementGame = {
  initialFen?: string;
  moves: string | Array<{ from: string; to: string; promotion?: string }>;
  color: Color;
  winner: Color | null;
  reason: string;
  incrementMs?: number;
  // Time remaining after each ply, in milliseconds. Never infer missing clocks.
  clocksMs?: Array<number | null>;
};
export type AchievementHit = { key: string; ply: number; fen: string };
const value: Record<PieceSymbol,number> = { p:1,n:3,b:3,r:5,q:9,k:0 };
const other = (color: Color): Color => color === "w" ? "b" : "w";
const xy = (s: string) => [s.charCodeAt(0)-97,Number(s[1])-1];
function square(x:number,y:number): Square | null { return x>=0 && x<8 && y>=0 && y<8 ? `${"abcdefgh"[x]}${y+1}` as Square : null; }
function pieces(board: Chess, color?: Color) { return board.board().flat().filter(p => p && (!color || p.color === color)) as Array<{square:Square;type:PieceSymbol;color:Color}>; }
function material(board: Chess,color:Color) { return pieces(board,color).reduce((sum,p)=>sum+value[p.type],0); }
function attacks(board: Chess, from: Square, target: Square, color: Color) { return board.attackers(target,color).includes(from); }
function pattern(board:Chess,color:Color,type:PieceSymbol,offsets:number[][]) {
  const matches: Square[] = [];
  for(let y=0;y<8;y++) for(let x=0;x<8;x++) {
    if(offsets.every(([dx,dy])=>{ const s=square(x+dx,y+dy); const p=s && board.get(s); return p && p.type===type && p.color===color; })) matches.push(square(x,y)!);
  }
  return matches;
}
const cube=[[0,0],[1,0],[0,1],[1,1]];
const diamond=[[1,0],[0,1],[2,1],[1,2]];
const rectangle=[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]];
function hasRectangle(board:Chess,color:Color) { return pattern(board,color,"n",rectangle).length>0 || pattern(board,color,"n",rectangle.map(([x,y])=>[y,x])).length>0; }

export function structureAchievements(board:Chess,color:Color): string[] {
  const keys:string[]=[];
  for(const n of [5,6]) if([1,-1].some(d=>pattern(board,color,"p",Array.from({length:n},(_,i)=>[i,i*d])).length)) keys.push(`connect-${n}`);
  const diamonds=pattern(board,color,"p",diamond).length;
  if(diamonds) keys.push("pawn-diamond");
  if(diamonds>=2) keys.push("double-pawn-diamond");
  if(pattern(board,color,"p",[...diamond,[1,1]]).length) keys.push("solid-pawn-diamond");
  if(pattern(board,color,"p",[[0,0],[2,0],[1,1],[0,2],[2,2]]).length) keys.push("pawn-x");
  if(pattern(board,color,"p",cube).length) keys.push("pawn-cube");
  if(["d4","e4","d5","e5"].every(s=>{const p=board.get(s as Square);return p?.color===color && p.type==="p";})) keys.push("center-pawn-cube");
  const pawns=pieces(board).filter(p=>p.type==="p");
  if("abcdefgh".split("").some(f=>pawns.filter(p=>p.color===color && p.square[0]===f).length>=4)) keys.push("quadrupled-pawns");
  if("abcdefgh".split("").some(f=>pawns.filter(p=>p.square[0]===f).length>=6)) keys.push("six-pawns-file");
  for(const rank of [4,5,6,7]) if(pawns.filter(p=>p.color===color && Number(p.square[1])===(color==="w"?rank:9-rank)).length===8) keys.push(`connect-8-rank-${rank}`);
  if(pattern(board,color,"n",cube).length) keys.push("knight-cube");
  if(hasRectangle(board,color)) keys.push("knight-rectangle");
  return keys;
}

// Read the first two occupied squares along a slider's rays; no wrap across files.
function rays(board:Chess,from:Square,type:PieceSymbol) {
  const dirs=type==="b"?[[1,1],[1,-1],[-1,1],[-1,-1]]:type==="r"?[[1,0],[-1,0],[0,1],[0,-1]]:[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  const [x,y]=xy(from);
  return dirs.map(([dx,dy])=>{
    const found:Array<{square:Square;type:PieceSymbol;color:Color}>=[];
    for(let n=1;n<8 && found.length<2;n++) {const s=square(x+n*dx,y+n*dy);if(!s)break;const p=board.get(s);if(p)found.push({...p,square:s});}
    return found;
  });
}

export function detectGameAchievements(input:AchievementGame):AchievementHit[] {
  const chess=new Chess(input.initialFen ?? DEFAULT_POSITION);
  const history:Move[]=[];
  if(typeof input.moves === "string") {
    chess.loadPgn(`${input.initialFen && input.initialFen!==DEFAULT_POSITION ? `[SetUp "1"]\n[FEN "${input.initialFen}"]\n\n` : ""}${input.moves}`);
    history.push(...chess.history({verbose:true}));
  } else {
    if(input.moves.length>1000) throw new Error("Game exceeds achievement move limit");
    for(const move of input.moves) history.push(chess.move(move));
  }
  if(!history.length || history.length>1000) return [];
  const hits=new Map<string,AchievementHit>();
  const add=(key:string,index:number)=>{
    if(!achievementByKey.has(key)) throw new Error(`Unknown achievement: ${key}`);
    if(!hits.has(key)) hits.set(key,{key,ply:index+1,fen:history[index].after});
  };
  const us=input.color,them=other(us),last=history.at(-1)!;
  const boards=history.map(m=>new Chess(m.after));
  const final=boards.at(-1)!;
  const won=input.winner===us;
  const mate=won && input.reason==="checkmate" && final.isCheckmate() && last.color===us;
  const own=pieces(final,us).filter(p=>p.type!=="k").map(p=>p.type).sort().join("");
  let captures=0,lastCaptureSquare="";
  for(const [i,m] of history.entries()) {
    const board=boards[i];
    for(const key of structureAchievements(board,us)) add(key,i);
    captures=m.captured ? (lastCaptureSquare===m.to ? captures+1:1):0;
    lastCaptureSquare=m.captured?m.to:"";
    if(captures>=10) add("capture-chain",i);
    if(m.color!==us) continue;
    const next=history[i+2],response=history[i+1],afterNext=history[i+3];
    const keptNext=next?.captured && !(afterNext?.captured && afterNext.to===next.to);
    if(m.promotion) {add("first-promotion",i);if(Number(m.before.split(" ")[5])<=8)add("early-promotion",i);}
    if(m.isKingsideCastle() || m.isQueensideCastle()) {
      if(Number(m.before.split(" ")[5])>40)add("late-castle",i);
      if(m.san.endsWith("+") && next?.piece==="k" && next.captured)add("castle-fork",i);
    }
    const before=new Chess(m.before);
    if(m.captured && m.captured!=="p" && !before.isAttacked(m.to,them) && response && !(response.captured && response.to===m.to))add("hanging-piece",i);
    const targets=pieces(board,them).filter(p=>attacks(board,m.to,p.square,us));
    if(targets.length>=2 && keptNext && next?.from===m.to && targets.some(p=>p.square===next.to))add("first-fork",i);
    if(m.piece==="n" && m.san.endsWith("+") && targets.filter(p=>p.type!=="p").length>=4 && ["k","q","r"].every(t=>targets.some(p=>p.type===t)) && !board.moves({verbose:true}).some(n=>n.to===m.to))add("royal-family-fork",i);
    if(["b","r","q"].includes(m.promotion ?? m.piece)) {
      for(const [front,back] of rays(board,m.to,m.promotion ?? m.piece)) {
        if(!front || !back || front.color!==them || back.color!==them)continue;
        if(back.type==="k" && front.type!=="k" && keptNext && next?.to===front.square)add("successful-pin",i);
        if(front.type==="k" && keptNext && next?.from===m.to && next.to===back.square)add("first-skewer",i);
      }
    }
    if(keptNext && next) {
      const revealed=board.get(next.from);
      if(next.from!==m.to && revealed?.color===us && ["b","r","q"].includes(revealed.type) && board.get(next.to)?.color===them && attacks(board,next.from,next.to,us) && !attacks(before,next.from,next.to,us)) add("discovered-attack",i);
    }
    // Lefong: bishop on the adjacent edge intercepts a fianchetto bishop.
    if(Number(m.before.split(" ")[5])<=10 && m.piece==="b" && m.captured==="b" && ["g7","b7","g2","b2"].includes(m.to) && (response || won) && !(response?.captured && response.to===m.to)) {
      const edge:Record<string,string>={g7:"h6",b7:"a6",g2:"h3",b2:"a3"};
      const origin:Record<string,string>={g7:"f8",b7:"c8",g2:"f1",b2:"c1"};
      if(m.from===edge[m.to] && [history[i-1],history[i-3]].some(n=>n?.piece==="b" && n.from===origin[m.to] && n.to===m.to))add("lefong",i);
    }
  }
  const end=history.length-1;
  const ownMoves=history.filter(m=>m.color===us);
  if(won) {
    const letters=ownMoves.map(m=>m.san[0]).join("");
    for(const word of ["egg","eggegg","badegg","beachcafe","beef","cabbage","chad","headache"])if(letters.startsWith(word))add(`alphabet-${word}`,history.indexOf(ownMoves[word.length-1]));
    if(ownMoves.length>=12 && ownMoves.slice(0,12).every(m=>m.piece==="p"))add("pawn-storm",history.indexOf(ownMoves[11]));
  }
  if(history.length>=59 && history.slice(0,58).every(m=>!m.captured))add("peaceful-opening",58);
  if(input.reason==="stalemate" && input.winner===null && final.isStalemate() && final.turn()===us) {
    const behind=material(final,them)-material(final,us);
    if(behind>=1)add("stalemate-escape",end);
    const bishopEnding=pieces(final).some(p=>p.type==="b") && pieces(final).every(p=>["k","b","p"].includes(p.type));
    if(behind>=4 || (behind>=2 && !bishopEnding))add("stalemate-tricks",end);
    const q=history[end-2],k=history[end-1];
    if(q?.piece==="q" && q.captured && q.san.endsWith("+") && ["b3","b6","c2","c7","f2","f7","g3","g6"].includes(q.to) && k?.color===us && k.piece==="k" && ["a1","a8","h1","h8"].includes(k.to) && boards[end-2].moves({verbose:true}).some(m=>m.piece==="k" && m.to===q.to))add("rosen-trap",end-1);
  }
  if(mate) {
    if(last.piece==="p" && !last.promotion)add("pawn-mate",end);
    if(last.piece==="k")add("king-move-mate",end);
    if(last.isEnPassant())add("en-passant-mate",end);
    if(last.piece==="p" && last.to==="g5")add("g5-mate",end);
    if(last.isKingsideCastle())add("castle-kingside-mate",end);
    if(last.isQueensideCastle())add("castle-queenside-mate",end);
    if(last.promotion==="b")add("bishop-promotion-mate",end);
    if(last.promotion==="n")add("knight-promotion-mate",end);
    if(history[end-1]?.san.endsWith("+") && last.piece!=="k" && !last.captured)add("block-check-mate",end);
    if(own==="bn" && pieces(final,them).length===1)add("bishop-knight-mate",end);
    if(own==="bb")add("two-bishop-mate",end);
    if(own==="nnnn") {add("four-knight-mate",end);if(pattern(final,us,"n",cube).length)add("four-knight-cube-mate",end);}
    if(own==="nnnnnn" && hasRectangle(final,us))add("six-knight-rectangle-mate",end);
    const king=pieces(final,them).find(p=>p.type==="k")!.square;
    const checking=final.attackers(king,us);
    if(checking.length===2)add("double-check-mate",end);
    const [kx,ky]=xy(king);
    const neighbors=[-1,0,1].flatMap(dx=>[-1,0,1].map(dy=>(dx||dy)?square(kx+dx,ky+dy):null)).filter((s):s is Square=>!!s);
    if(last.piece==="n" && checking.includes(last.to) && neighbors.every(s=>final.get(s)?.color===them)) {
      add("smothered-mate",end);
      if(pieces(final,them).some(p=>["q","r"].includes(p.type)&&attacks(final,last.to,p.square,us)) && final.attackers(last.to,them).some(s=>final.get(s)?.type==="p"))add("smothered-pork",end);
    }
    const homeRank=them==="w"?0:7;
    if(ky===homeRank && checking.some(s=>["r","q"].includes(final.get(s)!.type) && xy(s)[1]===homeRank) && [-1,0,1].every(dx=>{const s=square(kx+dx,homeRank+(them==="w"?1:-1));return !s || final.get(s)?.color===them;}))add("back-rank-mate",end);
    if((input.initialFen ?? DEFAULT_POSITION)===DEFAULT_POSITION && [2,3,4].includes(Math.ceil(history.length/2)))add(`mate-move-${Math.ceil(history.length/2)}`,end);
    if(final.fen().startsWith(us==="w"?"8/8/8/8/8/8/2k5/RNBQKBNR ":"rnbqkbnr/2K5/8/8/8/8/8/8 "))add("mona-lisa",end);
    if(!history.some(m=>m.promotion==="q") && !pieces(final,us).some(p=>p.type==="q") && pieces(final,them).some(p=>p.type==="q")) {
      const loss=history.findIndex((m,i)=>m.color===them && m.captured==="q" && end-i<=5);
      if(loss>=0)add("oh-no-my-queen",loss);
    }
    const clock=input.clocksMs?.[end];
    if(input.incrementMs===0 && typeof clock==="number" && clock>=0 && clock<=100)add("tenth-second-mate",end);
    const earlier=input.clocksMs?.[end-40];
    if(input.incrementMs===0 && typeof earlier==="number" && earlier>=0 && earlier<=1100)add("avoid-flag-mate",end-40);
  }
  if(won && input.reason==="timeout") {
    if(own==="p" && material(final,them)-material(final,us)>=10)add("clutch-pawn",end);
    if(own==="b" || own==="n")add("minor-piece-flag",end);
    if(final.turn()===them && final.moves().some(m=>m.endsWith("#")))add("flag-mate-in-one",end);
  }
  return [...hits.values()];
}
