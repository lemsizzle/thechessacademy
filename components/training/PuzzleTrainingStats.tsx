"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { Card } from "@/components/Card";
import type {
  PuzzleTrainingOverview,
  SurvivalPersonalRecord,
  WoodpeckerCycleHistoryOverview,
  WoodpeckerSetOverview
} from "@/lib/puzzle-training/overview";
import {
  parseStoredStarWarsBestScore,
  STAR_WARS_BEST_SCORE_STORAGE_KEY
} from "@/lib/puzzle-training/starWarsProgress";
import { puzzleThemeOptions, type PuzzleThemeSlug } from "@/lib/puzzle-training/types";

const ACADEMY_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok"
});

const AdaptiveReviewStats = dynamic(
  () => import("@/chess/components/AdaptiveReviewTrainer").then((module) => module.AdaptiveReviewTrainer),
  {
    ssr: false,
    loading: () => <Card className="p-5 text-sm text-slate-300">Loading your mistake-review stats…</Card>
  }
);

function themeName(theme: PuzzleThemeSlug) {
  return theme === "mixed"
    ? "Mixed themes"
    : puzzleThemeOptions.find((option) => option.id === theme)?.name ?? "Mixed themes";
}

function formatDate(value: string | null) {
  if (!value) return "No record yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : ACADEMY_DATE_FORMATTER.format(date);
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function personalSurvivalRecords(overview: PuzzleTrainingOverview) {
  const records = new Map<PuzzleThemeSlug, SurvivalPersonalRecord>();
  records.set("mixed", { theme: "mixed", ...overview.survival });
  for (const record of overview.survivalByTheme) records.set(record.theme, record);
  return [...records.values()];
}

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function SurvivalRecords({ overview }: { overview: PuzzleTrainingOverview }) {
  const records = personalSurvivalRecords(overview);

  return (
    <Card className="overflow-hidden border-amber-300/20 bg-amber-300/[0.04]">
      <div className="border-b border-white/10 px-4 py-4 sm:px-5">
        <p className="text-xs font-black uppercase tracking-wide text-amber-200">Survival</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <h3 id="personal-survival-records-heading" className="text-xl font-black text-white">Personal records by theme</h3>
          <p className="text-xs text-slate-400">Best completed run</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm" aria-labelledby="personal-survival-records-heading">
          <thead className="bg-white/[0.025] text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-black sm:px-5">Theme</th>
              <th scope="col" className="px-4 py-3 text-right font-black">All time</th>
              <th scope="col" className="px-4 py-3 text-right font-black">30 days</th>
              <th scope="col" className="px-4 py-3 text-right font-black sm:px-5">7 days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {records.map((record) => (
              <tr key={record.theme} className="text-slate-200">
                <th scope="row" className="px-4 py-3 font-bold text-white sm:px-5">{themeName(record.theme)}</th>
                <td className="px-4 py-3 text-right font-black">{record.allTimeScore}</td>
                <td className="px-4 py-3 text-right font-black">{record.monthScore}</td>
                <td className="px-4 py-3 text-right font-black sm:px-5">{record.weekScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RecentWoodpeckerCycles({ cycles }: { cycles: WoodpeckerCycleHistoryOverview[] }) {
  return (
    <section aria-labelledby="woodpecker-cycle-history-heading" className="min-w-0 rounded-lg border border-white/10 bg-slate-950/35">
      <h4 id="woodpecker-cycle-history-heading" className="border-b border-white/10 px-4 py-3 text-sm font-black text-white">Recent cycles</h4>
      {cycles.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-black">Completed</th>
                <th scope="col" className="px-4 py-3 font-black">Cycle</th>
                <th scope="col" className="px-4 py-3 font-black">Theme</th>
                <th scope="col" className="px-4 py-3 text-right font-black">Set</th>
                <th scope="col" className="px-4 py-3 text-right font-black">PPM</th>
                <th scope="col" className="px-4 py-3 text-right font-black">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {cycles.map((cycle, index) => (
                <tr key={`${cycle.completedAt}-${cycle.cycleNumber ?? "legacy"}-${index}`} className="text-slate-300">
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(cycle.completedAt)}</td>
                  <td className="px-4 py-3 font-bold text-white">{cycle.cycleNumber ? `#${cycle.cycleNumber}` : "—"}</td>
                  <td className="px-4 py-3">{themeName(cycle.theme)}</td>
                  <td className="px-4 py-3 text-right">{cycle.setSize}</td>
                  <td className="px-4 py-3 text-right font-black text-white">{cycle.puzzlesPerMinute.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-black text-white">{cycle.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-5 text-sm leading-6 text-slate-400">Finish a Woodpecker cycle to start your speed and accuracy history.</p>
      )}
    </section>
  );
}

function RecentWoodpeckerSets({ sets }: { sets: WoodpeckerSetOverview[] }) {
  return (
    <section aria-labelledby="woodpecker-set-history-heading" className="min-w-0 rounded-lg border border-white/10 bg-slate-950/35">
      <h4 id="woodpecker-set-history-heading" className="border-b border-white/10 px-4 py-3 text-sm font-black text-white">Recent full sets</h4>
      {sets.length ? (
        <ul className="divide-y divide-white/10">
          {sets.map((set, index) => (
            <li key={`${set.completedAt}-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-bold text-white">{themeName(set.theme)}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(set.completedAt)}</p>
              </div>
              <p className="text-right font-black text-fuchsia-100">{set.setSize} puzzles × {set.cycleCount} cycles</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-sm leading-6 text-slate-400">Complete every cycle in a set to record it here.</p>
      )}
    </section>
  );
}

function WoodpeckerHistory({ overview }: { overview: PuzzleTrainingOverview }) {
  return (
    <Card className="border-fuchsia-300/20 bg-fuchsia-300/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-fuchsia-200">Woodpecker Method</p>
          <h3 className="mt-1 text-xl font-black text-white">Training history</h3>
        </div>
        <div className="flex gap-2 text-center">
          <div className="rounded-md border border-white/10 bg-slate-950/45 px-4 py-2">
            <p className="text-[10px] font-bold uppercase text-slate-500">Cycles</p>
            <p className="text-xl font-black text-white">{overview.woodpecker.completedCycles}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-slate-950/45 px-4 py-2">
            <p className="text-[10px] font-bold uppercase text-slate-500">Full sets</p>
            <p className="text-xl font-black text-white">{overview.woodpecker.completedSets}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.75fr)]">
        <RecentWoodpeckerCycles cycles={overview.woodpecker.recentCycles} />
        <RecentWoodpeckerSets sets={overview.woodpecker.recentSets} />
      </div>
    </Card>
  );
}

export function PuzzleTrainingStatsSummary({
  adaptiveReviewStats,
  leaderboard,
  overview,
  starWarsBestScore
}: {
  adaptiveReviewStats?: ReactNode;
  leaderboard?: ReactNode;
  overview: PuzzleTrainingOverview;
  starWarsBestScore: number;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-cyan-300/20 bg-cyan-300/[0.04] p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-wide text-cyan-100">All puzzle training</p>
          <h3 className="mt-1 text-xl font-black text-white">Overall progress</h3>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
            <StatTile label="Attempts" value={overview.overall.attempts} />
            <StatTile label="Solved" value={overview.overall.solved} />
            <StatTile label="Accuracy" value={`${overview.overall.accuracy}%`} />
            <StatTile label="Training time" value={formatDuration(overview.overall.elapsedSeconds)} />
          </div>
        </Card>

        <Card className="border-emerald-300/20 bg-emerald-300/[0.04] p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-100">Puzzle of the Day</p>
          <h3 className="mt-1 text-xl font-black text-white">Daily rewards</h3>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
            <StatTile label="Days completed" value={overview.daily.completed} />
            <StatTile label="XP earned" value={overview.daily.xpEarned} />
            <StatTile label="Coins earned" value={overview.daily.coinsEarned} />
            <StatTile label="Latest reward" value={formatDate(overview.daily.latestCompletedAt)} />
          </div>
        </Card>
      </div>

      <SurvivalRecords overview={overview} />
      <WoodpeckerHistory overview={overview} />

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.65fr)_minmax(0,1.35fr)]">
        <Card className="border-amber-300/20 bg-amber-300/[0.05] p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-wide text-amber-200">Star Wars</p>
          <h3 className="mt-1 text-xl font-black text-white">Best score</h3>
          <p className="mt-4 text-4xl font-black text-white">{starWarsBestScore}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">Saved on this browser, so it can differ on another device.</p>
        </Card>
        {adaptiveReviewStats}
      </div>

      {leaderboard ? (
        <section aria-labelledby="training-survival-leaderboard-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-cyan-100">Compare scores</p>
              <h3 id="training-survival-leaderboard-heading" className="mt-1 text-xl font-black text-white">Survival leaderboard</h3>
            </div>
            <p className="text-xs text-slate-500">Filter by time, class, and theme inside the board</p>
          </div>
          {leaderboard}
        </section>
      ) : null}
    </div>
  );
}

export function PuzzleTrainingStats({
  leaderboard,
  overview
}: {
  leaderboard?: ReactNode;
  overview: PuzzleTrainingOverview;
}) {
  const [starWarsBestScore, setStarWarsBestScore] = useState(0);

  useEffect(() => {
    try {
      setStarWarsBestScore(parseStoredStarWarsBestScore(window.localStorage.getItem(STAR_WARS_BEST_SCORE_STORAGE_KEY)));
    } catch {
      setStarWarsBestScore(0);
    }
  }, []);

  return (
    <PuzzleTrainingStatsSummary
      adaptiveReviewStats={<AdaptiveReviewStats summaryOnly />}
      leaderboard={leaderboard}
      overview={overview}
      starWarsBestScore={starWarsBestScore}
    />
  );
}
