"use client";
import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { useGameDialogFocus } from "@/chess/hooks/useGameDialogFocus";
import { assessmentMove } from "@/lib/assessment/moveAnswer";
import type { ChessColor, PromotionPiece } from "@/chess/types";

export function AssessmentMoveBoard({ id, fen, answer, disabled, complete, solution, onAnswer }: { id: string; fen: string; answer: string; disabled: boolean; complete: boolean; solution?: string; onAnswer: (move: string) => void }) {
  const game = useMemo(() => new Chess(fen), [fen]);
  const color: ChessColor = game.turn() === "w" ? "white" : "black";
  const [promotion, setPromotion] = useState<{from:string;to:string} | null>(null);
  const [illegal, setIllegal] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const played = assessmentMove(fen, showSolution && complete && solution ? solution : answer);
  function move(from: string, to: string, piece?: PromotionPiece) {
    if (disabled || complete || answer) return;
    const legal = game.moves({verbose:true}).filter(m => m.from === from && m.to === to);
    if (!legal.length) { setIllegal(true); return; }
    if (legal.some(m => m.promotion) && !piece) { setPromotion({from,to}); return; }
    const value = from + to + (piece || "");
    if (!assessmentMove(fen, value)) { setIllegal(true); return; }
    setIllegal(false); setPromotion(null); onAnswer(value);
  }
  return <div>
    <p className="mb-2 text-sm font-bold text-cyan-100">{color === "white" ? "White" : "Black"} to move · Play one move</p>
    <div className="relative aspect-square" data-testid="assessment-board" data-fen={played?.fen ?? fen} data-color={color}>
      <AcademyChessboard boardId={`assessment-${id}`} fen={played?.fen ?? fen} orientation={color} humanColor={color} interactive={!disabled && !complete && !answer && !promotion} lastMove={played ? [played.from,played.to] : null} onMove={move} onIllegalMove={() => setIllegal(true)} />
      {promotion && <Promotion color={color} file={promotion.to[0]} onCancel={() => setPromotion(null)} onChoose={piece => move(promotion.from,promotion.to,piece)} />}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm" aria-live="polite">
      <span>{showSolution ? `Solution: ${played?.san}` : played ? `Your move: ${played.san}` : complete ? "No move submitted" : "Tap a piece and destination, or drag to move."}</span>
      {answer && !complete && <button className="rounded-lg border border-cyan-200/40 px-4 py-2 text-cyan-100" disabled={disabled} onClick={() => { setIllegal(false); onAnswer(""); }}>Change move</button>}
      {complete && solution && <button className="rounded-lg border border-cyan-200/40 px-4 py-2 text-cyan-100" onClick={() => setShowSolution(value => !value)}>{showSolution ? "Show my answer" : "Show solution"}</button>}
    </div>
    {illegal && <p role="status" className="mt-2 text-sm text-amber-100">That move isn’t legal. Choose another square.</p>}
  </div>;
}

function Promotion({color,file,onCancel,onChoose}: {color:ChessColor;file:string;onCancel:()=>void;onChoose:(piece:PromotionPiece)=>void}) {
  const ref=useGameDialogFocus(onCancel);
  const column=color==='white'?file.charCodeAt(0)-97:104-file.charCodeAt(0);
  return <div className="absolute inset-0 z-20 bg-slate-950/40"><section ref={ref} role="dialog" aria-modal="true" aria-label="Choose a promotion" tabIndex={-1} className="absolute top-0 flex w-[12.5%] flex-col rounded-md border border-amber-200 bg-slate-900 shadow-xl" style={{left:`${column*12.5}%`}}>
    {([['q','Queen','♕','♛'],['r','Rook','♖','♜'],['b','Bishop','♗','♝'],['n','Knight','♘','♞']] as const).map(([piece,label,white,black])=><button key={piece} type="button" aria-label={`Promote to ${label}`} onClick={()=>onChoose(piece)} className="aspect-square w-full text-[clamp(1.5rem,4vw,3rem)] text-amber-100 hover:bg-cyan-200/20 focus:bg-cyan-200/20">{color==='white'?white:black}</button>)}
    <button type="button" aria-label="Cancel promotion" onClick={onCancel} className="min-h-8 text-white">✕</button>
  </section></div>;
}
