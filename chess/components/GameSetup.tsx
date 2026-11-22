"use client";

import { useState } from "react";
import { BotPortrait } from "@/chess/components/BotPortrait";
import { STANDARD_BOT_DIFFICULTIES as BOT_DIFFICULTIES, personalizedSeasonalBots } from "@/chess/bots/difficulties";
import type { SeasonalReductions } from "@/chess/bots/halloweenAdaptation";
import { SEASONAL_BOT_HUNTS, seasonalQuestState, seasonalBotsVisible } from "@/lib/quests/seasonalBotHunts";
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

export function GameSetup({ unlockedBotIds, onStart, seasonalReductions = {} }: { unlockedBotIds: string[]; onStart: (config: ComputerGameConfig) => void; seasonalReductions?: SeasonalReductions | null }) {
  const [selectedBot, setBot] = useState<BotDifficulty>(BOT_DIFFICULTIES[0]);
  const seasonalBots = personalizedSeasonalBots(seasonalReductions ?? {});
  const bot = seasonalBots.find((candidate) => candidate.id === selectedBot.id) ?? selectedBot;
  const [color, setColor] = useState<PlayerColorChoice>("white");
  const [timeControl, setTimeControl] = useState<TimeControl>(TIME_CONTROLS[0]);

  const startGame = () => onStart({ bot, humanColor: resolvePlayerColor(color), timeControl });
  return <section aria-label="Choose a bot" className="min-w-0 space-y-4">
    <div className="sticky top-16 z-10 rounded-xl border border-cyan-200/25 bg-slate-950 p-3 shadow-lg sm:p-4">
      <div className="flex items-center gap-3">
        <BotPortrait src={bot.portrait} selected />
        <div className="min-w-0 flex-1"><p className="truncate font-black text-white">{bot.name}</p><p className="text-xs text-slate-400">{colorChoices.find(choice => choice.id === color)?.label} · {timeControl.name}</p></div>
        <Button type="button" onClick={startGame} className="shrink-0">Start vs {bot.name}</Button>
      </div>
      <details className="mt-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-bold text-cyan-200">Game settings</summary>
        <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
          <label className="text-xs font-bold text-slate-300">Play as<select aria-label="Play as" value={color} onChange={event => setColor(event.target.value as PlayerColorChoice)} className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-slate-900 px-2 text-sm text-white">{colorChoices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-300">Clock<select aria-label="Clock" value={timeControl.id} onChange={event => setTimeControl(TIME_CONTROLS.find(control => control.id === event.target.value)!)} className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-slate-900 px-2 text-sm text-white">{TIME_CONTROLS.map(control => <option key={control.id} value={control.id}>{control.name}</option>)}</select></label>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">{bot.description}</p>
      </details>
    </div>
    <Card className="p-3 sm:p-4">
      <h2 className="mb-3 font-black text-white">Choose your opponent</h2>
      <fieldset>
        <legend className="sr-only">Regular bots</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{BOT_DIFFICULTIES.map(difficulty => {
          const locked = !isBotUnlocked(difficulty.id, unlockedBotIds), requirement = getBotUnlockRequirement(difficulty.id);
          return <button key={difficulty.id} type="button" disabled={locked} onClick={() => setBot(difficulty)} aria-pressed={bot.id === difficulty.id} aria-describedby={`bot-${difficulty.id}-status`}
            className={`min-w-0 rounded-xl border p-2 text-center transition-colors focus-visible:outline focus-visible:outline-cyan-200 ${locked ? "border-white/10 opacity-45" : bot.id === difficulty.id ? "border-cyan-200 bg-cyan-200/10" : "border-white/10 hover:bg-white/5"}`}>
            <BotPortrait src={difficulty.portrait} size="choice" selected={bot.id === difficulty.id} />
            <span className="mt-2 block text-xs font-black text-white">{locked && <span aria-hidden="true">🔒 </span>}{difficulty.name}</span>
            <span className="block text-[10px] text-slate-400">{difficulty.title}</span>
            <span id={`bot-${difficulty.id}-status`} className="sr-only">{locked && requirement ? `Defeat ${requirement.botName} without takebacks to unlock.` : difficulty.description}</span>
          </button>;
        })}</div>
      </fieldset>
      <p className="mt-3 text-xs text-slate-400">Win without takebacks to unlock the next bot.</p>
    </Card>
    {[...SEASONAL_BOT_HUNTS].reverse().filter(hunt => seasonalBotsVisible(hunt)).map(hunt => <Card key={hunt.id} className="border-orange-300/20 p-3 sm:p-4">
      <h2 className="mb-3 font-black text-orange-100">{hunt.label} visitors</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{seasonalBots.filter(candidate => hunt.bots.some(entry => entry.id === candidate.id)).map(difficulty =>
        <button key={difficulty.id} type="button" onClick={() => setBot(difficulty)} aria-pressed={bot.id === difficulty.id} className={`min-w-0 rounded-xl border p-2 text-center transition-colors focus-visible:outline focus-visible:outline-orange-200 ${bot.id === difficulty.id ? "border-orange-200 bg-orange-300/10" : "border-white/10 hover:bg-white/5"}`}>
          <BotPortrait src={difficulty.portrait} size="choice" selected={bot.id === difficulty.id} />
          <span className="mt-2 block text-xs font-black text-white">{difficulty.name}</span>
          {(seasonalReductions?.[difficulty.id] ?? 0) > 0 && <span className="block text-[10px] text-orange-100">Adjusted for you</span>}
        </button>)}</div>
      <details className="mt-2 text-xs text-slate-300">
        <summary className="min-h-11 cursor-pointer py-3 font-bold text-orange-200">{hunt.label} quest · {hunt.reward} XP + {hunt.reward} coins</summary>
        <p>{seasonalQuestState(hunt, false) === "active" ? <>Beat all {hunt.bots.length} without hints or takebacks. Already active for everyone! {hunt.badge && <>Earn the {hunt.badge.name} badge.</>}</> : <>The seasonal quest has ended.</>} Finish by {hunt.deadlineLabel}.</p>
        <p className="mt-2 leading-relaxed">After a qualifying checkmate loss, that bot gets a little easier just for you. Play at least 12 of your own moves over 2 minutes, using several pieces, without hints or takebacks. Quick losses, resignations, timeouts, and replaying the same game do not count. Up to two reductions per bot per Bangkok day, 200 points total, until this hunt’s deadline. Wins at your adjusted level still count.</p>
      </details>
      {seasonalReductions === null && <p role="status" className="text-xs text-amber-200">Your adjusted levels could not be loaded. Showing starting levels; reload to try again.</p>}
    </Card>)}
  </section>;
}