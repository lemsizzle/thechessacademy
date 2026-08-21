"use client";

import { Chess } from "chess.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { PromotionDialog } from "@/chess/components/PromotionDialog";
import { NAG_VALUES, type AnalysisNag, type AnalysisShape, type AnalysisTree, type GuidedExercise } from "@/chess/analysis/types";
import { addAnalysisMove, deleteVariation, evaluateGuidedMove, firstNodeId, lastMainlineNodeId, nextNodeId, previousNodeId, promoteVariation, toggleNag, updateNodeAnnotations, updateNodeGuidedExercise } from "@/chess/analysis/tree";
import { useAnalysisEngine } from "@/chess/hooks/useAnalysisEngine";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { annotationStyleForColor, BOARD_ANNOTATION_COLORS, type BoardAnnotationStyle } from "@/chess/components/boardAnnotations";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type Props = {
  initialTree: AnalysisTree;
  title: string;
  subtitle?: string;
  editable?: boolean;
  saveStatus?: SaveStatus;
  saveMessage?: string;
  onTreeChange?: (tree: AnalysisTree) => void;
  actions?: React.ReactNode;
  gameMode?: boolean;
  canManageReferenceEvaluations?: boolean;
  canManageGuidedExercises?: boolean;
  guidedStudentMode?: boolean;
};

function displayPly(ply: number, san: string | null) {
  if (!san) return "Start";
  const number = Math.ceil(ply / 2);
  return ply % 2 ? `${number}. ${san}` : `${number}... ${san}`;
}

function treeRows(tree: AnalysisTree) {
  const rows: Array<{ id: string; depth: number; isMain: boolean }> = [];
  const visit = (id: string, depth: number, isMain: boolean, seen: Set<string>) => {
    if (seen.has(id)) return;
    seen.add(id);
    if (id !== tree.rootId) rows.push({ id, depth, isMain });
    const node = tree.nodes[id];
    if (!node) return;
    const ordered = node.mainChildId
      ? [node.mainChildId, ...node.childrenIds.filter((childId) => childId !== node.mainChildId)]
      : node.childrenIds;
    ordered.forEach((childId, index) => visit(childId, depth + (index === 0 ? 0 : 1), index === 0, seen));
  };
  visit(tree.rootId, 0, true, new Set());
  return rows;
}

function scoreLabel(score: number | null, mate: number | null) {
  if (mate !== null) return `#${Math.abs(mate)}` + (mate < 0 ? " Black" : " White");
  if (score === null) return "—";
  return `${score >= 0 ? "+" : ""}${(score / 100).toFixed(2)}`;
}

function GuidedExerciseEditor({ fen, exercise, onSave }: { fen: string; exercise: GuidedExercise | null; onSave: (exercise: GuidedExercise | null) => void }) {
  const [prompt, setPrompt] = useState(exercise?.prompt ?? "");
  const [expectedMoves, setExpectedMoves] = useState<string[]>(exercise?.expectedMovesUci ?? []);
  const [successMessage, setSuccessMessage] = useState(exercise?.successMessage ?? "");
  const legalMoves = useMemo(() => new Chess(fen).moves({ verbose: true }).map((move) => ({
    uci: `${move.from}${move.to}${move.promotion ?? ""}`,
    san: move.san
  })), [fen]);
  const canSave = Boolean(prompt.trim() && expectedMoves.length);

  function toggleExpectedMove(uci: string) {
    setExpectedMoves((moves) => moves.includes(uci) ? moves.filter((move) => move !== uci) : moves.length < 8 ? [...moves, uci] : moves);
  }

  return <Card className="p-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase text-violet-200">Teaching tool</p><h3 className="font-black text-white">Guided move exercise</h3></div>
      {exercise && <button type="button" className="rounded px-2 py-1 text-xs font-bold text-slate-400 hover:bg-rose-300/10 hover:text-rose-100" onClick={() => {
        setPrompt("");
        setExpectedMoves([]);
        setSuccessMessage("");
        onSave(null);
      }}>Remove</button>}
    </div>
    <form className="mt-3 space-y-3" onSubmit={(event) => {
      event.preventDefault();
      if (!canSave) return;
      onSave({ prompt: prompt.trim(), expectedMovesUci: expectedMoves, successMessage: successMessage.trim() });
    }}>
      <label className="block text-xs font-bold uppercase text-slate-400">Student prompt
        <textarea value={prompt} maxLength={500} onChange={(event) => setPrompt(event.target.value)} rows={3} placeholder="What should the student find in this position?" className="mt-1 w-full resize-y rounded-md border border-white/10 bg-slate-900 p-3 text-sm font-normal normal-case leading-5 text-white outline-none focus:border-violet-200/50" />
      </label>
      <fieldset>
        <legend className="text-xs font-bold uppercase text-slate-400">Accepted moves <span className="font-normal normal-case text-slate-500">({expectedMoves.length}/8)</span></legend>
        <p className="mt-1 text-xs text-slate-500">Choose every move that should count as correct.</p>
        <div className="scrollbar-soft mt-2 grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border border-white/10 bg-slate-950/70 p-2 sm:grid-cols-3">
          {legalMoves.map((move) => {
            const checked = expectedMoves.includes(move.uci);
            return <label key={move.uci} className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${checked ? "bg-violet-300/15 text-violet-100" : "bg-white/5 text-slate-300"}`}>
              <input type="checkbox" checked={checked} disabled={!checked && expectedMoves.length >= 8} onChange={() => toggleExpectedMove(move.uci)} className="accent-violet-300" />
              <span className="font-black">{move.san}</span><span className="ml-auto font-mono text-[10px] text-slate-500">{move.uci}</span>
            </label>;
          })}
        </div>
      </fieldset>
      <label className="block text-xs font-bold uppercase text-slate-400">Success explanation <span className="font-normal normal-case text-slate-500">(optional)</span>
        <textarea value={successMessage} maxLength={1000} onChange={(event) => setSuccessMessage(event.target.value)} rows={3} placeholder="Explain why the move works after the student solves it." className="mt-1 w-full resize-y rounded-md border border-white/10 bg-slate-900 p-3 text-sm font-normal normal-case leading-5 text-white outline-none focus:border-violet-200/50" />
      </label>
      <button type="submit" disabled={!canSave} className="w-full rounded-md border border-violet-200/30 bg-violet-300/15 px-3 py-2 text-sm font-black text-violet-100 disabled:cursor-not-allowed disabled:opacity-40">{exercise ? "Save exercise" : "Create exercise"}</button>
    </form>
  </Card>;
}

export function AnalysisWorkspace({ initialTree, title, subtitle, editable = true, saveStatus = "idle", saveMessage = "", onTreeChange, actions, gameMode = false, canManageReferenceEvaluations = false, canManageGuidedExercises = false, guidedStudentMode = false }: Props) {
  const [tree, setTree] = useState(initialTree);
  const [activeId, setActiveId] = useState(initialTree.rootId);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [engineOn, setEngineOn] = useState(false);
  const [annotationMode, setAnnotationMode] = useState<"arrow" | "circle" | null>(null);
  const [annotationStart, setAnnotationStart] = useState<string | null>(null);
  const [shapeStyle, setShapeStyle] = useState<BoardAnnotationStyle>("primary");
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [guidedResult, setGuidedResult] = useState<{ status: "correct" | "incorrect"; attemptedUci: string; attemptedSan: string } | null>(null);
  const [guidedFen, setGuidedFen] = useState<string | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const moveTreeRef = useRef<HTMLDivElement | null>(null);
  const originalTreeRef = useRef(initialTree);
  const engine = useAnalysisEngine();
  const node = tree.nodes[activeId] ?? tree.nodes[tree.rootId];
  const rows = useMemo(() => treeRows(tree), [tree]);
  const guidedExercise = guidedStudentMode ? node.guidedExercise ?? null : null;
  const guidedLocked = Boolean(guidedExercise && guidedResult?.status !== "correct");
  const displayFen = guidedFen ?? node.fen;

  function selectPosition(nextId: string) {
    setActiveId(nextId);
    setGuidedResult(null);
    setGuidedFen(null);
    setPendingPromotion(null);
  }

  function commitTree(nextTree: AnalysisTree, nextActiveId = activeId) {
    setTree(nextTree);
    selectPosition(nextActiveId);
    onTreeChange?.(nextTree);
  }

  useEffect(() => {
    const activeButton = activeButtonRef.current;
    const moveTree = moveTreeRef.current;
    if (!moveTree) return;
    if (activeId === tree.rootId) {
      moveTree.scrollTop = 0;
      return;
    }
    if (!activeButton || !moveTree.contains(activeButton)) return;
    const itemRect = activeButton.getBoundingClientRect();
    const treeRect = moveTree.getBoundingClientRect();
    if (itemRect.top < treeRect.top) moveTree.scrollTop -= treeRect.top - itemRect.top;
    else if (itemRect.bottom > treeRect.bottom) moveTree.scrollTop += itemRect.bottom - treeRect.bottom;
  }, [activeId, tree.rootId]);

  useEffect(() => {
    if (!engineOn || guidedLocked) {
      engine.stop();
      engine.clear();
      return;
    }
    const timer = window.setTimeout(() => void engine.analyze(node.fen), 260);
    return () => {
      window.clearTimeout(timer);
      engine.stop();
    };
  }, [engineOn, guidedLocked, node.fen]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable=true]")) return;
      let next = activeId;
      if (event.key === "ArrowLeft") next = previousNodeId(tree, activeId);
      else if (event.key === "ArrowRight") next = nextNodeId(tree, activeId);
      else if (event.key === "Home") next = firstNodeId(tree);
      else if (event.key === "End") next = lastMainlineNodeId(tree);
      else return;
      event.preventDefault();
      selectPosition(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, tree]);

  function makeMove(from: string, to: string, promotion?: "q" | "r" | "b" | "n") {
    const chess = new Chess(node.fen);
    const promotionNeeded = chess.moves({ square: from as never, verbose: true }).some((move) => move.to === to && Boolean(move.promotion));
    if (promotionNeeded && !promotion) {
      setPendingPromotion({ from, to });
      return;
    }
    if (guidedExercise) {
      try {
        const attempt = evaluateGuidedMove(node.fen, guidedExercise, from, to, promotion);
        if (attempt.correct) {
          setGuidedResult({ status: "correct", attemptedUci: attempt.uci, attemptedSan: attempt.san });
          setGuidedFen(attempt.fen);
        } else {
          setGuidedResult({ status: "incorrect", attemptedUci: attempt.uci, attemptedSan: attempt.san });
          setGuidedFen(null);
        }
      } catch {
        // The board only offers legal destinations, so an invalid drop is ignored.
      }
      return;
    }
    if (!editable) return;
    try {
      const result = addAnalysisMove(tree, activeId, from, to, promotion);
      commitTree(result.tree, result.nodeId);
    } catch {
      // The board only offers legal destinations, so an invalid drop is ignored.
    }
  }

  function updateShapes(shapes: AnalysisShape[]) {
    commitTree(updateNodeAnnotations(tree, activeId, { shapes }));
  }

  function saveReferenceEvaluation(line: (typeof engine.lines)[number]) {
    if (!canManageReferenceEvaluations) return;
    commitTree(updateNodeAnnotations(tree, activeId, {
      referenceEvaluation: {
        engine: "stockfish-18-lite",
        scoreWhiteCp: line.scoreWhiteCp,
        mateWhite: line.mateWhite,
        depth: line.depth,
        pvUci: line.pv.slice(0, 32),
        pvSan: line.san || line.uci,
        savedAt: new Date().toISOString()
      }
    }));
  }

  function toggleCircle(square: string, style: BoardAnnotationStyle) {
    const existing = node.shapes.find((shape) => shape.type === "circle" && shape.square === square);
    updateShapes(existing?.style === style
      ? node.shapes.filter((shape) => !(shape.type === "circle" && shape.square === square))
      : [...node.shapes.filter((shape) => !(shape.type === "circle" && shape.square === square)), { type: "circle", square, style }]);
  }

  function annotationSquare(square: string) {
    if (!annotationMode) return;
    if (annotationMode === "circle") {
      toggleCircle(square, shapeStyle);
      return;
    }
    if (!annotationStart) {
      setAnnotationStart(square);
      return;
    }
    if (annotationStart !== square) {
      const exists = node.shapes.some((shape) => shape.type === "arrow" && shape.from === annotationStart && shape.to === square && shape.style === shapeStyle);
      updateShapes(exists
        ? node.shapes.filter((shape) => !(shape.type === "arrow" && shape.from === annotationStart && shape.to === square && shape.style === shapeStyle))
        : [...node.shapes, { type: "arrow", from: annotationStart, to: square, style: shapeStyle }]);
    }
    setAnnotationStart(null);
  }

  const arrows = node.shapes.filter((shape): shape is Extract<AnalysisShape, { type: "arrow" }> => shape.type === "arrow")
    .map((shape) => ({ startSquare: shape.from, endSquare: shape.to, color: BOARD_ANNOTATION_COLORS[shape.style] }));
  const circles = node.shapes.filter((shape): shape is Extract<AnalysisShape, { type: "circle" }> => shape.type === "circle")
    .map((shape) => ({ square: shape.square, color: BOARD_ANNOTATION_COLORS[shape.style] }));
  const lastMove = guidedResult?.status === "correct"
    ? [guidedResult.attemptedUci.slice(0, 2), guidedResult.attemptedUci.slice(2, 4)] as [string, string]
    : node.uci ? [node.uci.slice(0, 2), node.uci.slice(2, 4)] as [string, string] : null;
  const moveColor = node.fen.split(" ")[1] === "w" ? "white" : "black";
  const topLine = engine.lines[0];
  const evaluation = topLine?.scoreWhiteCp ?? 0;
  const whitePercent = topLine?.mateWhite !== null && topLine?.mateWhite !== undefined
    ? topLine.mateWhite > 0 ? 96 : 4
    : Math.max(4, Math.min(96, 50 + evaluation / 20));

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Analysis board</p>
          <h2 className="truncate text-xl font-black text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saveStatus !== "idle" && <span className={`text-xs font-bold ${saveStatus === "error" ? "text-rose-200" : saveStatus === "saved" ? "text-emerald-200" : "text-slate-400"}`}>{saveStatus === "saving" ? "Saving…" : saveMessage || "Saved"}</span>}
          {actions}
        </div>
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,680px)_minmax(320px,1fr)]">
        <div className="mx-auto w-full max-w-[680px] min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2" aria-label="Board tools">
            <Button type="button" aria-pressed={annotationMode === null} variant={annotationMode === null ? "secondary" : "ghost"} onClick={() => { setAnnotationMode(null); setAnnotationStart(null); }}>Move pieces</Button>
            <Button type="button" aria-pressed={annotationMode === "arrow"} variant={annotationMode === "arrow" ? "secondary" : "ghost"} onClick={() => { setAnnotationMode("arrow"); setAnnotationStart(null); }}>Draw arrow</Button>
            <Button type="button" aria-pressed={annotationMode === "circle"} variant={annotationMode === "circle" ? "secondary" : "ghost"} onClick={() => { setAnnotationMode("circle"); setAnnotationStart(null); }}>Circle square</Button>
            <select aria-label="Annotation style" value={shapeStyle} onChange={(event) => setShapeStyle(event.target.value as BoardAnnotationStyle)} className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-bold text-white">
              {Object.keys(BOARD_ANNOTATION_COLORS).map((style) => <option key={style} value={style}>{style}</option>)}
            </select>
            <Button type="button" variant="ghost" disabled={!node.shapes.length} onClick={() => updateShapes([])}>Clear marks</Button>
            <Button type="button" variant="ghost" onClick={() => setOrientation((value) => value === "white" ? "black" : "white")}>Flip board</Button>
            {gameMode && <Button type="button" variant="ghost" onClick={() => {
              let id = activeId;
              while (tree.nodes[id]?.origin === "analysis" && tree.nodes[id]?.parentId) id = tree.nodes[id].parentId!;
              selectPosition(id);
            }}>Return to Game Line</Button>}
            {gameMode && <Button type="button" variant="ghost" onClick={() => {
              if (window.confirm("Remove all temporary variations and annotations and restore the original game line?")) {
                commitTree(originalTreeRef.current, originalTreeRef.current.rootId);
              }
            }}>Reset Temporary Analysis</Button>}
          </div>
          <p className="text-xs text-slate-400">Lichess controls: right-click for a green circle, right-drag for an arrow. Hold Shift/Ctrl for red, Alt/Command for blue, or combine them for yellow.</p>
          {annotationMode && <p className="text-xs text-cyan-100">{annotationMode === "arrow" ? annotationStart ? "Tap the destination square." : "Tap an arrow’s start square, then its destination. Right-drag also works with a mouse." : "Tap a square to add or remove a circle."}</p>}
          {guidedExercise && <Card className="border-violet-200/25 bg-violet-300/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-violet-200">Guess the move</p>
            <p className="mt-1 font-bold leading-6 text-white">{guidedExercise.prompt}</p>
            <div className="mt-3" aria-live="polite">
              {!guidedResult && <p className="text-sm text-slate-300">Play your answer directly on the board.</p>}
              {guidedResult?.status === "incorrect" && <p className="rounded-md border border-amber-300/25 bg-amber-300/10 p-3 text-sm font-bold text-amber-100"><span className="font-black">{guidedResult.attemptedSan}</span> is legal, but it is not the move this exercise is looking for. Try again.</p>}
              {guidedResult?.status === "correct" && <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-50"><p className="font-black">Correct — {guidedResult.attemptedSan}!</p>{guidedExercise.successMessage && <p className="mt-1 leading-5">{guidedExercise.successMessage}</p>}</div>}
            </div>
            {guidedResult && <button type="button" className="mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/10" onClick={() => { setGuidedResult(null); setGuidedFen(null); }}>Reset attempt</button>}
          </Card>}
          <div className="flex min-w-0 overflow-hidden rounded-xl border border-cyan-200/20 bg-slate-950/70 p-1 sm:p-2">
            {engineOn && (
              <div className="relative mr-1 w-7 shrink-0 overflow-hidden rounded bg-slate-800" aria-label={`Evaluation ${scoreLabel(topLine?.scoreWhiteCp ?? null, topLine?.mateWhite ?? null)}`}>
                <div className="absolute inset-x-0 bottom-0 bg-slate-100 transition-[height] duration-300" style={{ height: `${whitePercent}%` }} />
                <span className="absolute inset-x-0 top-1 z-10 text-center text-[9px] font-black text-amber-300 [text-shadow:0_1px_2px_#000]">{scoreLabel(topLine?.scoreWhiteCp ?? null, topLine?.mateWhite ?? null)}</span>
              </div>
            )}
            <div className="aspect-square min-w-0 flex-1">
              <AcademyChessboard
                key={`${activeId}-${guidedResult?.status ?? "ready"}`}
                boardId="academy-analysis-board"
                fen={displayFen}
                orientation={orientation}
                humanColor={moveColor}
                interactive={guidedExercise ? guidedResult?.status !== "correct" : editable}
                lastMove={lastMove}
                onMove={makeMove}
                arrows={arrows}
                circles={circles}
                annotationMode={annotationMode}
                onAnnotationSquare={annotationSquare}
                allowDrawingArrows={editable}
                onArrowsChange={(next) => {
                  updateShapes([
                    ...node.shapes.filter((shape) => shape.type !== "arrow"),
                    ...next.map((arrow) => ({
                      type: "arrow" as const,
                      from: arrow.startSquare,
                      to: arrow.endSquare,
                      style: annotationStyleForColor(arrow.color)
                    }))
                  ]);
                }}
                onCircleToggle={editable ? (square, color) => toggleCircle(square, annotationStyleForColor(color)) : undefined}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Button type="button" variant="ghost" onClick={() => selectPosition(firstNodeId(tree))} aria-label="First position">|&lt;</Button>
            <Button type="button" variant="ghost" onClick={() => selectPosition(previousNodeId(tree, activeId))} aria-label="Previous move">&lt;</Button>
            <Button type="button" variant="ghost" onClick={() => selectPosition(nextNodeId(tree, activeId))} aria-label="Next move">&gt;</Button>
            <Button type="button" variant="ghost" onClick={() => selectPosition(lastMainlineNodeId(tree))} aria-label="Last main-line position">&gt;|</Button>
          </div>
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase text-cyan-200">Local Stockfish</p><h3 className="font-black text-white">Engine analysis</h3></div>
              <button type="button" role="switch" aria-checked={engineOn && !guidedLocked} disabled={guidedLocked} onClick={() => setEngineOn((value) => !value)} className={`rounded-full border px-4 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50 ${engineOn && !guidedLocked ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-100" : "border-white/10 bg-white/5 text-slate-300"}`}>{guidedLocked ? "LOCKED" : engineOn ? "ON" : "OFF"}</button>
            </div>
            {guidedLocked ? <p className="mt-3 text-xs leading-5 text-slate-400">Engine lines and teacher references unlock after you solve this position.</p> : !engineOn && <p className="mt-3 text-xs leading-5 text-slate-400">Off by default. Analysis runs only in this browser and is never sent to a chess service.</p>}
            {!guidedLocked && node.referenceEvaluation && <div className="mt-3 rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-black uppercase tracking-wide text-amber-200">Teacher reference</p><p className="mt-1 font-mono text-sm font-black text-white">{scoreLabel(node.referenceEvaluation.scoreWhiteCp, node.referenceEvaluation.mateWhite)} <span className="font-sans text-xs font-normal text-slate-400">depth {node.referenceEvaluation.depth}</span></p></div>
                {canManageReferenceEvaluations && <button type="button" className="rounded px-2 py-1 text-xs font-bold text-slate-400 hover:bg-rose-300/10 hover:text-rose-100" onClick={() => {
                  if (window.confirm("Remove the saved teacher reference from this position?")) commitTree(updateNodeAnnotations(tree, activeId, { referenceEvaluation: null }));
                }}>Remove</button>}
              </div>
              <p className="mt-2 break-words text-xs font-bold leading-5 text-amber-50">{node.referenceEvaluation.pvSan}</p>
              <p className="mt-1 text-[11px] text-slate-500">Saved Stockfish reference · {new Date(node.referenceEvaluation.savedAt).toLocaleString()}</p>
            </div>}
            {engineOn && !guidedLocked && <div className="mt-3 space-y-2" aria-live="polite">
              {engine.loading && <p className="text-xs text-slate-400">Analyzing this position…</p>}
              {engine.error && <p className="text-xs text-rose-200">{engine.error}</p>}
              {engine.lines.map((line) => <div key={`${line.rank}-${line.uci}`} className="flex overflow-hidden rounded-md border border-white/10 bg-white/5">
                <button type="button" onClick={() => {
                  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(line.uci);
                  if (match) makeMove(match[1], match[2], match[3] as "q" | "r" | "b" | "n" | undefined);
                }} className="grid min-w-0 flex-1 grid-cols-[3.3rem_1fr] gap-2 p-2 text-left hover:bg-white/10" aria-label={`Explore engine line ${line.rank}: ${line.san || line.uci}`}>
                  <span className="font-mono text-xs font-black text-amber-200">{scoreLabel(line.scoreWhiteCp, line.mateWhite)}</span>
                  <span className="truncate text-xs font-bold text-slate-200">{line.san || line.uci}</span>
                </button>
                {canManageReferenceEvaluations && <button type="button" className="border-l border-white/10 px-3 text-xs font-black text-cyan-100 hover:bg-cyan-300/10" onClick={() => saveReferenceEvaluation(line)} aria-label={`Save engine line ${line.rank} as teacher reference`}>Save</button>}
              </div>)}
            </div>}
          </Card>

          {canManageGuidedExercises && <GuidedExerciseEditor key={activeId} fen={node.fen} exercise={node.guidedExercise ?? null} onSave={(exercise) => commitTree(updateNodeGuidedExercise(tree, activeId, exercise))} />}

          <Card className="p-4">
            <div className="flex items-center justify-between"><h3 className="font-black text-white">Move tree</h3><span className="text-xs text-slate-500">← → Home End</span></div>
            <button type="button" ref={activeId === tree.rootId ? activeButtonRef : undefined} onClick={() => selectPosition(tree.rootId)} className={`mt-3 w-full rounded-md px-3 py-2 text-left text-sm font-bold ${activeId === tree.rootId ? "bg-cyan-300/15 text-cyan-100" : "bg-white/5 text-slate-300"}`}>Starting position {tree.nodes[tree.rootId].guidedExercise && <span title="Guided exercise" className="text-violet-300">◆</span>}</button>
            <div ref={moveTreeRef} className="scrollbar-soft mt-2 max-h-72 space-y-1 overflow-y-auto rounded-md border border-white/10 bg-slate-950/70 p-2" role="tree">
              {rows.length ? rows.map(({ id, depth, isMain }) => {
                const item = tree.nodes[id];
                const parent = item.parentId ? tree.nodes[item.parentId] : null;
                const branch = Boolean(parent && parent.childrenIds.length > 1);
                return <div key={id} className="group flex items-center gap-1" style={{ paddingLeft: `${Math.min(depth, 7) * 14}px` }}>
                  <button type="button" ref={activeId === id ? activeButtonRef : undefined} role="treeitem" aria-selected={activeId === id} onClick={() => selectPosition(id)} className={`min-w-0 flex-1 rounded px-2 py-1.5 text-left text-sm ${activeId === id ? "bg-cyan-300/18 font-black text-white" : isMain ? "font-bold text-slate-200 hover:bg-white/5" : "text-amber-100 hover:bg-white/5"}`}>
                    {branch && !isMain && <span className="mr-1 text-amber-300">↳</span>}{displayPly(item.ply, item.san)} {item.nags.join("")} {item.comment && <span title="Comment" className="ml-1 text-cyan-300">●</span>} {item.referenceEvaluation && <span title="Teacher reference evaluation" className="text-amber-300">★</span>} {item.guidedExercise && <span title="Guided exercise" className="text-violet-300">◆</span>}
                  </button>
                  {editable && branch && !isMain && parent && <button type="button" title="Promote variation" className="rounded px-1 text-xs text-slate-500 hover:bg-white/10 hover:text-white" onClick={() => commitTree(promoteVariation(tree, parent.id, id), id)}>↑</button>}
                  {editable && item.origin === "analysis" && <button type="button" title="Delete variation" className="rounded px-1 text-xs text-slate-500 hover:bg-rose-300/10 hover:text-rose-200" onClick={() => {
                    if (!window.confirm(`Delete ${item.san ?? "this move"} and every continuation below it?`)) return;
                    const parentId = item.parentId!;
                    commitTree(deleteVariation(tree, id), parentId);
                  }}>×</button>}
                </div>;
              }) : <p className="p-3 text-sm text-slate-500">Make a legal move on the board to begin a line.</p>}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-black text-white">Position notes</h3>
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Move annotations">
              {NAG_VALUES.map((nag) => <button key={nag} type="button" disabled={!editable} aria-pressed={node.nags.includes(nag)} onClick={() => commitTree(updateNodeAnnotations(tree, activeId, { nags: toggleNag(node.nags, nag as AnalysisNag) }))} className={`rounded border px-2.5 py-1 text-sm font-black ${node.nags.includes(nag) ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/10 bg-white/5 text-slate-300"}`}>{nag}</button>)}
            </div>
            <label className="mt-3 block text-xs font-bold uppercase text-slate-400">Comment
              <textarea disabled={!editable} value={node.comment} onChange={(event) => commitTree(updateNodeAnnotations(tree, activeId, { comment: event.target.value.slice(0, 5000) }))} rows={5} placeholder="Explain the idea, mistake, or plan in this position…" className="mt-1 w-full resize-y rounded-md border border-white/10 bg-slate-900 p-3 text-sm font-normal normal-case leading-5 text-white outline-none focus:border-cyan-200/50" />
            </label>
          </Card>
        </aside>
      </div>

      {pendingPromotion && <PromotionDialog color={moveColor} onChoose={(promotion) => { const pending = pendingPromotion; setPendingPromotion(null); makeMove(pending.from, pending.to, promotion); }} onCancel={() => setPendingPromotion(null)} />}
    </div>
  );
}
