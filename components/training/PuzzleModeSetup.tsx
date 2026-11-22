"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PUZZLE_MODE_OPTIONS, type PuzzleModeChoice } from "@/lib/puzzle-training/launcher";
import { PUZZLE_DIFFICULTY_OPTIONS, WOODPECKER_SET_SIZE_OPTIONS } from "@/lib/puzzle-training/modes";
import { puzzleThemeOptions, type PuzzleLevelSlug, type PuzzleThemeSlug } from "@/lib/puzzle-training/types";

export type { PuzzleModeChoice };
const SELECT_CLASS = "mt-2 w-full rounded-lg border border-cyan-200/25 bg-slate-950 px-3 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200";

export function AutoAdvanceSwitch({ checked, onChange, compact = false }: {
  checked: boolean; onChange: (checked: boolean) => void; compact?: boolean;
}) {
  return <div className={`flex items-center justify-between gap-4 ${compact ? "rounded-md border border-white/10 bg-white/5 px-3 py-2" : ""}`}>
    <p className="text-sm font-black text-white">Auto-advance</p>
    <button type="button" role="switch" aria-checked={checked} aria-label="Automatically move to the next puzzle"
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${checked ? "border-cyan-200 bg-cyan-300" : "border-white/20 bg-slate-700"}`}>
      <span className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  </div>;
}

export function PuzzleModeSetup({ selectedTheme, onThemeChange, selectedLevel, onLevelChange,
  woodpeckerSetSize, onWoodpeckerSetSizeChange, autoAdvance, onAutoAdvanceChange, onStart
}: {
  selectedTheme: PuzzleThemeSlug; onThemeChange: (theme: PuzzleThemeSlug) => void;
  selectedLevel: PuzzleLevelSlug; onLevelChange: (level: PuzzleLevelSlug) => void;
  woodpeckerSetSize: number; onWoodpeckerSetSizeChange: (size: number) => void;
  autoAdvance: boolean; onAutoAdvanceChange: (enabled: boolean) => void;
  onStart: (mode: PuzzleModeChoice, quickStart?: boolean) => void;
}) {
  const [panel, setPanel] = useState<"survival" | "woodpecker" | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousPanel = useRef(panel);
  useEffect(() => {
    if (panel || previousPanel.current) heading.current?.focus();
    previousPanel.current = panel;
  }, [panel]);
  const selected = PUZZLE_MODE_OPTIONS.find(mode => mode.id === panel);
  if (panel) return <section className="mx-auto max-w-4xl space-y-4" onKeyDown={event => { if (event.key === "Escape") setPanel(null); }}>
    <button type="button" onClick={() => setPanel(null)} className="min-h-11 font-bold text-cyan-200">← Back to modes</button>
    <h2 ref={heading} tabIndex={-1} className="text-2xl font-black text-white outline-none">{`${selected?.name} settings`}</h2>
    {<Card className="space-y-5 p-5">
      <label className="block text-sm font-bold text-cyan-100">Theme
        <select aria-label="Theme" className={SELECT_CLASS} value={selectedTheme} onChange={event => onThemeChange(event.target.value as PuzzleThemeSlug)}>
          {puzzleThemeOptions.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
        </select>
      </label>
      {panel === "woodpecker" && <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold text-cyan-100">Difficulty
          <select aria-label="Difficulty" className={SELECT_CLASS} value={selectedLevel} onChange={event => onLevelChange(event.target.value as PuzzleLevelSlug)}>
            {PUZZLE_DIFFICULTY_OPTIONS.map(level => <option key={level.id} value={level.id}>{level.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-bold text-cyan-100">Puzzles per cycle
          <select aria-label="Puzzles per cycle" className={SELECT_CLASS} value={woodpeckerSetSize} onChange={event => onWoodpeckerSetSizeChange(Number(event.target.value))}>
            {WOODPECKER_SET_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>}
      <AutoAdvanceSwitch checked={autoAdvance} onChange={onAutoAdvanceChange} />
      <Button className="w-full" onClick={() => onStart(panel, true)}>{selected?.startLabel}</Button>
    </Card>}
  </section>;
  return <section className="mx-auto max-w-5xl space-y-4">
    <h2 ref={heading} tabIndex={-1} className="text-xl font-black text-white outline-none">Choose a puzzle mode</h2>
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3" aria-label="Puzzle training modes">
      {PUZZLE_MODE_OPTIONS.map(mode => <Card key={mode.id} className="relative flex flex-col overflow-hidden">
        <button type="button" aria-label={mode.startLabel} onClick={() => onStart(mode.id, true)}
          className="min-h-28 flex-1 p-3 text-left sm:p-4 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
          <span aria-hidden="true" className="block pr-10 text-xl text-cyan-100">{mode.icon}</span>
          <span className="mt-1 block break-words text-sm font-black text-white sm:text-base">{mode.name}</span>
          <span className="mt-2 block text-xs text-slate-400">{mode.summary}</span>
        </button>
        {mode.id !== "daily" && mode.id !== "adaptiveReview" && <button type="button" aria-label={`${mode.name} settings`}
          onClick={() => mode.id === "survival" || mode.id === "woodpecker" ? setPanel(mode.id) : onStart(mode.id, false)}
          className="absolute right-0 top-0 grid size-11 place-items-center rounded-lg text-lg text-slate-400 hover:bg-white/10 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2"><span aria-hidden="true">⚙</span></button>}
      </Card>)}
      <Link href="/student/training/endgames" className="rounded-xl border border-white/10 bg-slate-950/60 p-3 sm:p-4 hover:bg-cyan-300/10"><span className="font-black text-white">♔ Endgame Practice →</span><span className="mt-2 block text-xs text-slate-400">Choose a position to play out</span></Link>
      <Link href="/student/training/assessment" className="rounded-xl border border-white/10 bg-slate-950/60 p-3 sm:p-4 hover:bg-cyan-300/10"><span className="font-black text-white">✓ Chess Skills Test →</span><span className="mt-2 block text-xs text-slate-400">30 positions · 30 minutes · play your answers</span></Link>
      <Link href="/student/training/battle" className="rounded-xl border border-white/10 bg-slate-950/60 p-3 sm:p-4 hover:bg-cyan-300/10"><span className="font-black text-white">⚔ Puzzle Battle →</span><span className="mt-2 block text-xs text-slate-400">Race a classmate or computer</span></Link>
    </div>
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-bold text-cyan-200">
      <Link href="/student/training/dashboard" className="py-3 hover:underline">Progress & replays</Link>
      <Link href="/student/training/stats" prefetch={false} className="py-3 hover:underline">Stats &amp; leaderboards</Link>
    </div>
  </section>;
}
