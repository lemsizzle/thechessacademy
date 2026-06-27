import { getLichessXpBreakdown, LICHESS_XP_RULES } from "@/lib/lichessXp";
import type { StudentLichessAccount } from "@/lib/types";

export function LichessXpSummary({ account }: { account?: StudentLichessAccount }) {
  const xp = getLichessXpBreakdown(account);

  return (
    <div className="rounded-md border border-cyan-300/15 bg-cyan-300/[0.06] p-3">
      <p className="text-xs font-black uppercase text-cyan-100">Lichess XP Breakdown</p>
      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
        <p className="text-slate-300">
          Rating milestones: <span className="font-bold text-white">{xp.ratingXp} XP</span>
          <span className="block text-slate-500">Blitz {xp.blitzRatingXp} + Rapid {xp.rapidRatingXp} + Puzzle {xp.puzzleRatingXp}</span>
        </p>
        <p className="text-slate-300">
          New activity: <span className="font-bold text-white">{xp.activityXp} XP</span>
          <span className="block text-slate-500">{xp.ratedGamesAfterLogin} rated games + {xp.puzzlesAfterLogin} puzzles after first login</span>
        </p>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Every {LICHESS_XP_RULES.ratingStep} rating above {LICHESS_XP_RULES.ratingFloor} earns {LICHESS_XP_RULES.competitiveRatingXpPerStep} XP in established Blitz/Rapid or {LICHESS_XP_RULES.puzzleRatingXpPerStep} XP in Puzzle. Highest earned rating is kept.
      </p>
    </div>
  );
}
