"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { ASSESSMENT_VERSION, assessmentLabel, knowledgePercent, type AssessmentPayload } from "@/lib/assessment/types";
import { assessmentMove } from "@/lib/assessment/moveAnswer";
import { AssessmentMoveBoard } from "./AssessmentMoveBoard";
import styles from "./ChessKnowledgeAssessment.module.css";

async function requestAssessment(body?: object, id?: string) {
  const response = await fetch(`/api/student/assessment${id ? `?attempt=${encodeURIComponent(id)}` : ""}`, {
    method: body ? "POST" : "GET", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined, keepalive: Boolean(body), signal: AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Your test couldn't be saved. Please retry.");
  return data as AssessmentPayload;
}
const noMove = () => {};

export function ChessKnowledgeAssessment({ studentId }: { studentId: string }) {
  const [data, setData] = useState<AssessmentPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("All answers saved");
  const [remaining, setRemaining] = useState(1800);
  const [confirm, setConfirm] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const dataRef = useRef(data);
  const pending = useRef<Record<string, string>>({});
  const flight = useRef<Promise<void> | null>(null);
  const submitting = useRef(false);
  const offset = useRef(0);
  const retryAfter = useRef(0);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const questionTop = useRef<HTMLElement>(null);
  const draftKey = useCallback((id: string) => `chess-knowledge-draft:${studentId}:${id}`, [studentId]);
  const storePending = useCallback(() => {
    const id = dataRef.current?.attempt?.id;
    if (!id) return;
    try {
      if (Object.keys(pending.current).length) localStorage.setItem(draftKey(id), JSON.stringify(pending.current));
      else localStorage.removeItem(draftKey(id));
    } catch { /* Server autosave remains authoritative when browser storage is unavailable. */ }
  }, [draftKey]);
  const accept = useCallback((next: AssessmentPayload, restore = false) => {
    offset.current = Date.parse(next.serverNow) - Date.now();
    dataRef.current = next;
    setData(next);
    const attempt = next.attempt;
    if (!attempt || attempt.completed_at) {
      pending.current = {};
      if (attempt) { try { localStorage.removeItem(draftKey(attempt.id)); } catch {} }
    } else if (restore) {
      pending.current = {};
      try {
        const raw = JSON.parse(localStorage.getItem(draftKey(attempt.id)) || "{}");
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          for (const q of next.questions) if (raw[q.id] === "" || (q.kind === "move" ? typeof raw[q.id] === "string" && assessmentMove(q.fen!,raw[q.id]) : q.options.some(option => option.id === raw[q.id]))) pending.current[q.id] = raw[q.id];
        }
      } catch {}
    }
    setAnswers({ ...attempt?.answers, ...pending.current });
    setRemaining(attempt ? Math.max(0, Math.ceil((Date.parse(attempt.deadline_at) - Date.parse(next.serverNow)) / 1000)) : 1800);
    setSaveStatus(Object.keys(pending.current).length ? "Saving answers…" : "All answers saved");
  }, [draftKey]);
  const load = useCallback(async (id?: string) => {
    setBusy(true); setError("");
    try { accept(await requestAssessment(undefined, id), true); setIndex(0); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't load the test. Please retry."); }
    finally { setBusy(false); }
  }, [accept]);
  useEffect(() => { void load(); }, [load]);

  const flush = useCallback(async () => {
    if (flight.current) return flight.current;
    const attempt = dataRef.current?.attempt;
    if (!attempt || attempt.completed_at || !Object.keys(pending.current).length) return;
    const patch = { ...pending.current };
    setSaveStatus("Saving answers…");
    const task = (async () => {
      try {
        const next = await requestAssessment({ action: "save", attemptId: attempt.id, answers: patch });
        for (const [id, value] of Object.entries(patch)) if (pending.current[id] === value) delete pending.current[id];
        storePending();
        if (next.attempt?.completed_at) accept(next);
        else {
          offset.current = Date.parse(next.serverNow) - Date.now();
          setSaveStatus(Object.keys(pending.current).length ? "Saving answers…" : "All answers saved");
        }
      } catch { retryAfter.current = Date.now() + 15000; setSaveStatus("Not saved yet. Reconnect and retry before time runs out."); }
      finally { flight.current = null; }
    })();
    flight.current = task;
    return task;
  }, [accept, storePending]);
  // Only pending changes create requests. No database polling or per-second saves.
  useEffect(() => {
    const timer = window.setInterval(() => { if (!submitting.current && Date.now() >= retryAfter.current && Object.keys(pending.current).length) void flush(); }, 1200);
    const online = () => { void flush(); };
    const leaving = () => { storePending(); void flush(); };
    window.addEventListener("online", online);
    window.addEventListener("pagehide", leaving);
    return () => { window.clearInterval(timer); window.removeEventListener("online", online); window.removeEventListener("pagehide", leaving); void flush(); };
  }, [flush, storePending]);
  const submit = useCallback(async () => {
    if (submitting.current) return;
    const attempt = dataRef.current?.attempt;
    if (!attempt || attempt.completed_at) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      await flight.current;
      accept(await requestAssessment({ action: "submit", attemptId: attempt.id, answers: pending.current }));
      setConfirm(false);
    } catch { setError("Couldn't finish saving your result. Your saved answers are safe. Reconnect and retry."); }
    finally { submitting.current = false; setBusy(false); }
  }, [accept]);
  useEffect(() => {
    const attempt = data?.attempt;
    if (!attempt || attempt.completed_at) return;
    let lastRetry = 0;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((Date.parse(attempt.deadline_at) - Date.now() - offset.current) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && Date.now() - lastRetry > 15000) { lastRetry = Date.now(); void submit(); }
    };
    tick(); const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [data?.attempt?.id, data?.attempt?.completed_at, data?.attempt?.deadline_at, submit]);
  useEffect(() => {
    const leaving = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) { storePending(); event.preventDefault(); }
    };
    window.addEventListener("beforeunload", leaving);
    return () => window.removeEventListener("beforeunload", leaving);
  }, [storePending]);

  const start = async () => {
    setBusy(true); setError("");
    try { accept(await requestAssessment({ action: "start" }), true); setIndex(0); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't start. Please retry."); }
    finally { setBusy(false); }
  };
  const select = (id: string, value: string) => {
    if (!data?.attempt || data.attempt.completed_at || remaining === 0 || busy) return;
    pending.current[id] = value; storePending();
    setAnswers(current => ({ ...current, [id]: value }));
    setSaveStatus("Saving answers…");
  };
  const go = (next: number) => { setIndex(next); setConfirm(false); setShowQuestions(false); window.setTimeout(() => { questionHeading.current?.focus({ preventScroll: true }); questionTop.current?.scrollIntoView({ block: "start" }); }, 0); };
  const attempt = data?.attempt;
  const complete = Boolean(attempt?.completed_at);
  const question = data?.questions[index];
  const answered = data?.questions.filter(q => Boolean(answers[q.id])).length ?? 0;
  const review = data?.review?.find(q => q.id === question?.id);
  const history = data?.history.filter(item => item.completed_at) ?? [];
  const sections = [...new Set(data?.questions.map(q => q.section) ?? [])];
  const formLabel = assessmentLabel(attempt?.version ?? ASSESSMENT_VERSION);

  return <div className={styles.page}>
    <header className={styles.header} ref={questionTop}><div><p className={styles.eyebrow}>CHESS QUEST · {formLabel}</p><h1>{attempt && attempt.version !== ASSESSMENT_VERSION ? "Chess Knowledge Test" : "Chess Skills Test"}</h1></div>
      {attempt && !complete && <div className={`${styles.timer} ${remaining <= 300 ? styles.urgent : ""}`} aria-label="Time remaining"><span>TIME LEFT</span><strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</strong></div>}
    </header>
    {error && <div role="alert" className={styles.notice}>{error} <button type="button" onClick={() => attempt && !complete ? void submit() : void load()} disabled={busy}>Retry</button></div>}
    {!data && !error && <p role="status">Loading your test…</p>}
    {data && !attempt && <section className={styles.card}>
      <h2>Show your skills on the board</h2><p>30 positions · up to 30 minutes · a score out of 100</p>
      <p>Play moves to test your board vision, tactics, checkmate, calculation, defense, and endgames. There are no rules questions or multiple-choice answers. Calculate first, then play one move in each position.</p>
      <ul><li>Work on your own, without hints, an engine, or outside help.</li><li>The timer keeps running if you leave or reload. Answers save as you go; stay connected.</li><li>Each correct answer earns one point. Unanswered questions earn zero. There is no speed bonus.</li></ul>
      <p>You can change your move, skip a position, or return to it before finishing. Correctness and explanations appear only after submission. This is a Chess Quest skills score, not an Elo rating. Retakes use the same positions; your first attempt is the best baseline.</p>
      <button className={styles.primary} onClick={() => void start()} disabled={busy}>{busy ? "Starting…" : "Start 30-minute test"}</button>
    </section>}
    {complete && attempt && <section className={styles.card} aria-label="Assessment results">
      <div className={styles.resultHeading}><div><p className={styles.eyebrow}>TEST COMPLETE</p><h2>Your score: {knowledgePercent(attempt.correct_count ?? 0)}/100</h2><p>{attempt.correct_count} of 30 correct. Review your answers below and choose a topic to practice with your teacher.</p></div><button onClick={() => { setData(current => current ? { ...current, attempt: null, review: undefined } : current); dataRef.current = { ...data!, attempt: null, review: undefined }; }} disabled={busy}>Back to test overview</button></div>
      <div className={styles.sections}>{sections.map(section => <div key={section}><span>{section}</span><strong>{data?.questions.filter(q => q.section === section && data.review?.some(r => r.id === q.id && r.correct)).length}/5</strong></div>)}</div>
      <p className={styles.muted}>{formLabel} · Compare scores from the same form. Original Knowledge A results are preserved separately.</p>
    </section>}
    {attempt && question && <>
      <div className={styles.progress}><span>Question {index + 1} of 30 · {question.section}</span><button onClick={() => setShowQuestions(value => !value)} aria-expanded={showQuestions}>{answered}/30 answered · {showQuestions ? "Hide" : "All questions"}</button></div>
      {showQuestions && <nav className={styles.questionNav} aria-label="Test questions">{data!.questions.map((q, i) => <button key={q.id} aria-label={`Question ${i + 1}, ${answers[q.id] ? "answered" : "unanswered"}`} aria-current={i === index ? "step" : undefined} className={answers[q.id] ? styles.answered : ""} onClick={() => go(i)}>{i + 1}{answers[q.id] ? " ✓" : ""}</button>)}</nav>}
      {question.kind === "move" && <h2 ref={questionHeading} tabIndex={-1} className="text-lg font-bold">{question.prompt}</h2>}
      <div className={`${styles.workspace} ${question.fen ? "" : styles.textOnly}`}>
        {question.fen && <div className={styles.board} aria-label="Question position">{question.kind === "move" ? <AssessmentMoveBoard key={`${attempt.id}:${question.id}`} id={question.id} fen={question.fen} answer={answers[question.id] || ""} disabled={busy || remaining === 0} complete={complete} solution={review?.move} onAnswer={move => select(question.id,move)} /> : <AcademyChessboard key={question.id} boardId={`assessment-${question.id}`} fen={question.fen} orientation="white" humanColor="white" interactive={false} lastMove={null} onMove={noMove} animationDurationInMs={0} />}</div>}
        <section className={styles.card}>
          {question.kind !== "move" && <><h2 ref={questionHeading} tabIndex={-1}>{question.prompt}</h2><fieldset className={styles.options} disabled={busy || complete || remaining === 0}><legend className="sr-only">Choose one answer</legend>{question.options.map(option => <label key={option.id} className={answers[question.id] === option.id ? styles.selected : ""}><input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => select(question.id, option.id)} /><span>{option.text}</span></label>)}</fieldset></>}
          {question.kind === "move" && !complete && <><h2>Your answer</h2><p>{answers[question.id] ? "Move recorded. Continue when you’re ready, or change your move on the board." : "Make your move on the board. You can also skip this position and come back."}</p></>}
          {complete && review && <div className={styles.feedback}><strong>{review.correct ? "Correct" : answers[question.id] ? "Not quite" : "Not answered"}</strong><p>Answer: {question.kind === "move" ? review.answer : question.options.find(option => option.id === review.answer)?.text}</p><p>{review.explanation}</p></div>}
          {!complete && <div className={styles.save}><span role="status">{saveStatus}</span>{saveStatus.startsWith("Not saved") && <button onClick={() => void flush()}>Retry save</button>}</div>}
          <div className={styles.actions}><button onClick={() => go(index - 1)} disabled={index === 0}>Back</button>{index < 29 && <button className={styles.primary} onClick={() => go(index + 1)}>Next</button>}{!complete && <button onClick={() => setConfirm(true)} disabled={busy}>Finish test</button>}</div>
          {confirm && !complete && <div className={styles.notice} role="region" aria-label="Confirm submission"><p>{30 - answered ? `${30 - answered} question${30 - answered === 1 ? " is" : "s are"} unanswered. ` : "All questions are answered. "}Finish now? You cannot change answers afterward.</p><div className={styles.actions}><button className={styles.primary} onClick={() => void submit()} disabled={busy}>Submit answers</button><button onClick={() => setConfirm(false)} disabled={busy}>Keep working</button></div></div>}
        </section>
      </div>
    </>}
    {(!attempt || complete) && history.length > 0 && <section className={styles.card}><h2>Your previous results</h2><p className={styles.muted}>Most recent first · compare results from the same form</p><ul className={styles.history}>{history.map(item => <li key={item.id}><span>{new Date(item.started_at).toLocaleDateString()} · {assessmentLabel(item.version)} · {knowledgePercent(item.correct_count ?? 0)}/100</span><button onClick={() => void load(item.id)} disabled={busy}>Review result</button></li>)}</ul></section>}
  </div>;
}
