import Link from "next/link";
import type { ReactNode } from "react";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { BadgeCard } from "@/components/BadgeCard";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StudentActivityTimeline } from "@/components/StudentActivityTimeline";
import {
  ProgressDialogTrigger,
  StudentJourneyDashboardClient,
  type ProgressTab
} from "@/components/student/StudentJourneyDashboardClient";
import type { StudentDashboardData } from "@/lib/student/dashboard";
import { getDailyChessQuote } from "@/lib/student/dailyChessQuote";
import { puzzleThemeOptions, type PuzzleThemeSlug } from "@/lib/puzzle-training/types";

type DestinationKind = "training" | "play" | "quests" | "avatar";

const destinationStyles: Record<DestinationKind, { frame: string; icon: string }> = {
  training: {
    frame: "border-cyan-300/25 bg-gradient-to-br from-cyan-950 via-slate-950 to-slate-950 hover:border-cyan-200/55 hover:shadow-[0_18px_52px_rgba(34,211,238,0.14)]",
    icon: "border-cyan-200/35 bg-cyan-950 text-cyan-100"
  },
  play: {
    frame: "border-amber-300/25 bg-gradient-to-br from-amber-950 via-slate-950 to-slate-950 hover:border-amber-200/55 hover:shadow-[0_18px_52px_rgba(251,191,36,0.14)]",
    icon: "border-amber-200/35 bg-amber-950 text-amber-100"
  },
  quests: {
    frame: "border-fuchsia-300/25 bg-gradient-to-br from-fuchsia-950 via-slate-950 to-slate-950 hover:border-fuchsia-200/55 hover:shadow-[0_18px_52px_rgba(232,121,249,0.14)]",
    icon: "border-fuchsia-200/35 bg-fuchsia-950 text-fuchsia-100"
  },
  avatar: {
    frame: "border-emerald-300/25 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-950 hover:border-emerald-200/55 hover:shadow-[0_18px_52px_rgba(52,211,153,0.14)]",
    icon: "border-emerald-200/35 bg-emerald-950 text-emerald-100"
  }
};

function formatDate(value: string | null) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  }).format(date);
}

function formatTheme(theme: PuzzleThemeSlug) {
  return puzzleThemeOptions.find((option) => option.id === theme)?.name ?? "Mixed tactics";
}

function JourneyIcon({ kind }: { kind: DestinationKind }) {
  if (kind === "training") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8 fill-none stroke-current" strokeWidth="2.2">
        <path d="M16 3v5M16 24v5M3 16h5M24 16h5" />
        <circle cx="16" cy="16" r="8" />
        <circle cx="16" cy="16" r="2.5" />
      </svg>
    );
  }
  if (kind === "play") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8 fill-none stroke-current" strokeWidth="2.2">
        <path d="m12 7 12 9-12 9V7Z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "quests") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8 fill-none stroke-current" strokeWidth="2.2">
        <path d="M16 3 27 7v8c0 7-4.6 11.4-11 14-6.4-2.6-11-7-11-14V7l11-4Z" strokeLinejoin="round" />
        <path d="m10.5 16 3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8 fill-none stroke-current" strokeWidth="2.2">
      <path d="M7 11h18l-1.5 17h-15L7 11Z" strokeLinejoin="round" />
      <path d="M11 12V9a5 5 0 0 1 10 0v3" strokeLinecap="round" />
      <path d="M12 19h8M16 15v8" strokeLinecap="round" />
    </svg>
  );
}

function JourneyDestination({
  kind,
  href,
  title,
  description,
  summary,
  detail
}: {
  kind: DestinationKind;
  href: string;
  title: string;
  description: string;
  summary: string;
  detail: string;
}) {
  const styles = destinationStyles[kind];

  return (
    <Link
      href={href}
      aria-label={`Open ${title}`}
      className={`group relative z-10 flex min-h-56 flex-col rounded-xl border p-5 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:p-6 ${styles.frame}`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl border shadow-glow ${styles.icon}`}>
          <JourneyIcon kind={kind} />
        </span>
        <span aria-hidden="true" className="text-2xl font-black text-white/35 transition group-hover:translate-x-1 group-hover:text-white">→</span>
      </div>
      <h3 className="mt-5 text-2xl font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
      <div className="mt-auto pt-5">
        <p className="font-black text-white">{summary}</p>
        <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{detail}</p>
      </div>
    </Link>
  );
}

function StatTile({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p> : null}
    </div>
  );
}

function UnavailableNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div role="status" className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-4">
      <p className="font-black text-amber-100">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{detail}</p>
    </div>
  );
}

function ProgressBar({ progress }: { progress: StudentDashboardData["progress"] }) {
  const nextLevel = progress.level + 1;
  const valueText = progress.isMaxLevel
    ? "Maximum Academy level reached"
    : `${progress.percent}% of the way to Level ${nextLevel}`;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
        <span>{progress.lifetimeXp.toLocaleString()} lifetime XP</span>
        <span>{progress.isMaxLevel ? "Max level" : `${progress.neededXp.toLocaleString()} XP to Level ${nextLevel}`}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Academy level progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-valuetext={valueText}
        className="mt-2 h-3 overflow-hidden rounded-full border border-white/10 bg-slate-950"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-amber-200 to-fuchsia-300 transition-[width]"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {!progress.isMaxLevel ? (
        <p className="mt-2 text-xs text-slate-400">
          {progress.currentLevelXp.toLocaleString()} / {progress.nextLevelXp.toLocaleString()} XP in this level
        </p>
      ) : null}
    </div>
  );
}

function OverviewPanel({ data }: { data: StudentDashboardData }) {
  const walletUnavailable = data.unavailableSections.includes("avatar");
  const lichessUnavailable = data.unavailableSections.includes("lichess");

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Academy level" value={`Level ${data.progress.level}`} detail={data.progress.title} />
        <StatTile label="Lifetime XP" value={data.progress.lifetimeXp.toLocaleString()} detail="Counts toward levels and badges" />
        <StatTile
          label="Academy coins"
          value={walletUnavailable ? "Unavailable" : data.wallet.academyCoins.toLocaleString()}
          detail={walletUnavailable ? "Your wallet could not be loaded." : `${data.wallet.totalCoinsEarned.toLocaleString()} earned all time`}
        />
      </div>

      <section className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 sm:p-5" aria-labelledby="progress-level-heading">
        <h3 id="progress-level-heading" className="font-black text-white">Level progress</h3>
        <div className="mt-4"><ProgressBar progress={data.progress} /></div>
      </section>

      <section className="rounded-xl border border-white/10 bg-slate-950/55 p-4 sm:p-5" aria-labelledby="lichess-progress-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">Lichess</p>
            <h3 id="lichess-progress-heading" className="mt-1 text-xl font-black text-white">
              {lichessUnavailable ? "Temporarily unavailable" : data.lichess ? data.lichess.username : "Not connected"}
            </h3>
          </div>
          {data.lichess ? (
            <a
              href={data.lichess.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              Open Lichess profile
            </a>
          ) : null}
        </div>
        {lichessUnavailable ? (
          <p className="mt-3 text-sm text-slate-300">Your saved connection and ratings could not be loaded. Other dashboard features are still ready.</p>
        ) : data.lichess ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {data.lichess.ratings.map((rating) => (
                <div key={rating.key} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs font-black uppercase text-slate-400">{rating.label}</p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {rating.rating?.toLocaleString() ?? "—"}
                    {rating.provisional ? <span className="ml-1 text-sm text-slate-400">?</span> : null}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {rating.games.toLocaleString()} games
                    {rating.ratingChange !== null ? (
                      <span className={rating.ratingChange >= 0 ? "ml-2 text-emerald-200" : "ml-2 text-rose-200"}>
                        {rating.ratingChange >= 0 ? "+" : ""}{rating.ratingChange}
                      </span>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">{data.lichess.syncStatus} · Last synced {formatDate(data.lichess.lastSyncedAt)}</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-300">Connect a Lichess account to bring ratings and Academy activity into one place.</p>
        )}
      </section>
    </div>
  );
}

function TrainingPanel({ data }: { data: StudentDashboardData }) {
  if (data.unavailableSections.includes("training")) {
    return (
      <UnavailableNotice
        title="Training stats are temporarily unavailable."
        detail="Puzzle Training is still open and ready to use. Your recorded stats will return when the progress service reconnects."
      />
    );
  }

  const training = data.training;
  const hasWoodpeckerHistory = training.woodpecker.recentCycles.length > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Overall accuracy" value={`${training.overall.accuracy}%`} detail={`${training.overall.solved.toLocaleString()} of ${training.overall.attempts.toLocaleString()} solved`} />
        <StatTile label="Daily puzzles" value={training.daily.completed.toLocaleString()} detail="Completed rewards" />
        <StatTile label="Daily XP" value={training.daily.xpEarned.toLocaleString()} detail={`${training.daily.coinsEarned.toLocaleString()} coins earned`} />
        <StatTile label="Woodpecker sets" value={training.woodpecker.completedSets.toLocaleString()} detail={`${training.woodpecker.completedCycles.toLocaleString()} cycles complete`} />
      </div>

      <section className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 sm:p-5" aria-labelledby="survival-records-heading">
        <h3 id="survival-records-heading" className="text-lg font-black text-white">Survival records</h3>
        <p className="mt-1 text-sm text-slate-400">Mixed tactics and every recorded theme.</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatTile label="All time" value={training.survival.allTimeScore} />
          <StatTile label="Monthly" value={training.survival.monthScore} />
          <StatTile label="Weekly" value={training.survival.weekScore} />
        </div>
        {training.survivalByTheme.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-black/25 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-black">Theme</th>
                  <th className="px-3 py-2 text-right font-black">Weekly</th>
                  <th className="px-3 py-2 text-right font-black">Monthly</th>
                  <th className="px-3 py-2 text-right font-black">All time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {training.survivalByTheme.map((record) => (
                  <tr key={record.theme}>
                    <th scope="row" className="px-3 py-2 font-bold text-white">{formatTheme(record.theme)}</th>
                    <td className="px-3 py-2 text-right text-slate-300">{record.weekScore}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{record.monthScore}</td>
                    <td className="px-3 py-2 text-right font-black text-amber-100">{record.allTimeScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/[0.06] p-4 sm:p-5" aria-labelledby="woodpecker-history-heading">
        <h3 id="woodpecker-history-heading" className="text-lg font-black text-white">Woodpecker history</h3>
        {hasWoodpeckerHistory ? (
          <div className="mt-4 space-y-2">
            {training.woodpecker.recentCycles.map((cycle, index) => (
              <div key={`${cycle.completedAt}-${cycle.cycleNumber ?? index}`} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-white">{cycle.cycleNumber ? `Cycle ${cycle.cycleNumber}` : "Completed cycle"} · {formatTheme(cycle.theme)}</p>
                  <p className="mt-1 text-xs text-slate-400">{cycle.setSize} puzzles · {formatDate(cycle.completedAt)}</p>
                </div>
                <div className="flex gap-2 text-xs font-black">
                  <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-cyan-100">{cycle.puzzlesPerMinute.toFixed(1)} PPM</span>
                  <span className="rounded-md border border-fuchsia-300/25 bg-fuchsia-300/10 px-2 py-1 text-fuchsia-100">{cycle.accuracy}% accuracy</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-300">Finish a Woodpecker cycle to start your history.</p>
        )}
      </section>
    </div>
  );
}

function AchievementsPanel({ data }: { data: StudentDashboardData }) {
  const questsUnavailable = data.unavailableSections.includes("quests");
  const badgesUnavailable = data.unavailableSections.includes("badges");

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Badges earned" value={badgesUnavailable ? "Unavailable" : data.badges.length.toLocaleString()} />
        <StatTile label="Active quests" value={questsUnavailable ? "Unavailable" : data.quests.activeCount.toLocaleString()} />
        <StatTile label="Completed quests" value={questsUnavailable ? "Unavailable" : data.quests.completedCount.toLocaleString()} />
      </div>

      <section aria-labelledby="earned-badges-heading">
        <div>
          <h3 id="earned-badges-heading" className="text-lg font-black text-white">Earned badges</h3>
          <p className="mt-1 text-sm text-slate-400">Your Academy accomplishments so far.</p>
        </div>
        {badgesUnavailable ? (
          <div className="mt-4">
            <UnavailableNotice title="Badges are temporarily unavailable." detail="Your earned badges are safe and will return when the achievement service reconnects." />
          </div>
        ) : data.badges.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.badges.map((badge) => <BadgeCard key={badge.id} badge={badge} earned compact statusText="Earned" />)}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-300">Your first earned badge will appear here.</p>
        )}
      </section>
    </div>
  );
}

export function StudentJourneyDashboard({ data }: { data: StudentDashboardData }) {
  const latestWoodpecker = data.training.latestWoodpeckerCycle;
  const expiringQuest = data.quests.soonestExpiring;
  const dailyChessQuote = getDailyChessQuote();
  const progressPanels: Record<ProgressTab, ReactNode> = {
    overview: <OverviewPanel data={data} />,
    training: <TrainingPanel data={data} />,
    achievements: <AchievementsPanel data={data} />,
    activity: data.unavailableSections.includes("activity") ? (
      <UnavailableNotice
        title="Activity is temporarily unavailable."
        detail="Recent XP, coin, game, puzzle, quest, and badge updates could not be loaded."
      />
    ) : (
      <StudentActivityTimeline items={data.activity} emptyText="Your Academy activity will appear here." />
    )
  };

  return (
    <StudentJourneyDashboardClient
      panels={progressPanels}
      hasUnavailableSections={data.unavailableSections.length > 0}
    >
      <div className="space-y-5">
      <Card className="overflow-hidden border-cyan-200/20">
        <div className="bg-gradient-to-r from-cyan-300/10 via-slate-950/75 to-amber-300/10 p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="mx-auto shrink-0 lg:mx-0">
              {data.avatar ? (
                <AvatarRenderer items={data.avatar.items} avatar={data.avatar.config} size="lg" label={`${data.student.name}'s Academy avatar`} />
              ) : (
                <div role="img" aria-label="Academy avatar unavailable" className="grid h-40 w-40 place-items-center rounded-lg border border-cyan-200/25 bg-slate-950 text-6xl text-cyan-100 shadow-glow">♞</div>
              )}
            </div>

            <div className="min-w-0 flex-1 text-center lg:text-left">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Academy student</p>
              <h2 className="mt-1 truncate text-3xl font-black text-white">{data.student.name}</h2>
              <p className="mt-1 text-sm font-bold text-slate-400">{data.student.classGroup || "The Chess Academy"}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 lg:justify-start">
                <span className="rounded-md border border-amber-300/35 bg-amber-300/10 px-2.5 py-1 text-xs font-black text-amber-100">Level {data.progress.level}</span>
                <span className="rounded-md border border-cyan-300/35 bg-cyan-300/10 px-2.5 py-1 text-xs font-black text-cyan-100">{data.progress.title}</span>
                <span className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-black text-slate-200">
                  {data.unavailableSections.includes("avatar") ? "Coins unavailable" : `${data.wallet.academyCoins.toLocaleString()} coins`}
                </span>
              </div>
            </div>

            <div className="w-full lg:max-w-md">
              <ProgressBar progress={data.progress} />
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <ProgressDialogTrigger tab="overview" className="flex-1">View Progress</ProgressDialogTrigger>
                <Button href="/student/avatar" variant="secondary" className="flex-1">Avatar &amp; Store</Button>
              </div>
            </div>
          </div>

          <blockquote className="mt-5 rounded-lg border border-amber-300/20 bg-amber-950 px-4 py-3 text-sm leading-6 text-amber-50">
            <span className="mr-2 font-black text-amber-200">Daily chess inspiration:</span>
            <span>“{dailyChessQuote}”</span>
          </blockquote>
        </div>
      </Card>

      <section aria-labelledby="journey-map-heading">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Your open journey</p>
          <h2 id="journey-map-heading" className="mt-1 text-2xl font-black text-white">Choose any destination</h2>
          <p className="mt-1 text-sm text-slate-400">Every path is open. Train, play, quest, or customize your avatar in any order.</p>
        </div>

        <div className="relative">
          <span aria-hidden="true" className="absolute bottom-10 left-7 top-10 w-px bg-gradient-to-b from-cyan-300/60 via-fuchsia-300/50 to-emerald-300/60 md:hidden" />
          <svg aria-hidden="true" focusable="false" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 hidden h-full w-full md:block">
            <defs>
              <linearGradient id="journey-route-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgb(103 232 249)" stopOpacity="0.48" />
                <stop offset="50%" stopColor="rgb(232 121 249)" stopOpacity="0.42" />
                <stop offset="100%" stopColor="rgb(110 231 183)" stopOpacity="0.48" />
              </linearGradient>
            </defs>
            <path d="M25 25H75V75H25V25" fill="none" stroke="url(#journey-route-gradient)" strokeWidth="0.7" strokeDasharray="2 1.5" vectorEffect="non-scaling-stroke" />
          </svg>

          <div className="grid gap-4 md:auto-rows-fr md:grid-cols-2">
            <JourneyDestination
              kind="training"
              href="/student/training"
              title="Puzzle Training"
              description="Build tactical vision with Survival, Woodpecker, and focused puzzle modes."
              summary={data.unavailableSections.includes("training") ? "Training stats unavailable" : `Mixed Survival best: ${data.training.survival.allTimeScore}`}
              detail={data.unavailableSections.includes("training") ? "Puzzle Training is still open and ready to use." : latestWoodpecker ? `Latest Woodpecker: ${latestWoodpecker.puzzlesPerMinute.toFixed(1)} PPM · ${latestWoodpecker.accuracy}% accuracy` : "Your first Woodpecker cycle is ready when you are."}
            />
            <JourneyDestination
              kind="play"
              href="/student/play"
              title="Play"
              description="Put your ideas on the board in computer games and live student matches."
              summary="Computer and live games"
              detail="Choose an opponent, start a challenge, or return to a game."
            />
            <JourneyDestination
              kind="quests"
              href="/student/quests"
              title="Quests"
              description="Take on Academy challenges, collect rewards, and celebrate completed missions."
              summary={data.unavailableSections.includes("quests") ? "Quest progress unavailable" : `${data.quests.activeCount} active · ${data.quests.completedCount} completed`}
              detail={data.unavailableSections.includes("quests") ? "The Quest Board is still open and ready to use." : expiringQuest ? `${expiringQuest.title} · ends ${formatDate(expiringQuest.expiresAt)}` : "New class quests will appear here when they are available."}
            />
            <JourneyDestination
              kind="avatar"
              href="/student/avatar"
              title="Avatar & Store"
              description="Create your Academy look and discover new items for your avatar."
              summary={data.unavailableSections.includes("avatar") ? "Store ready to explore" : `${data.wallet.academyCoins.toLocaleString()} coins available`}
              detail="Equip owned items or spend coins on something new."
            />
          </div>
        </div>
      </section>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Latest updates</p>
            <h2 className="mt-1 text-xl font-black text-white">Recent activity</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href="/student/play/history" variant="secondary">Game History</Button>
            <ProgressDialogTrigger tab="activity" variant="ghost">View all activity</ProgressDialogTrigger>
          </div>
        </div>
        {data.unavailableSections.includes("activity") ? (
          <UnavailableNotice title="Recent activity is temporarily unavailable." detail="The rest of your Academy Journey is ready to use." />
        ) : (
          <StudentActivityTimeline items={data.activity.slice(0, 3)} emptyText="Your latest Academy activity will appear here." />
        )}
      </Card>
      </div>
    </StudentJourneyDashboardClient>
  );
}
