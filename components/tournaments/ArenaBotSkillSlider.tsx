"use client";

import { useId } from "react";
import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import { ARENA_BOT_MAX_RATING, ARENA_BOT_MIN_RATING, ARENA_BOT_RATING_STEP, arenaBotDifficulty, arenaBotRatingId } from "@/chess/arena/bots";

export function ArenaBotSkillSlider({ label, difficultyId, disabled, onChange }: {
  label: string;
  difficultyId: string;
  disabled?: boolean;
  onChange: (difficultyId: string) => void;
}) {
  const id = useId();
  const difficulty = arenaBotDifficulty(difficultyId);
  const rating = difficulty?.estimatedRating ?? 575;
  return <div className="min-w-0 rounded-md border border-white/10 bg-slate-950/60 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs font-bold text-slate-200">{label}</label>
      <output htmlFor={id} className="rounded-md bg-cyan-300/15 px-2 py-1 text-sm font-black tabular-nums text-cyan-100">~{rating}</output>
    </div>
    <input id={id} type="range" min={ARENA_BOT_MIN_RATING} max={ARENA_BOT_MAX_RATING} step={ARENA_BOT_RATING_STEP}
      value={rating} disabled={disabled} aria-valuetext={`Approximately ${rating} rating`}
      aria-describedby={`${id}-hint`} onChange={(event) => onChange(arenaBotRatingId(Number(event.target.value)))}
      className="block h-11 w-full min-w-0 cursor-pointer accent-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:opacity-40" />
    <div className="flex justify-between text-xs text-slate-400"><span>Easier · {ARENA_BOT_MIN_RATING}</span><span>Harder · {ARENA_BOT_MAX_RATING}</span></div>
    <p id={`${id}-hint`} className="mt-2 text-xs text-slate-300">{difficultyId.startsWith("arena-") ? "Custom strength · 25-point steps" : `${difficulty?.name} · ${difficulty?.title}`}</p>
    <details className="mt-2 text-xs text-slate-300">
      <summary className="w-fit cursor-pointer rounded-sm py-1 focus-visible:outline focus-visible:outline-cyan-200">Choose a named preset</summary>
      <div className="mt-2 flex flex-wrap gap-2">{BOT_DIFFICULTIES.map((preset) => <button type="button" key={preset.id}
        disabled={disabled} aria-pressed={difficultyId === preset.id} onClick={() => onChange(preset.id)}
        className={`min-h-11 rounded-md border px-2 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 disabled:opacity-40 ${difficultyId === preset.id ? "border-cyan-200 bg-cyan-300/20 text-cyan-100" : "border-white/15 bg-white/5 hover:bg-white/10"}`}>
        {preset.name} · ~{preset.estimatedRating}
      </button>)}</div>
    </details>
  </div>;
}
