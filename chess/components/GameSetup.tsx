"use client";

import { useState } from "react";
import { BOT_DIFFICULTIES, TIME_CONTROLS, resolvePlayerColor } from "@/chess/game/config";
import type { BotDifficulty, ComputerGameConfig, PlayerColorChoice, TimeControl } from "@/chess/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

const colorChoices: Array<{ id: PlayerColorChoice; label: string; symbol: string }> = [
  { id: "white", label: "White", symbol: "♔" },
  { id: "black", label: "Black", symbol: "♚" },
  { id: "random", label: "Random", symbol: "◈" }
];

const botSymbols: Record<string, string> = {
  pawny: "♙",
  knight: "♘",
  bishop: "♗",
  rook: "♖",
  queen: "♕",
  "so-pawny": "♚"
};

export function GameSetup({ onStart }: { onStart: (config: ComputerGameConfig) => void }) {
  const [bot, setBot] = useState<BotDifficulty>(BOT_DIFFICULTIES[0]);
  const [color, setColor] = useState<PlayerColorChoice>("white");
  const [timeControl, setTimeControl] = useState<TimeControl>(TIME_CONTROLS[0]);

  return (
    <div className="min-w-0 space-y-6">
      <Card className="min-w-0 overflow-hidden">
        <div className="border-b border-white/10 bg-gradient-to-r from-cyan-300/10 via-transparent to-amber-300/10 p-4 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">Vs Computer</p>
          <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Choose your academy opponent</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Pick a rival, choose your side, and set the clock. You can change everything before each new game.</p>
        </div>
        <div className="min-w-0 p-4 sm:p-6">
          <fieldset>
            <legend className="text-sm font-black uppercase tracking-wider text-slate-300">Opponent</legend>
            <div className="mt-3 grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
              {BOT_DIFFICULTIES.map((difficulty) => (
                <button key={difficulty.id} type="button" onClick={() => setBot(difficulty)} aria-pressed={bot.id === difficulty.id} className={`h-full min-h-36 min-w-0 rounded-lg border p-3 text-left transition active:scale-[.99] sm:min-h-44 sm:p-4 ${bot.id === difficulty.id ? "border-amber-300 bg-amber-300/12 shadow-gold" : "border-white/10 bg-slate-950/60 hover:border-cyan-200/35 hover:bg-cyan-300/5"}`}>
                  <span className="text-2xl sm:text-3xl" aria-hidden="true">{botSymbols[difficulty.id] ?? "♟"}</span>
                  <span className="mt-2 block text-base font-black text-white sm:text-lg">{difficulty.name}</span>
                  <span className="block break-words text-[11px] font-bold uppercase leading-4 text-cyan-200 sm:text-xs sm:leading-5">{difficulty.title} · ~{difficulty.estimatedRating}</span>
                  <span className="mt-2 hidden text-pretty text-xs leading-5 text-slate-400 sm:block">{difficulty.description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            <fieldset>
              <legend className="text-sm font-black uppercase tracking-wider text-slate-300">Play as</legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {colorChoices.map((choice) => (
                  <button key={choice.id} type="button" onClick={() => setColor(choice.id)} aria-pressed={color === choice.id} className={`rounded-lg border p-3 text-center transition active:scale-[.98] ${color === choice.id ? "border-cyan-200 bg-cyan-300/12 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                    <span className="block text-2xl" aria-hidden="true">{choice.symbol}</span>
                    <span className="mt-1 block text-sm font-black">{choice.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-black uppercase tracking-wider text-slate-300">Time control</legend>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                {TIME_CONTROLS.map((control) => (
                  <button key={control.id} type="button" onClick={() => setTimeControl(control)} aria-pressed={timeControl.id === control.id} className={`rounded-lg border px-3 py-4 text-sm font-black transition active:scale-[.98] ${timeControl.id === control.id ? "border-cyan-200 bg-cyan-300/12 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                    {control.name}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mt-7 flex min-w-0 flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-words font-black text-white">{bot.name} · {color === "random" ? "Random color" : color} · {timeControl.name}</p>
              <p className="mt-1 text-xs text-slate-400">The computer runs entirely in your browser. The first load may take a moment.</p>
            </div>
            <Button type="button" className="w-full shrink-0 px-6 py-3 sm:w-auto" onClick={() => onStart({ bot, humanColor: resolvePlayerColor(color), timeControl })}>Start Game</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
