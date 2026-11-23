"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { BoardSettings } from "@/chess/components/BoardSettings";
import { Button } from "@/components/Button";
import { useStudentMenuDestination } from "@/components/student/StudentMenuNavigation";
import { emptyLearnProgress, learnTopics, puzzlesForTopic, readLearnProgress, type LearnProgress } from "@/lib/learn/catalog";
import { learnExplanation, learnFollowUp, learnPrompt, pieceName, playUci } from "@/lib/learn/rules";
import type { LearnPuzzle, LearnTopicId } from "@/lib/learn/types";
import styles from "./BeginnerLearn.module.css";

export function BeginnerLearn({ studentId }: { studentId: string }) {
  const storageKey = `academy.learn.v1:${studentId}`;
  const [progress, setProgress] = useState<LearnProgress>(emptyLearnProgress);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  useEffect(() => {
    try { setProgress(readLearnProgress(localStorage.getItem(storageKey))); }
    catch { setStorageWarning(true); }
    setReady(true);
  }, [storageKey]);
  function save(next: LearnProgress) {
    setProgress(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setStorageWarning(true); }
  }
  useStudentMenuDestination("/student/training/learn", () => save({ ...progress, topic: null }));
  const topic = learnTopics.find(item => item.id === progress.topic);
  const puzzles = topic ? puzzlesForTopic(topic.id) : [];
  function start(id: LearnTopicId) {
    const first = puzzlesForTopic(id).findIndex(puzzle => !progress.solved.includes(puzzle.id));
    save({ ...progress, topic: id, index: Math.max(0, first) });
  }
  if (!ready) return <p role="status">Preparing beginner puzzles…</p>;
  return <div className={styles.root}>
    {storageWarning && <p role="status" className="mb-3 text-sm text-amber-100">You can keep practicing. This browser cannot save your progress right now.</p>}
    {topic ? <LearnBoard key={puzzles[progress.index].id} puzzle={puzzles[progress.index]} index={progress.index} topic={topic}
      solvedCount={puzzles.filter(puzzle => progress.solved.includes(puzzle.id)).length}
      onSolved={() => { const id = puzzles[progress.index].id; if (!progress.solved.includes(id)) save({ ...progress, solved: [...progress.solved, id] }); }}
      onIndex={index => save({ ...progress, index })} onBack={() => save({ ...progress, topic: null })} /> : <>
      <header className="mb-5">
        <Link href="/student/training" className="inline-flex min-h-11 items-center font-bold text-cyan-200">← Training</Link>
        <h1 className="text-3xl font-black text-white">Learn</h1>
        <p className="mt-2 max-w-2xl text-slate-300">Your first chess puzzles. Six simple ideas, 30 puzzles each. No timer, no lost lives—take your time and try again.</p>
        <p className="mt-2 text-sm text-cyan-200">Tap a white piece, then its destination. Find one move that solves the task.</p>
      </header>
      <div className={styles.topics}>
        {learnTopics.map((item, index) => {
          const solved = puzzlesForTopic(item.id).filter(puzzle => progress.solved.includes(puzzle.id)).length;
          return <button key={item.id} type="button" onClick={() => start(item.id)} className={styles.topic} aria-label={`${item.name}, ${solved} of 30 solved`}>
            <span className="flex items-center justify-between"><span className="text-3xl text-amber-200" aria-hidden="true">{item.icon}</span><span className="text-xs font-bold text-slate-400">SET {index + 1}</span></span>
            <h2 className="mt-3 text-xl font-black text-white">{item.name}</h2>
            <p className="mt-2 text-sm text-slate-300">{item.lesson}</p>
            <span className="mt-4 flex justify-between text-sm font-bold text-cyan-200"><span>{solved} / 30 solved</span><span>{solved === 30 ? "Practice again" : solved ? "Continue" : "Start"} →</span></span>
            <progress className={styles.progress} value={solved} max={30} aria-label={`${item.name} progress`} />
          </button>;
        })}
      </div>
      <p className="mt-4 text-xs text-slate-400">{progress.solved.length} / 180 solved · Progress is saved in this browser for your account.</p>
    </>}
  </div>;
}

function LearnBoard({ puzzle, index, topic, solvedCount, onSolved, onIndex, onBack }: {
  puzzle: LearnPuzzle; index: number; topic: typeof learnTopics[number]; solvedCount: number;
  onSolved: () => void; onIndex: (index: number) => void; onBack: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [demonstration, setDemonstration] = useState(false);
  const [hint, setHint] = useState(0);
  const [message, setMessage] = useState("");
  const [followStage, setFollowStage] = useState(0);
  const heading = useRef<HTMLElement>(null);
  function revealBoard() { heading.current?.scrollIntoView({ block: "start", behavior: "instant" }); }
  useEffect(() => { heading.current?.scrollIntoView({ block: "start", behavior: "instant" }); }, []);
  const solved = Boolean(answer) && !demonstration;
  const move = useMemo(() => answer ? playUci(new Chess(puzzle.fen), answer) : null, [answer, puzzle.fen]);
  const followUp = useMemo(() => answer ? learnFollowUp(puzzle, answer) : [], [answer, puzzle]);
  const shown = followStage ? followUp[followStage - 1] : move;
  const solution = useMemo(() => playUci(new Chess(puzzle.fen), puzzle.solutions[0]), [puzzle]);
  useEffect(() => {
    if (followStage !== 1) return;
    const timer = window.setTimeout(() => setFollowStage(2), 1100);
    return () => clearTimeout(timer);
  }, [followStage]);
  function tryMove(from: string, to: string) {
    if (answer) return;
    const game = new Chess(puzzle.fen);
    let played;
    try { played = game.move({ from, to }); } catch { setMessage("That move is not legal. Try another square, or use a hint."); return; }
    const value = played.from + played.to;
    if (!puzzle.solutions.includes(value)) {
      setMessage(puzzle.topic === "mate-in-one" && game.isCheck() ? "That is check, but Black still has a legal answer. Look for checkmate." : puzzle.topic === "defensive-move" && puzzle.kind === "block" ? "That move is legal, but this task asks for a block protected by your king. Try again." : "That move is legal, but it does not solve this task yet. Try again, or ask for a hint.");
      return;
    }
    setAnswer(value); setMessage(""); onSolved();
  }
  function reset() { setAnswer(""); setDemonstration(false); setFollowStage(0); setHint(0); setMessage(""); }
  return <section>
    <header ref={heading} className={styles.header}>
      <button type="button" onClick={onBack} className="min-h-11 font-bold text-cyan-200">← All Learn sets</button>
      <h1 className="text-xl font-black text-white">{topic.name}</h1>
      <span className="text-sm text-slate-300">{solvedCount} / 30 solved</span>
    </header>
    <h2 className={styles.goal}>{learnPrompt(puzzle)}</h2>
    <div className={styles.layout}>
      <div className={styles.boardColumn}>
        <div className="mb-2 flex h-10 items-center justify-between gap-2"><p className="text-sm font-bold text-cyan-100">White to move · {index + 1} / 30</p><BoardSettings /></div>
        <div className="relative aspect-square" data-learn-board data-puzzle-id={puzzle.id} data-fen={shown?.after ?? puzzle.fen}>
          <AcademyChessboard boardId={`learn-${puzzle.id}`} fen={shown?.after ?? puzzle.fen} orientation="white" humanColor="white" interactive={!answer}
            lastMove={shown ? [shown.from, shown.to] : null} onMove={tryMove}
            onIllegalMove={() => setMessage("That move is not legal. Try another square, or use a hint.")}
            circles={!answer && hint > 0 ? [{ square: solution.from, color: "rgba(251,191,36,0.8)" }] : []}
            arrows={!answer && hint > 1 ? [{ startSquare: solution.from, endSquare: solution.to, color: "rgba(52,211,153,0.8)" }] : []} />
        </div>
      </div>
      <aside className={styles.panel} aria-label="Beginner puzzle instructions">
        <p className="text-xs font-black uppercase tracking-wider text-amber-200">One move · Unlimited tries</p>
        {answer ? <div className="flex flex-wrap gap-2">
          {demonstration ? <Button onClick={() => { reset(); revealBoard(); }}>Try it yourself</Button> : <Button onClick={() => index === 29 ? onBack() : onIndex(index + 1)}>{index === 29 ? solvedCount === 30 ? "Finish set" : "Back to sets" : "Next puzzle →"}</Button>}
          {followUp.length === 2 && <Button variant="ghost" disabled={followStage === 1} onClick={() => { setFollowStage(followStage === 2 ? 0 : 1); revealBoard(); }}>{followStage === 2 ? "Back to your move" : "Show follow-up"}</Button>}
          {solved && <Button variant="ghost" onClick={reset}>Try again</Button>}
        </div> : <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={hint === 2} onClick={() => { setMessage(""); setHint(value => Math.min(2, value + 1)); revealBoard(); }}>{hint ? "Show hint arrow" : "Hint"}</Button>
          <Button variant="ghost" onClick={() => { setDemonstration(true); setAnswer(puzzle.solutions[0]); setMessage(""); revealBoard(); }}>Show me</Button>
        </div>}
        <div role="status" aria-live="polite" className={`rounded-lg border p-3 text-sm leading-6 ${answer ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/5 text-slate-200"}`}>
          {answer ? <><strong className="block">{demonstration ? "Watch, then try it yourself" : "You found it!"}</strong>{learnExplanation(puzzle, answer)}{followStage > 0 && <p className="mt-2">Example: Black plays {followUp[0].san}, then White plays {followUp[1].san}.</p>}</>
            : message || (hint ? `Try your ${pieceName[solution.piece]} on ${solution.from}.${hint > 1 ? ` The arrow shows ${solution.to}.` : " Look for where it can solve the task."}` : "Tap a white piece, then its destination—or drag it. You can ask for a hint anytime.")}
        </div>
        <details className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer font-bold text-cyan-200">How it works</summary><p className="mt-2 text-sm leading-6 text-slate-300">{topic.lesson}</p></details>
        {solvedCount === 30 && <p className="rounded-lg bg-amber-300/10 p-3 text-sm font-bold text-amber-100">All 30 solved! You can revisit any puzzle for practice.</p>}
        <label className="mt-1 block text-xs font-bold text-slate-400">Choose a puzzle
          <select aria-label="Choose a puzzle" value={index} onChange={event => onIndex(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-slate-900 px-3 text-sm text-white">
            {Array.from({ length: 30 }, (_, value) => <option key={value} value={value}>Puzzle {value + 1}</option>)}
          </select>
        </label>
        <p className="text-xs text-slate-500">Progress is saved in this browser. Viewing a solution does not mark it solved.</p>
      </aside>
    </div>
  </section>;
}
