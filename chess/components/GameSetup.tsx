"use client";

import { useState } from "react";
import { BotPortrait } from "@/chess/components/BotPortrait";
import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import { getBotUnlockRequirement, isBotUnlocked } from "@/chess/bots/progression";
import { resolvePlayerColor } from "@/chess/game/colors";
import { TIME_CONTROLS } from "@/chess/game/timeControls";
import type { BotDifficulty, ComputerGameConfig, PlayerColorChoice, TimeControl } from "@/chess/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

const colorChoices: Array<{ id: PlayerColorChoice; label: string; symbol: string }> = [
  { id: "white", label: "White", symbol: "♔" },
  { id: "black", label: "Black", symbol: "♚" },
  { id: "random", label: "Random", symbol: "◈" }
];

export function GameSetup({ unlockedBotIds, onStart }: { unlockedBotIds: string[]; onStart: (config: ComputerGameConfig) => void }) {
  const [bot, setBot] = useState<BotDifficulty>(BOT_DIFFICULTIES[0]);
  const [color, setColor] = useState<PlayerColorChoice>("white");
  const [timeControl, setTimeControl] = useState<TimeControl>(TIME_CONTROLS[0]);

  return (
    <div className="min-w-0">
      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Opponent</p>
            <h3 className="mt-0.5 text-lg font-black text-white">Choose a bot</h3>
          </div>
          <p className="text-xs font-bold text-slate-500">Win without takebacks to unlock the next bot.</p>
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          <fieldset>
            <legend className="sr-only">Opponent</legend>
            <div className="grid min-w-0 grid-cols-3 gap-2 sm:grid-cols-6">
              {BOT_DIFFICULTIES.map((difficulty) => {
                const locked = !isBotUnlocked(difficulty.id, unlockedBotIds);
                const requirement = getBotUnlockRequirement(difficulty.id);
                const descriptionId = `bot-${difficulty.id}-status`;
                return (
                  <button
                    key={difficulty.id}
                    type="button"
                    disabled={locked}
                    onClick={() => setBot(difficulty)}
                    aria-pressed={bot.id === difficulty.id}
                    aria-describedby={descriptionId}
                    className={`relative min-w-0 overflow-hidden rounded-xl border p-2 text-center transition active:scale-[.98] ${locked ? "cursor-not-allowed border-white/10 bg-slate-950 opacity-45" : bot.id === difficulty.id ? "border-amber-200/70 bg-amber-200/10 shadow-[0_0_22px_rgba(251,191,36,.12)]" : "border-white/10 bg-white/[.035] hover:border-cyan-200/30 hover:bg-white/[.06]"}`}
                  >
                    {locked ? <span aria-hidden="true" className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-full border border-white/10 bg-slate-950/90 text-[11px]">🔒</span> : null}
                    <BotPortrait src={difficulty.portrait} size="choice" selected={!locked && bot.id === difficulty.id} />
                    <span className="mt-1.5 block truncate text-xs font-black text-white sm:text-sm">{difficulty.name}</span>
                    <span className="block truncate text-[10px] font-bold text-slate-400 sm:text-xs">{difficulty.title}</span>
                    <span id={descriptionId} className="sr-only">{locked && requirement ? `Defeat ${requirement.botName} without takebacks to unlock.` : difficulty.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-3 rounded-lg border border-white/10 bg-white/[.035] px-3 py-2.5">
            <div className="min-w-0">
              <p className="font-black text-white">{bot.name} <span className="font-bold text-cyan-200">· {bot.title}</span></p>
              <p className="mt-0.5 text-xs text-slate-400">{bot.description}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)_auto] lg:items-end">
            <fieldset>
              <legend className="text-xs font-black uppercase tracking-wider text-slate-400">Play as</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {colorChoices.map((choice) => (
                  <button key={choice.id} type="button" onClick={() => setColor(choice.id)} aria-pressed={color === choice.id} className={`rounded-lg border px-2 py-2 text-center transition active:scale-[.98] ${color === choice.id ? "border-cyan-200/70 bg-cyan-200/10 text-white" : "border-white/10 bg-white/[.035] text-slate-300 hover:bg-white/[.07]"}`}>
                    <span className="text-base" aria-hidden="true">{choice.symbol}</span>
                    <span className="ml-1.5 text-xs font-black">{choice.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-black uppercase tracking-wider text-slate-400">Clock</legend>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {TIME_CONTROLS.map((control) => (
                  <button key={control.id} type="button" onClick={() => setTimeControl(control)} aria-pressed={timeControl.id === control.id} className={`rounded-lg border px-2 py-2 text-xs font-black transition active:scale-[.98] sm:text-sm ${timeControl.id === control.id ? "border-cyan-200/70 bg-cyan-200/10 text-white" : "border-white/10 bg-white/[.035] text-slate-300 hover:bg-white/[.07]"}`}>
                    {control.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <Button type="button" className="w-full shrink-0 px-6 lg:w-auto" onClick={() => onStart({ bot, humanColor: resolvePlayerColor(color), timeControl })}>Start vs {bot.name}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
