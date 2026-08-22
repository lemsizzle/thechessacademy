"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import {
  PUZZLE_DIFFICULTY_OPTIONS,
  SURVIVAL_DIFFICULTY_STAGES,
  SURVIVAL_PUZZLE_LIMIT,
  WOODPECKER_ROUND_COUNT,
  WOODPECKER_SET_SIZE_OPTIONS
} from "@/lib/puzzle-training/modes";
import { puzzleThemeOptions, type PuzzleLevelSlug, type PuzzleThemeSlug } from "@/lib/puzzle-training/types";

export type PuzzleModeChoice = "survival" | "woodpecker";

const modeOptions: ReadonlyArray<{
  id: PuzzleModeChoice;
  name: string;
  summary: string;
  description: string;
}> = [
  {
    id: "survival",
    name: "Survival",
    summary: `${SURVIVAL_PUZZLE_LIMIT} puzzles · 3 lives`,
    description: "Starts very easy and becomes harder as you advance."
  },
  {
    id: "woodpecker",
    name: "Woodpecker",
    summary: `${WOODPECKER_ROUND_COUNT} rounds · repeat one set`,
    description: "Choose a difficulty and repeat the same puzzles for pattern mastery."
  }
];

export function AutoAdvanceSwitch({ checked, onChange, compact = false }: { checked: boolean; onChange: (checked: boolean) => void; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${compact ? "rounded-md border border-white/10 bg-white/5 px-3 py-2" : ""}`}>
      <div>
        <p className="text-sm font-black text-white">Auto-advance</p>
        {compact ? null : <p className="mt-1 text-xs text-slate-400">Open the next puzzle automatically after a correct solution.</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Automatically move to the next puzzle"
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${checked ? "border-cyan-200 bg-cyan-300" : "border-white/20 bg-slate-700"}`}
      >
        <span className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export function PuzzleModeSetup({
  selectedMode,
  onModeChange,
  selectedTheme,
  onThemeChange,
  selectedLevel,
  onLevelChange,
  woodpeckerSetSize,
  onWoodpeckerSetSizeChange,
  autoAdvance,
  onAutoAdvanceChange,
  onStart,
  onDailyPuzzle
}: {
  selectedMode: PuzzleModeChoice;
  onModeChange: (mode: PuzzleModeChoice) => void;
  selectedTheme: PuzzleThemeSlug;
  onThemeChange: (theme: PuzzleThemeSlug) => void;
  selectedLevel: PuzzleLevelSlug;
  onLevelChange: (level: PuzzleLevelSlug) => void;
  woodpeckerSetSize: number;
  onWoodpeckerSetSizeChange: (size: number) => void;
  autoAdvance: boolean;
  onAutoAdvanceChange: (enabled: boolean) => void;
  onStart: () => void;
  onDailyPuzzle: () => void;
}) {
  const selectedThemeOption = puzzleThemeOptions.find((theme) => theme.id === selectedTheme);
  const selectedModeOption = modeOptions.find((mode) => mode.id === selectedMode) ?? modeOptions[0];

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 border-amber-300/25 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-amber-200">Puzzle of the Day</p>
          <p className="mt-1 text-sm text-slate-300">One shared challenge with a once-daily reward of 10 XP and 10 coins.</p>
        </div>
        <Button type="button" onClick={onDailyPuzzle} className="shrink-0">Play Daily Puzzle</Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-white/10 p-4 sm:p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-cyan-100">Training mode</p>
              <h2 className="mt-1 text-2xl font-black text-white">Choose how you want to train</h2>
            </div>
            <span className="hidden text-xs font-bold text-slate-500 sm:block">More modes coming</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Puzzle training mode">
            {modeOptions.map((mode) => {
              const selected = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onModeChange(mode.id)}
                  className={`rounded-lg border p-4 text-left transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${selected ? "border-cyan-200 bg-cyan-300/10 shadow-[0_0_22px_rgba(34,211,238,.12)]" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}
                >
                  <span className="flex items-center justify-between gap-3"><span className="font-black text-white">{mode.name}</span><span className={`h-3 w-3 rounded-full border ${selected ? "border-cyan-100 bg-cyan-300" : "border-slate-500"}`} /></span>
                  <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-amber-100">{mode.summary}</span>
                  <span className="mt-2 block text-sm leading-5 text-slate-400">{mode.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <div className={`grid gap-4 ${selectedMode === "woodpecker" ? "lg:grid-cols-3" : "lg:grid-cols-[minmax(0,1fr)_minmax(280px,1.25fr)]"}`}>
            <div>
              <label htmlFor="training-theme" className="mb-2 block text-xs font-black uppercase tracking-wide text-cyan-100">Theme</label>
              <select id="training-theme" value={selectedTheme} onChange={(event) => onThemeChange(event.target.value as PuzzleThemeSlug)} className="w-full rounded-lg border border-cyan-200/25 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none transition focus:border-cyan-200 focus:ring-2 focus:ring-cyan-200/30">
                {puzzleThemeOptions.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">{selectedThemeOption?.description}</p>
            </div>

            {selectedMode === "woodpecker" ? (
              <>
                <div>
                  <label htmlFor="woodpecker-difficulty" className="mb-2 block text-xs font-black uppercase tracking-wide text-cyan-100">Difficulty</label>
                  <select id="woodpecker-difficulty" value={selectedLevel} onChange={(event) => onLevelChange(event.target.value as PuzzleLevelSlug)} className="w-full rounded-lg border border-cyan-200/25 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none transition focus:border-cyan-200 focus:ring-2 focus:ring-cyan-200/30">
                    {PUZZLE_DIFFICULTY_OPTIONS.map((level) => <option key={level.id} value={level.id}>{level.name} · {level.rating}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="woodpecker-set-size" className="mb-2 block text-xs font-black uppercase tracking-wide text-cyan-100">Set size</label>
                  <select id="woodpecker-set-size" value={woodpeckerSetSize} onChange={(event) => onWoodpeckerSetSizeChange(Number(event.target.value))} className="w-full rounded-lg border border-cyan-200/25 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none transition focus:border-cyan-200 focus:ring-2 focus:ring-cyan-200/30">
                    {WOODPECKER_SET_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} puzzles</option>)}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-cyan-100">Adaptive difficulty</p>
                <div className="mt-2 grid grid-cols-5 gap-1" aria-label="Survival difficulty progression">
                  {SURVIVAL_DIFFICULTY_STAGES.map((stage) => (
                    <div key={stage.level} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-2 text-center">
                      <p className="text-[10px] font-black uppercase text-white">{stage.name}</p>
                      <p className="mt-1 text-[10px] text-slate-500">{stage.start}–{stage.end}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">Difficulty rises automatically every 10 puzzles, from very easy to expert.</p>
              </div>
            )}
          </div>

          <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <AutoAdvanceSwitch checked={autoAdvance} onChange={onAutoAdvanceChange} />
            <Button type="button" onClick={onStart} className="min-w-44">Start {selectedModeOption.name}</Button>
          </div>
        </div>
      </Card>

      <p className="text-xs text-slate-500">Academy training combines teacher-authored positions with puzzles from the Lichess open database.</p>
    </div>
  );
}
