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
          <span className="block text-slate-500">
            Rapid {xp.rapidGamesAfterLogin} played/{xp.rapidWinsAfterLogin} won, Blitz {xp.blitzGamesAfterLogin} played/{xp.blitzWinsAfterLogin} won, {xp.puzzleCorrectAfterLogin} puzzles correct after first login
          </span>
        </p>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Activity XP: rapid games +{LICHESS_XP_RULES.rapidGamePlayedXp}, rapid wins total +{LICHESS_XP_RULES.rapidGameWonXp}, blitz games +{LICHESS_XP_RULES.blitzGamePlayedXp}, blitz wins total +{LICHESS_XP_RULES.blitzGameWonXp}, puzzle correct +{LICHESS_XP_RULES.puzzleCorrectXp}. Rating milestones still count after first login.
      </p>
    </div>
  );
}
