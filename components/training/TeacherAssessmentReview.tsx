"use client";

import { useMemo, useState } from "react";
import { AnalysisWorkspace } from "@/chess/components/AnalysisWorkspace";
import { Button } from "@/components/Button";
import { assessmentAnalysisTree, type TeacherAssessmentQuestion } from "@/lib/assessment/teacherReview";
import { assessmentMove } from "@/lib/assessment/moveAnswer";

export function TeacherAssessmentReview({ questions }: { questions: TeacherAssessmentQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<"position" | "student" | "solution">("position");
  const [reset, setReset] = useState(0);
  const question = questions[index];
  const tree = useMemo(() => assessmentAnalysisTree(question, view), [question, view]);
  const studentMove = question.kind === "move" && question.studentAnswer ? assessmentMove(question.fen!, question.studentAnswer) : null;
  const studentLabel = studentMove?.san ?? question.options.find(option => option.id === question.studentAnswer)?.text ?? "No answer submitted";
  const status = question.correct ? "Correct" : question.studentAnswer ? "Incorrect" : "Unanswered";
  function go(next: number) { setIndex(next); setView("position"); setReset(0); }
  const controls = <div className="w-full space-y-3">
    <p className="font-bold text-cyan-100" data-testid="assessment-review-status">{status} · Student: {studentLabel}</p>
    <p className="text-sm text-slate-200">Accepted answer: {question.answerLabel}</p>
    <p className="text-sm leading-6 text-slate-300">{question.explanation}</p>
    {tree && <div className="flex flex-wrap gap-2" aria-label="Review position">
      <Button variant="ghost" onClick={() => { setView("position"); setReset(value => value + 1); }}>Original position</Button>
      {studentMove && <Button variant="ghost" onClick={() => { setView("student"); setReset(value => value + 1); }}>Student move</Button>}
      {question.solution.length > 0 && <Button variant="ghost" onClick={() => { setView("solution"); setReset(value => value + 1); }}>Solution line</Button>}
    </div>}
    <p className="text-xs text-slate-400">Explore moves, variations, and annotations here. Analysis is temporary and does not change the submitted test or score.</p>
  </div>;
  return <section className="space-y-4" aria-label="Test analysis review">
    <nav className="grid grid-cols-2 items-center gap-3 sm:flex sm:flex-wrap" aria-label="Review questions">
      <Button variant="ghost" disabled={index === 0} onClick={() => go(index - 1)}>Previous question</Button>
      <label className="order-first col-span-2 min-w-0 flex-1 text-sm font-bold text-slate-300 sm:order-none">Question
        <select aria-label="Question" className="mt-1 block w-full max-w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white sm:ml-2 sm:mt-0 sm:inline-block sm:w-auto" value={index} onChange={event => go(Number(event.target.value))}>
          {questions.map((item, i) => <option key={item.id} value={i}>{i + 1}. {item.section} · {item.correct ? "Correct" : item.studentAnswer ? "Incorrect" : "Unanswered"}</option>)}
        </select>
      </label>
      <Button variant="ghost" disabled={index === questions.length - 1} onClick={() => go(index + 1)}>Next question</Button>
    </nav>
    <h2 className="text-lg font-bold text-white" data-testid="assessment-review-prompt">{index + 1}. {question.prompt}</h2>
    {tree ? <AnalysisWorkspace key={`${question.id}:${view}:${reset}`} initialTree={tree} initialPly={view === "position" ? 0 : 1} reviewColor={question.fen!.split(" ")[1] === "b" ? "black" : "white"} title={`Question ${index + 1} · ${question.section}`} actions={controls} /> : <div className="rounded-xl border border-white/10 bg-slate-950/80 p-5"><p className="mb-4 text-sm text-slate-400">This original quiz question has no board position.</p>{controls}</div>}
  </section>;
}
