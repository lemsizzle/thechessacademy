"use client";
import { TrainingSessionRewards, useTrainingRewards } from "@/components/training/TrainingSessionRewards";

import Link from "next/link";
import { Chess, type Square } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { AnalysisStockfishService } from "@/chess/engine/AnalysisStockfishService";
import { useGameDialogFocus } from "@/chess/hooks/useGameDialogFocus";
import type { ChessColor, PromotionPiece } from "@/chess/types";
import { ENDGAME_TOPICS, type EndgameTopic } from "@/lib/endgames/catalog";
import { endgameCandidateFromSeed, winningCandidate, type EndgameDifficulty } from "@/lib/endgames/generator";
import { analyzeEndgame } from "@/lib/endgames/engine";
import { endgameRewardRequest } from "@/lib/endgames/rewardsClient";
import { refreshCelebrations } from "@/lib/celebrations";
import { endgameResult, readEndgameProgress, replayEndgame, takeBackEndgame, type EndgameAttempt, type EndgameProgress } from "@/lib/endgames/practice";
import styles from "./EndgameTraining.module.css";

const buttonClass = "min-h-11 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:opacity-40";

export function EndgameTraining({ studentId }: { studentId: string }) {
  const [progress, setProgress] = useState<EndgameProgress>({ selected: null, attempts: {} });
  const [loaded, setLoaded] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState("");
  const [slowLoading, setSlowLoading] = useState(false);
  const preparedEngine = useRef<AnalysisStockfishService | null>(null);
  const generation = useRef<{ token: number; engine: AnalysisStockfishService | null }>({ token: 0, engine: null });
  const storageKey = `chessquest:endgames:v1:${studentId}`;
  useEffect(() => {
    try { setProgress(readEndgameProgress(localStorage.getItem(storageKey))); }
    catch { setStorageWarning(true); }
    setLoaded(true);
    return () => { generation.current.token++; generation.current.engine?.terminate(); preparedEngine.current?.terminate(); };
  }, [storageKey]);
  useEffect(() => {
    setSlowLoading(false);
    if (!generating) return;
    const timer = setTimeout(() => setSlowLoading(true), 3000);
    return () => clearTimeout(timer);
  }, [generating]);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify(progress)); }
    catch { setStorageWarning(true); }
  }, [loaded, progress, storageKey]);
  const save = useCallback((id: string, attempt: EndgameAttempt) => {
    setProgress(current => ({ ...current, attempts: { ...current.attempts, [id]: attempt } }));
  }, []);
  const cancelGeneration = () => {
    generation.current.token++; generation.current.engine?.terminate(); generation.current.engine = null;
    setGenerating(null);
  };
  async function start(topic: EndgameTopic, difficulty: EndgameDifficulty = progress.difficulty ?? "challenge") {
    cancelGeneration();
    const token = generation.current.token;
    const engine = new AnalysisStockfishService({ multiPv: 1 }); generation.current.engine = engine;
    let handedOff = false;
    setGenerating(topic.id); setGenerationError("");
    try {
      const ticket = await endgameRewardRequest<{ token: string; seed: number }>({ action: "start", topicId: topic.id, difficulty });
      if (generation.current.token !== token) return;
      const previous = progress.attempts[topic.id]?.fen;
      for (let tries = 0; tries < 20; tries++) {
        const fen = endgameCandidateFromSeed(topic.id, ticket.seed, tries, difficulty);
        if (fen === previous) continue;
        const lines = await analyzeEndgame(engine, fen, 650);
        if (generation.current.token !== token) return;
        if (!winningCandidate(lines[0], difficulty)) continue;
        preparedEngine.current = engine; handedOff = true;
        setProgress(current => ({ ...current, selected: topic.id, attempts: { ...current.attempts, [topic.id]: { fen, difficulty, moves: [], assisted: false, completed: false, rewardToken: ticket.token, candidateIndex: tries } } }));
        return;
      }
      throw new Error("We couldn't verify a winning position this time. Please try generating another.");
    } catch (error) {
      if (generation.current.token === token) setGenerationError(error instanceof Error ? error.message : "Couldn't prepare this position. Please try again.");
    } finally {
      if (!handedOff) engine.terminate();
      if (generation.current.token === token) { generation.current.engine = null; setGenerating(null); }
    }
  }
  const topic = ENDGAME_TOPICS.find(item => item.id === progress.selected);
  const attempt = topic ? progress.attempts[topic.id] : null;
  if (!loaded) return <p role="status" className="p-4 text-slate-300">Preparing endgame practice…</p>;
  return <div className={styles.root}>
    {storageWarning && <p role="status" className="mb-3 text-sm text-amber-200">Practice still works, but this browser cannot save your position. Keep this tab open to continue.</p>}
    {generating && <div role="status" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-200/30 bg-slate-950 p-3 text-sm text-cyan-100">{slowLoading ? "Still preparing your computer opponent. The first download can take a little longer; keep this tab open." : "Creating a fresh position and checking the winning advantage…"}<button type="button" className={buttonClass} onClick={cancelGeneration}>Cancel</button></div>}
    {generationError && <p role="alert" className="mb-3 rounded-xl border border-amber-200/30 bg-slate-950 p-3 text-sm text-amber-100">{generationError}</p>}
    {topic && attempt ? <EndgameBoard key={`${topic.id}:${attempt.fen}`} topic={topic} initial={attempt} preparedEngine={preparedEngine.current} onSave={save} generating={Boolean(generating)} onNew={() => void start(topic, attempt.difficulty ?? "standard")} onBack={() => { cancelGeneration(); preparedEngine.current = null; setProgress(current => ({ ...current, selected: null })); }} /> : <>
      <header className="mb-6">
        <Link href="/student/training" className="text-sm font-bold text-cyan-100">← Training</Link>
        <p className="mt-5 text-xs font-black uppercase tracking-widest text-amber-200">Play it through</p>
        <h1 className="mt-2 text-3xl font-black text-white">Endgame Practice</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Choose a skill. Get a newly generated, engine-checked winning position, then finish it against a defending computer. No clock. Any legal move is welcome—your goal is checkmate.</p>
        <p className="mt-2 text-xs text-slate-400">Earn 3 XP + 3 coins for checkmate without hints or takebacks, once per generated attempt. Your current attempts save on this browser. Practice does not count as a rated game or quest win.</p>
      </header>
      <fieldset disabled={Boolean(generating)} className="mb-6">
        <legend className="mb-2 text-sm font-bold text-white">Practice difficulty</legend>
        <div className="flex flex-wrap gap-2">
          {(["standard", "challenge"] as const).map(difficulty => <label key={difficulty} className={`${buttonClass} flex cursor-pointer items-center gap-2 ${(progress.difficulty ?? "challenge") === difficulty ? "border-cyan-200/60 bg-cyan-300/10" : ""}`}>
            <input type="radio" name="endgame-difficulty" value={difficulty} checked={(progress.difficulty ?? "challenge") === difficulty} onChange={() => setProgress(current => ({ ...current, difficulty }))} />
            {difficulty === "standard" ? "Standard" : "Challenge"}
          </label>)}
        </div>
        <p className="mt-2 text-xs text-slate-400">{(progress.difficulty ?? "challenge") === "challenge" ? "Active defenders, more work before promotion, and longer conversions. Every start is checked for a winning advantage." : "Clearer winning positions for learning the basics."}</p>
      </fieldset>
      {(["Common endgames", "Convert the win"] as const).map(group => <section key={group} className="mb-8" aria-label={group}>
        <h2 className="mb-3 text-xl font-black text-white">{group}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ENDGAME_TOPICS.filter(item => item.group === group).map(item => {
            const saved = progress.attempts[item.id];
            return <article key={item.id} className="flex flex-col rounded-xl border border-white/10 bg-slate-950/85 p-5">
              <p className="text-xs font-bold text-cyan-200">{item.level}{saved?.completed ? " · Last position completed ✓" : ""}</p>
              <h3 className="mt-2 text-lg font-black text-white">{item.title}</h3>
              <p className="mb-5 mt-2 flex-1 text-sm leading-6 text-slate-400">{item.plan}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={Boolean(generating)} className={`${buttonClass} border-amber-200/40 bg-amber-300/10 text-amber-100`} onClick={() => void start(item)} aria-label={`New position: ${item.title}`}>New position</button>
                {saved && <button type="button" disabled={Boolean(generating)} className={buttonClass} onClick={() => setProgress(current => ({ ...current, selected: item.id }))} aria-label={`Resume: ${item.title}`}>{saved.completed ? "View result" : "Resume"}</button>}
              </div>
            </article>;
          })}
        </div>
      </section>)}
    </>}
  </div>;
}

function EndgameBoard({ topic, initial, preparedEngine, onSave, onBack, onNew, generating }: {
  topic: EndgameTopic; initial: EndgameAttempt; preparedEngine: AnalysisStockfishService | null; onSave: (id: string, attempt: EndgameAttempt) => void; onBack: () => void; onNew: () => void; generating: boolean;
}) {
  const [attempt, setAttempt] = useState(initial);
  const game = useMemo(() => replayEndgame(initial.fen, attempt.moves), [initial.fen, attempt.moves]);
  const player = useMemo(() => new Chess(initial.fen).turn(), [initial.fen]);
  const color: ChessColor = player === "w" ? "white" : "black";
  const result = endgameResult(game, player);
  const fen = game.fen();
  const [hintRequested, setHintRequested] = useState(false);
  const [hint, setHint] = useState<{ fen: string; uci: string; san: string } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const engineRef = useRef<AnalysisStockfishService | null>(preparedEngine);
  const [helpBusy, setHelpBusy] = useState(false);
  const assistanceRecorded = useRef(false);
  const trainingRewards = useTrainingRewards();
  const [rewardState, setRewardState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [rewardError, setRewardError] = useState("");
  const inputLocked = useRef(false);
  const currentAttempt = useRef(attempt); currentAttempt.current = attempt;
  const thinking = !result && game.turn() !== player;
  useEffect(() => { onSave(topic.id, attempt); }, [attempt, onSave, topic.id]);
  const claimReward = useCallback(async () => {
    setRewardState("saving"); setRewardError("");
    try {
      const receipt = await endgameRewardRequest<{ rewardXp: number; awarded: boolean; assisted: boolean }>({ action: "complete", token: attempt.rewardToken, candidateIndex: attempt.candidateIndex, moves: attempt.moves, assisted: attempt.assisted });
      setAttempt(current => ({ ...current, rewardXp: receipt.rewardXp, assisted: current.assisted || receipt.assisted }));
      trainingRewards.record({ id: `endgame:${attempt.rewardToken}`, xp: receipt.rewardXp, coins: receipt.rewardXp });
      setRewardState("saved");
      if (receipt.rewardXp === 3) refreshCelebrations();
    } catch (error) {
      setRewardState("error");
      setRewardError(error instanceof Error ? error.message : "Couldn't save your reward. Please retry.");
    }
  }, [attempt.rewardToken, attempt.candidateIndex, attempt.moves, attempt.assisted, trainingRewards]);
  useEffect(() => {
    if (result?.won && !attempt.assisted && attempt.rewardToken && !attempt.rewardXp && rewardState === "idle") void claimReward();
  }, [result?.won, attempt.assisted, attempt.rewardToken, attempt.rewardXp, rewardState, claimReward]);
  useEffect(() => () => { engineRef.current?.terminate(); }, []);
  useEffect(() => {
    if (game.isGameOver() || (game.turn() === player && !hintRequested)) { inputLocked.current = false; return; }
    let active = true, settled = false;
    inputLocked.current = true;
    const engine = engineRef.current ?? new AnalysisStockfishService({ multiPv: 1 }); engineRef.current = engine;
    void analyzeEndgame(engine, fen, attempt.difficulty === "challenge" ? 900 : 500).then(lines => {
      if (!active) return;
      const line = lines[0];
      if (!line) throw new Error("The defender returned no move.");
      const preview = new Chess(fen);
      const move = preview.move({ from: line.uci.slice(0, 2), to: line.uci.slice(2, 4), promotion: line.uci[4] });
      if (game.turn() === player) setHint({ fen, uci: line.uci, san: move.san });
      else setAttempt(current => ({ ...current, moves: [...current.moves, line.uci] }));
    }).catch(() => {
      if (!active) return;
      engine.terminate(); if (engineRef.current === engine) engineRef.current = null;
      setError("The defender couldn't respond. Your position is safe—retry to continue.");
    }).finally(() => {
      settled = true;
      if (active) { inputLocked.current = false; setHintRequested(false); }
    });
    return () => {
      active = false;
      if (!settled) { engine.terminate(); if (engineRef.current === engine) engineRef.current = null; }
    };
  }, [fen, game, player, hintRequested, retry, attempt.difficulty]);

  function move(from: string, to: string, piece?: PromotionPiece) {
    if (inputLocked.current || thinking || result || error || generating || helpBusy) return;
    if (!piece && game.get(from as Square)?.type === "p" && /[18]$/.test(to)) { setPromotion({ from, to }); return; }
    try {
      const next = replayEndgame(initial.fen, currentAttempt.current.moves);
      const played = next.move({ from, to, promotion: piece });
      const uci = `${played.from}${played.to}${played.promotion ?? ""}`;
      inputLocked.current = true;
      setAttempt(current => ({ ...current, moves: [...current.moves, uci], completed: endgameResult(next, player)?.won === true }));
      setHint(null);
    } catch { /* Illegal moves leave the position unchanged. */ }
  }
  function reset(takeback: boolean) {
    setHintRequested(false); setHint(null); setPromotion(null); setError(""); setRetry(value => value + 1);
    setAttempt(current => ({ ...current, moves: takeback ? takeBackEndgame(initial.fen, current.moves) : [], assisted: current.assisted || takeback, completed: false }));
  }
  async function useHelp(kind: "hint" | "takeback") {
    if (helpBusy) return;
    inputLocked.current = true; setHelpBusy(true); setRewardError("");
    // Sticky locally immediately; acknowledge server-side before revealing help.
    setAttempt(current => ({ ...current, assisted: true }));
    try {
      if (attempt.rewardToken && !assistanceRecorded.current) {
        await endgameRewardRequest({ action: "assist", token: attempt.rewardToken });
        assistanceRecorded.current = true;
      }
      if (kind === "hint") setHintRequested(true);
      else reset(true);
    } catch {
      setRewardError("Couldn't record practice help. Please try the hint or takeback again.");
    } finally { inputLocked.current = false; setHelpBusy(false); }
  }
  const history = game.history({ verbose: true });
  const last = history.at(-1);
  const currentHint = hint?.fen === fen ? hint : null;
  const status = result?.title ?? (error ? "Defender paused" : thinking ? "Defender thinking…" : hintRequested ? "Finding a hint…" : game.isCheck() ? "Your king is in check" : "Your move");
  return <>
    <header className={styles.heading}>
      <div><button type="button" onClick={onBack} className="text-sm font-bold text-cyan-100">← All endgames</button><h1 className="mt-1 text-xl font-black text-white sm:text-2xl">{topic.title}</h1></div>
      <span className="text-sm font-bold text-slate-300">{attempt.difficulty === "challenge" ? "Challenge" : "Standard"} · You play {color}</span>
    </header>
    <div className={styles.layout}>
      <div className={styles.boardColumn}>
        <div className="mb-2 flex items-center justify-between gap-2 text-sm"><span role="status" className="font-bold text-cyan-100">{status}</span><span className="text-xs text-slate-400">Win by checkmate</span></div>
        <div className="relative" data-testid="endgame-board" data-fen={fen} data-color={color}>
          <AcademyChessboard fen={fen} orientation={color} humanColor={color} interactive={!thinking && !result && !hintRequested && !promotion && !error && !generating && !helpBusy} lastMove={last ? [last.from, last.to] : null} onMove={move} onBoardInteraction={() => setHint(null)} allowDrawingArrows boardId="endgame-practice" arrows={currentHint ? [{ startSquare: currentHint.uci.slice(0, 2), endSquare: currentHint.uci.slice(2, 4), color: "rgba(250,204,21,.8)" }] : undefined} />
          {promotion && <EndgamePromotion color={color} file={promotion.to[0]} onCancel={() => setPromotion(null)} onChoose={piece => { const pending = promotion; setPromotion(null); move(pending.from, pending.to, piece); }} />}
        </div>

      </div>
      <aside className={styles.panel}>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Practice controls">
          <button type="button" className={buttonClass} disabled={Boolean(result) || thinking || hintRequested || Boolean(error) || generating || helpBusy} onClick={() => void useHelp("hint")}>Hint</button>
          <button type="button" className={buttonClass} disabled={!attempt.moves.length || generating || helpBusy} onClick={() => void useHelp("takeback")}>Take back</button>
          <button type="button" className={buttonClass} disabled={generating || helpBusy || rewardState === "saving"} onClick={() => reset(false)}>Retry position</button>
          <button type="button" className={`${buttonClass} border-amber-200/40 bg-amber-300/10 text-amber-100`} onClick={onNew} disabled={generating}>New position</button>
        </div>
        <p className="text-xs font-bold text-amber-100">{attempt.rewardXp === 3 ? "3 XP + 3 coins earned for this position" : attempt.assisted ? "Practice with help · no reward for this position" : attempt.rewardToken ? "3 XP + 3 coins for checkmate without help" : "Saved practice · start a new position to earn rewards"}</p>
        <TrainingSessionRewards />
        {rewardState === "saving" && <p role="status" className="text-sm text-cyan-100">Saving your 3 XP + 3 coins…</p>}
        {rewardError && <div role="alert" className="rounded-xl border border-amber-200/30 p-3 text-sm text-amber-100">{rewardError}{rewardState === "error" && result?.won && !attempt.assisted && <button type="button" className={`${buttonClass} mt-2`} onClick={() => void claimReward()}>Retry reward save</button>}</div>}
        {error && <div role="alert" className="rounded-xl border border-amber-200/30 bg-amber-300/10 p-4"><p className="text-sm text-amber-100">{error}</p><button type="button" className={`${buttonClass} mt-3`} onClick={() => { setError(""); setRetry(value => value + 1); }}>Retry defender</button></div>}
        {result && <section role="status" className="rounded-xl border border-amber-200/40 bg-amber-300/10 p-4"><h2 className="text-xl font-black text-amber-100">{result.title}</h2><p className="mt-2 text-sm leading-6 text-slate-200">{result.message}</p></section>}
        {currentHint && <p role="status" className="rounded-xl border border-cyan-200/25 bg-cyan-200/5 p-3 text-sm text-cyan-100">Try <strong>{currentHint.san}</strong> ({currentHint.uci.slice(0, 2)} → {currentHint.uci.slice(2, 4)}).</p>}
      </aside>
    </div>
  </>;
}

function EndgamePromotion({ color, file, onChoose, onCancel }: { color: ChessColor; file: string; onChoose: (piece: PromotionPiece) => void; onCancel: () => void }) {
  const ref = useGameDialogFocus(onCancel);
  const column = color === "white" ? file.charCodeAt(0) - 97 : 104 - file.charCodeAt(0);
  return <div className="absolute inset-0 z-20 rounded-lg bg-slate-950/40">
    <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Choose a promotion" className="absolute top-0 flex w-[12.5%] flex-col overflow-hidden rounded-md border border-amber-200 bg-slate-900 shadow-xl" style={{ left: `${column * 12.5}%` }}>
      {([ ["q", "Queen", "♕", "♛"], ["r", "Rook", "♖", "♜"], ["b", "Bishop", "♗", "♝"], ["n", "Knight", "♘", "♞"] ] as const).map(([piece, label, white, black]) => <button type="button" key={piece} aria-label={`Promote to ${label}`} onClick={() => onChoose(piece)} className="aspect-square w-full text-[clamp(1.5rem,4vw,3rem)] text-amber-100 hover:bg-cyan-200/20 focus:bg-cyan-200/20">{color === "white" ? white : black}</button>)}
      <button type="button" onClick={onCancel} aria-label="Cancel promotion" className="min-h-8 text-sm text-white hover:bg-white/10">✕</button>
    </section>
  </div>;
}
