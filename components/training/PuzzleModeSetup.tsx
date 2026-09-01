"use client";

import {
  useEffect,
  useReducer,
  useRef,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PuzzleTrainingStats } from "@/components/training/PuzzleTrainingStats";
import {
  initialPuzzleLauncherState,
  PUZZLE_MODE_OPTIONS,
  puzzleLauncherDismissAction,
  puzzleLauncherReducer,
  type PuzzleModeChoice
} from "@/lib/puzzle-training/launcher";
import {
  PUZZLE_DIFFICULTY_OPTIONS,
  SURVIVAL_DIFFICULTY_STAGES,
  WOODPECKER_SET_SIZE_OPTIONS
} from "@/lib/puzzle-training/modes";
import type { PuzzleTrainingOverview } from "@/lib/puzzle-training/overview";
import {
  puzzleThemeOptions,
  type PuzzleLevelSlug,
  type PuzzleThemeSlug
} from "@/lib/puzzle-training/types";

const SELECT_CLASS = "w-full rounded-lg border border-cyan-200/25 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none transition focus:border-cyan-200 focus:ring-2 focus:ring-cyan-200/30";

export type { PuzzleModeChoice };

function ThemeControl({
  selectedTheme,
  onThemeChange
}: {
  selectedTheme: PuzzleThemeSlug;
  onThemeChange: (theme: PuzzleThemeSlug) => void;
}) {
  const theme = puzzleThemeOptions.find((option) => option.id === selectedTheme);

  return (
    <div>
      <label htmlFor="training-theme" className="mb-2 block text-xs font-black uppercase tracking-wide text-cyan-100">Theme</label>
      <select
        id="training-theme"
        value={selectedTheme}
        onChange={(event) => onThemeChange(event.target.value as PuzzleThemeSlug)}
        className={SELECT_CLASS}
      >
        {puzzleThemeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      <p className="mt-2 text-xs leading-5 text-slate-400">{theme?.description}</p>
    </div>
  );
}

function SurvivalDetails({
  selectedTheme,
  onThemeChange
}: {
  selectedTheme: PuzzleThemeSlug;
  onThemeChange: (theme: PuzzleThemeSlug) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
      <ThemeControl selectedTheme={selectedTheme} onThemeChange={onThemeChange} />
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-cyan-100">Adaptive difficulty</p>
        <div className="mt-2 grid grid-cols-5 gap-1" aria-label="Survival difficulty progression">
          {SURVIVAL_DIFFICULTY_STAGES.map((stage) => (
            <div key={stage.level} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-2 text-center">
              <p className="text-[9px] font-black uppercase text-white sm:text-[10px]">{stage.name}</p>
              <p className="mt-1 text-[10px] text-slate-500">{stage.start}–{stage.end}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">Three lives. Difficulty rises every 10 puzzles, from very easy to expert.</p>
      </div>
    </div>
  );
}

function WoodpeckerDetails({
  selectedTheme,
  onThemeChange,
  selectedLevel,
  onLevelChange,
  setSize,
  onSetSizeChange
}: {
  selectedTheme: PuzzleThemeSlug;
  onThemeChange: (theme: PuzzleThemeSlug) => void;
  selectedLevel: PuzzleLevelSlug;
  onLevelChange: (level: PuzzleLevelSlug) => void;
  setSize: number;
  onSetSizeChange: (size: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <ThemeControl selectedTheme={selectedTheme} onThemeChange={onThemeChange} />
        <div>
          <label htmlFor="woodpecker-difficulty" className="mb-2 block text-xs font-black uppercase tracking-wide text-cyan-100">Difficulty</label>
          <select
            id="woodpecker-difficulty"
            value={selectedLevel}
            onChange={(event) => onLevelChange(event.target.value as PuzzleLevelSlug)}
            className={SELECT_CLASS}
          >
            {PUZZLE_DIFFICULTY_OPTIONS.map((level) => <option key={level.id} value={level.id}>{level.name} · {level.rating}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="woodpecker-set-size" className="mb-2 block text-xs font-black uppercase tracking-wide text-cyan-100">Set size</label>
          <select
            id="woodpecker-set-size"
            value={setSize}
            onChange={(event) => onSetSizeChange(Number(event.target.value))}
            className={SELECT_CLASS}
          >
            {WOODPECKER_SET_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} puzzles</option>)}
          </select>
        </div>
      </div>
      <div className="rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/[0.06] p-4 text-sm leading-6 text-slate-300">
        You will complete three cycles with the same set in a new order each time. A 20-puzzle set qualifies for the <strong className="text-fuchsia-100">Conquer the Woodpecker</strong> quest.
      </div>
    </div>
  );
}

function StarWarsDetails() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["1", "Plan first", "Map the complete route before you touch a piece."],
        ["2", "One move, one star", "Every successful move lands on exactly one remaining star."],
        ["3", "Protect the run", "Missing a star—or leaving no star reachable next—ends the run."]
      ].map(([step, title, description]) => (
        <div key={step} className="rounded-lg border border-violet-200/20 bg-violet-300/5 p-4">
          <span className="grid size-8 place-items-center rounded-full border border-violet-200/30 bg-violet-300/10 text-sm font-black text-violet-100">{step}</span>
          <p className="mt-3 font-black text-white">{title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
        </div>
      ))}
    </div>
  );
}

function HideAndSeekDetails() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["1", "Study the board", "The timer begins only when you reveal the scattered black pieces."],
        ["2", "Stamp safe squares", "Tap each empty square that no black piece can see. Pieces block sliding attacks."],
        ["3", "Choose your pace", "Play an open-ended Classic search or a 60-second Time Trial. Speed can earn up to 40% of your score."]
      ].map(([step, title, description]) => (
        <div key={step} className="rounded-lg border border-emerald-200/20 bg-emerald-300/5 p-4">
          <span className="grid size-8 place-items-center rounded-full border border-emerald-200/30 bg-emerald-300/10 text-sm font-black text-emerald-100">{step}</span>
          <p className="mt-3 font-black text-white">{title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
        </div>
      ))}
    </div>
  );
}

function ModeDetails({
  mode,
  selectedTheme,
  onThemeChange,
  selectedLevel,
  onLevelChange,
  woodpeckerSetSize,
  onWoodpeckerSetSizeChange
}: {
  mode: PuzzleModeChoice;
  selectedTheme: PuzzleThemeSlug;
  onThemeChange: (theme: PuzzleThemeSlug) => void;
  selectedLevel: PuzzleLevelSlug;
  onLevelChange: (level: PuzzleLevelSlug) => void;
  woodpeckerSetSize: number;
  onWoodpeckerSetSizeChange: (size: number) => void;
}) {
  if (mode === "survival") {
    return <SurvivalDetails selectedTheme={selectedTheme} onThemeChange={onThemeChange} />;
  }
  if (mode === "woodpecker") {
    return (
      <WoodpeckerDetails
        selectedTheme={selectedTheme}
        onThemeChange={onThemeChange}
        selectedLevel={selectedLevel}
        onLevelChange={onLevelChange}
        setSize={woodpeckerSetSize}
        onSetSizeChange={onWoodpeckerSetSizeChange}
      />
    );
  }
  if (mode === "starWars") return <StarWarsDetails />;
  if (mode === "hideAndSeek") return <HideAndSeekDetails />;
  if (mode === "daily") {
    return (
      <div className="rounded-lg border border-amber-300/25 bg-amber-300/[0.07] p-4">
        <p className="font-black text-amber-100">Today’s reward: 10 XP + 10 Academy Coins</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">You can replay the puzzle after claiming the reward, but the bonus is awarded only once per day.</p>
      </div>
    );
  }
  if (mode === "adaptiveReview") {
    return (
      <div className="rounded-lg border border-violet-300/25 bg-violet-300/[0.07] p-4">
        <p className="font-black text-violet-100">Personal puzzles from your games and Survival training</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">Due positions open immediately. If you are caught up, you will see when your next review becomes available.</p>
      </div>
    );
  }
  const unreachableMode: never = mode;
  return unreachableMode;
}

export function AutoAdvanceSwitch({
  checked,
  onChange,
  compact = false
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
}) {
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
  selectedTheme,
  onThemeChange,
  selectedLevel,
  onLevelChange,
  woodpeckerSetSize,
  onWoodpeckerSetSizeChange,
  autoAdvance,
  onAutoAdvanceChange,
  onStart,
  overview,
  statsContent
}: {
  selectedTheme: PuzzleThemeSlug;
  onThemeChange: (theme: PuzzleThemeSlug) => void;
  selectedLevel: PuzzleLevelSlug;
  onLevelChange: (level: PuzzleLevelSlug) => void;
  woodpeckerSetSize: number;
  onWoodpeckerSetSizeChange: (size: number) => void;
  autoAdvance: boolean;
  onAutoAdvanceChange: (enabled: boolean) => void;
  onStart: (mode: PuzzleModeChoice) => void;
  overview: PuzzleTrainingOverview;
  statsContent?: ReactNode;
}) {
  const [launcher, dispatch] = useReducer(puzzleLauncherReducer, initialPuzzleLauncherState);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const launcherButtonRef = useRef<HTMLButtonElement>(null);
  const modeButtonRefs = useRef(new Map<PuzzleModeChoice, HTMLButtonElement>());
  const lastSelectedMode = useRef<PuzzleModeChoice | null>(null);
  const hasOpened = useRef(false);
  const selectedMode = PUZZLE_MODE_OPTIONS.find((mode) => mode.id === launcher.selectedMode) ?? null;

  useEffect(() => {
    if (!launcher.open) {
      if (hasOpened.current) launcherButtonRef.current?.focus();
      return;
    }

    hasOpened.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [launcher.open]);

  useEffect(() => {
    if (!launcher.open) return;
    const frame = window.requestAnimationFrame(() => {
      if (launcher.screen === "choices" && lastSelectedMode.current) {
        modeButtonRefs.current.get(lastSelectedMode.current)?.focus();
      } else {
        headingRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [launcher.open, launcher.screen]);

  function showChoices() {
    dispatch({ type: "OPEN_CHOICES" });
  }

  function showStats() {
    lastSelectedMode.current = null;
    dispatch({ type: "OPEN_STATS" });
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      dispatch(puzzleLauncherDismissAction(launcher.screen));
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeIndex = Array.from(focusable).indexOf(document.activeElement as HTMLElement);
    if (activeIndex === -1) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      {!launcher.open ? (
        <Card className="overflow-hidden border-cyan-200/20">
          <div className="bg-gradient-to-r from-cyan-300/10 via-slate-950 to-amber-300/10 p-5 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Puzzle Training</p>
            <h2 className="mt-2 text-3xl font-black text-white">What do you want to train?</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Choose a focused mode or open your stats. Nothing else competes for attention until you are ready.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                ref={launcherButtonRef}
                type="button"
                onClick={showChoices}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md border border-amber-300/60 bg-amber-300 px-5 py-3 text-base font-black text-slate-950 shadow-gold transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                Choose Puzzle Mode
              </button>
              <Button type="button" variant="secondary" onClick={showStats} className="min-h-12 flex-1 text-base">View My Stats</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {launcher.open ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/88 p-3 backdrop-blur-md sm:p-6">
          <div className="flex min-h-full items-center justify-center">
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="puzzle-training-dialog-title"
              aria-describedby="puzzle-training-dialog-description"
              tabIndex={-1}
              onKeyDown={handleDialogKeyDown}
              className="w-full max-w-6xl"
            >
              <Card className="max-h-[calc(100vh-1.5rem)] overflow-hidden border-cyan-200/25 bg-slate-950/95 shadow-[0_24px_100px_rgba(0,0,0,0.72)] sm:max-h-[calc(100vh-3rem)]">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-cyan-300/10 via-slate-950 to-amber-300/10 px-4 py-4 sm:px-6 sm:py-5">
                  <div className="min-w-0">
                    {launcher.screen !== "choices" ? (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "BACK" })}
                        className="mb-2 text-xs font-black uppercase tracking-wide text-cyan-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                      >
                        ← Back to modes
                      </button>
                    ) : <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Academy Puzzle Training</p>}
                    <h2
                      ref={headingRef}
                      id="puzzle-training-dialog-title"
                      tabIndex={-1}
                      className="text-2xl font-black text-white outline-none sm:text-3xl"
                    >
                      {launcher.screen === "choices"
                        ? "Choose a puzzle mode"
                        : launcher.screen === "stats"
                          ? "Puzzle Training Stats"
                          : selectedMode?.name}
                    </h2>
                    <p id="puzzle-training-dialog-description" className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                      {launcher.screen === "choices"
                        ? "Pick one mode to see how it works and adjust only the settings it needs."
                        : launcher.screen === "stats"
                          ? "All of your recorded puzzle-training progress, plus the Survival leaderboard."
                          : selectedMode?.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={launcher.screen === "choices" ? "Close puzzle training window" : "Back to puzzle mode selector"}
                    onClick={() => dispatch(puzzleLauncherDismissAction(launcher.screen))}
                    className="grid size-10 shrink-0 place-items-center rounded-md border border-white/10 bg-white/5 text-xl font-black text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  >
                    ×
                  </button>
                </div>

                <div className="max-h-[calc(100vh-11rem)] overflow-y-auto p-4 sm:max-h-[calc(100vh-12rem)] sm:p-6">
                  {launcher.screen === "choices" ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Puzzle training modes">
                        {PUZZLE_MODE_OPTIONS.map((mode) => (
                          <button
                            key={mode.id}
                            ref={(node) => {
                              if (node) modeButtonRefs.current.set(mode.id, node);
                              else modeButtonRefs.current.delete(mode.id);
                            }}
                            type="button"
                            onClick={() => {
                              lastSelectedMode.current = mode.id;
                              dispatch({ type: "SELECT_MODE", mode: mode.id });
                            }}
                            className="group rounded-xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-cyan-300/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 sm:p-5"
                          >
                            <span className="flex items-start justify-between gap-3">
                              <span className="grid size-10 place-items-center rounded-lg border border-cyan-200/20 bg-cyan-300/10 text-xl font-black text-cyan-100">{mode.icon}</span>
                              <span className="text-lg text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-100" aria-hidden="true">→</span>
                            </span>
                            <span className="mt-4 block text-lg font-black text-white">{mode.name}</span>
                            <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-amber-100">{mode.summary}</span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-4 sm:flex-row">
                        <p className="text-sm text-slate-400">More modes can be added here without making the page longer.</p>
                        <Button type="button" variant="secondary" onClick={showStats}>View My Stats</Button>
                      </div>
                    </>
                  ) : launcher.screen === "stats" ? (
                    <PuzzleTrainingStats overview={overview} leaderboard={statsContent} />
                  ) : selectedMode ? (
                    <div className="space-y-5">
                      <ModeDetails
                        mode={selectedMode.id}
                        selectedTheme={selectedTheme}
                        onThemeChange={onThemeChange}
                        selectedLevel={selectedLevel}
                        onLevelChange={onLevelChange}
                        woodpeckerSetSize={woodpeckerSetSize}
                        onWoodpeckerSetSizeChange={onWoodpeckerSetSizeChange}
                      />
                      {(selectedMode.id === "survival" || selectedMode.id === "woodpecker") ? (
                        <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
                          <AutoAdvanceSwitch checked={autoAdvance} onChange={onAutoAdvanceChange} />
                        </div>
                      ) : null}
                      <div className="border-t border-white/10 pt-5">
                        <Button
                          type="button"
                          onClick={() => onStart(selectedMode.id)}
                          className="min-h-14 w-full px-8 text-base sm:text-lg"
                        >
                          {selectedMode.startLabel}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
