import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { SKILLS_FORM_B, publicQuestions, validateAssessmentAnswers, assessmentKey } from "@/lib/assessment/questions";
import { ASSESSMENT_VERSION, ASSESSMENT_SECTIONS, LEGACY_ASSESSMENT_VERSION } from "@/lib/assessment/types";
import { assessmentMove } from "@/lib/assessment/moveAnswer";
import { assessmentReview } from "@/lib/assessment/server";

describe("board skills assessment",()=>{
  it("has 30 unique playable positions, five per skill, with no rules or exposed solutions",()=>{
    expect(SKILLS_FORM_B).toHaveLength(30);expect(new Set(SKILLS_FORM_B.map(q=>q.fen)).size).toBe(30);
    for(const section of ASSESSMENT_SECTIONS)expect(SKILLS_FORM_B.filter(q=>q.section===section)).toHaveLength(5);
    for(const q of publicQuestions()) {expect(q.kind).toBe("move");expect(q.section).not.toBe("Rules");expect(q.options).toEqual([]);expect(new Chess(q.fen!).isGameOver()).toBe(false);for(const key of ['acceptedMoves','solution','explanation','source','sourceRating','answer'])expect(q).not.toHaveProperty(key);}
  });
  it("replays every answer and continuation legally and accepts all immediate mates",()=>{
    for(const q of SKILLS_FORM_B){
      for(const move of q.acceptedMoves)expect(assessmentMove(q.fen,move),q.id).not.toBeNull();
      const game=new Chess(q.fen);for(const move of q.solution)expect(()=>game.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]}),q.id).not.toThrow();
      if(q.section==='Checkmate'||q.id==='b29')for(const move of new Chess(q.fen).moves({verbose:true})){const next=new Chess(q.fen);next.move(move);if(next.isCheckmate())expect(q.acceptedMoves).toContain(move.from+move.to+(move.promotion||''));}
    }
  });
  it("records legal wrong moves without feedback, rejects illegal moves, and requires promotion choice",()=>{
    const q=SKILLS_FORM_B[0],wrong=new Chess(q.fen).moves({verbose:true}).map(m=>m.from+m.to+(m.promotion||'')).find(m=>!q.acceptedMoves.includes(m))!;
    expect(validateAssessmentAnswers({[q.id]:wrong})).toEqual({[q.id]:wrong});
    expect(assessmentReview({version:ASSESSMENT_VERSION,answers:{[q.id]:wrong}})[0].correct).toBe(false);
    for(const value of ['a1a1','e2e9','bad','f6f3q'])expect(()=>validateAssessmentAnswers({b01:value})).toThrow();
    expect(()=>validateAssessmentAnswers({b30:'c7c8'})).toThrow();
    expect(validateAssessmentAnswers({b30:'c7c8q'})).toEqual({b30:'c7c8q'});
    expect(assessmentReview({version:ASSESSMENT_VERSION,answers:{b30:'c7c8q'}}).find(q=>q.id==='b30')!.correct).toBe(false);
  });
  it("scores alternatives and keeps legacy and new forms separate",()=>{
    const answers=Object.fromEntries(SKILLS_FORM_B.map(q=>[q.id,q.acceptedMoves[0]]));answers.b29='h2h1r';
    expect(assessmentReview({version:ASSESSMENT_VERSION,answers}).filter(r=>r.correct)).toHaveLength(30);
    expect(assessmentReview({version:LEGACY_ASSESSMENT_VERSION,answers}).filter(r=>r.correct)).toHaveLength(0);
    expect(assessmentKey(LEGACY_ASSESSMENT_VERSION)).not.toHaveProperty('b01');expect(assessmentKey()).not.toHaveProperty('r1');
    expect(()=>validateAssessmentAnswers({r1:'b'})).toThrow();
  });
});
