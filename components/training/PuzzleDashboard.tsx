import Link from "next/link";
import { Card } from "@/components/Card";
import { dashboardHref, MIN_THEME_SAMPLE, puzzleDuration, puzzleReplayHref, puzzleTagName, type DashboardQuery, type DashboardSkill, type DashboardView, type PuzzleDashboardData } from "@/lib/puzzle-training/dashboard";
import { puzzleThemeOptions } from "@/lib/puzzle-training/types";

const linkButton = "inline-flex min-h-11 items-center justify-center rounded-lg border border-cyan-200/30 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200";
const historyDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const navItems: { id: DashboardView; label: string; icon: string }[] = [
  { id: "overview", label: "Dashboard", icon: "◈" },
  { id: "improve", label: "Improve next", icon: "↗" },
  { id: "strengths", label: "Your strengths", icon: "★" },
  { id: "themes", label: "Puzzle themes", icon: "✦" },
  { id: "openings", label: "By opening", icon: "♟" },
  { id: "history", label: "Puzzle history", icon: "◷" },
  { id: "replay", label: "Replay mistakes", icon: "↺" }
];

function SkillRadar({ skills }: { skills: DashboardSkill[] }) {
  const axes = skills.filter((skill) => skill.played >= MIN_THEME_SAMPLE).slice(0, 8);
  if (axes.length < 3) return <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-cyan-200/20 p-8 text-center"><span aria-hidden="true" className="text-5xl text-cyan-200/60">✦</span><p className="mt-4 font-bold text-white">Your skill map is growing</p><p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">Try at least 5 puzzles in 3 different themes to draw your map. Your results are already listed below.</p></div>;
  const point = (index: number, scale: number) => {
    const angle = index * Math.PI * 2 / axes.length - Math.PI / 2;
    return [260 + Math.cos(angle) * 145 * scale, 210 + Math.sin(angle) * 145 * scale];
  };
  const points = (scale: number) => axes.map((_, index) => point(index, scale).join(",")).join(" ");
  return <svg viewBox="0 0 520 430" className="mx-auto w-full max-w-[540px]" role="img" aria-labelledby="puzzle-radar-title puzzle-radar-description">
    <title id="puzzle-radar-title">Your puzzle skill map</title>
    <desc id="puzzle-radar-description">Clean-solve percentages. {axes.map((axis) => `${axis.name}: ${axis.accuracy}% from ${axis.played} attempts`).join(". ")}. The same results are available in the theme list.</desc>
    {[0.25, 0.5, 0.75, 1].map((scale) => <polygon key={scale} points={points(scale)} fill="none" stroke="#334155" strokeWidth="1" />)}
    {axes.map((axis, index) => {
      const [x, y] = point(index, 1);
      const [lx, ly] = point(index, 1.15);
      return <g key={axis.id}>
        <line x1="260" y1="210" x2={x} y2={y} stroke="#334155" />
        <text x={lx} y={ly} textAnchor={lx < 250 ? "end" : lx > 270 ? "start" : "middle"} dominantBaseline="middle" fill="#cbd5e1" fontSize="12">
          <tspan x={lx} dy="-5">{axis.name.length > 15 ? axis.name.slice(0, 14) + "…" : axis.name}</tspan>
          <tspan x={lx} dy="17" fill="#67e8f9" fontWeight="700">{axis.accuracy}%</tspan>
        </text>
      </g>;
    })}
    <polygon points={axes.map((axis, index) => point(index, axis.accuracy / 100).join(",")).join(" ")} fill="#22d3ee" fillOpacity="0.18" stroke="#67e8f9" strokeWidth="3" />
    {axes.map((axis, index) => { const [cx, cy] = point(index, axis.accuracy / 100); return <circle key={axis.id} cx={cx} cy={cy} r="4" fill="#a5f3fc" />; })}
  </svg>;
}

function SkillList({ skills, query, opening = false }: { skills: DashboardSkill[]; query: DashboardQuery; opening?: boolean }) {
  return <div className="divide-y divide-white/10">
    {skills.map((skill) => <div key={skill.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-words font-bold text-white">{skill.name}</h3><span className="text-lg font-black text-cyan-100">{skill.accuracy}%</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${skill.accuracy}%` }} /></div>
        <p className="mt-2 text-xs leading-5 text-slate-400">{skill.clean}/{skill.played} clean solves · {skill.averageRating === null ? "Unrated puzzles" : `Average puzzle level ${skill.averageRating}`}{skill.played < MIN_THEME_SAMPLE ? " · Still learning about you" : ""}</p>
      </div>
      <div className="flex flex-wrap gap-2 sm:pl-4">
        {!opening && puzzleThemeOptions.some((option) => option.id === skill.id) ? <Link className={linkButton} href={`/student/training?theme=${encodeURIComponent(skill.id)}`}>Train</Link> : null}
        <Link className={linkButton} href={dashboardHref(query, { view: skill.toReplay ? "replay" : "history", theme: opening ? "" : skill.id, opening: opening ? skill.id : "", outcome: "all" })}>{skill.toReplay ? `Replay ${skill.toReplay}` : "History"}</Link>
      </div>
    </div>)}
  </div>;
}

function PuzzleHistory({ data }: { data: PuzzleDashboardData }) {
  const { query } = data;
  return <Card className="p-4 sm:p-6">
    <h2 className="text-xl font-black text-white">{query.view === "replay" ? "Another chance to shine" : "Your puzzle journey"}</h2>
    <p className="mt-2 text-sm leading-6 text-slate-400">{query.view === "replay" ? "Solve the whole puzzle without a hint or a wrong move to clear it from this list. Replays do not change your original results or award XP, coins, badges, or quest progress." : "Clean means you solved it without hints or wrong moves. Helped means you finished after a hint or mistake. Missed means you left it unfinished."}</p>
    <form action="/student/training/dashboard" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="period" value={query.period} /><input type="hidden" name="view" value={query.view} />
      <label className="text-xs font-bold text-slate-300">Theme<select name="theme" defaultValue={query.theme} className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm text-white"><option value="">All themes</option>{data.themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-300">Opening<select name="opening" defaultValue={query.opening} className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm text-white"><option value="">All openings</option>{data.openings.map((opening) => <option key={opening.id} value={opening.id}>{opening.name}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-300">Result<select name="outcome" defaultValue={query.outcome} className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm text-white"><option value="all">All results</option><option value="clean">Clean</option><option value="helped">Helped</option><option value="missed">Missed</option></select></label>
      <button className={`${linkButton} self-end`} type="submit">Apply filters</button>
    </form>
    <p className="mt-5 text-sm text-slate-400">{data.historyCount} {query.view === "replay" ? "puzzles" : "attempts"} · Page {query.page} of {data.pageCount}</p>
    {!data.history.length ? <div className="py-10 text-center"><p className="font-bold text-white">{query.view === "replay" ? "No puzzles waiting here" : "No puzzles match these filters"}</p><p className="mt-2 text-sm text-slate-400">Try another time range, clear your filters, or keep training.</p><Link href={dashboardHref(query, { theme: "", opening: "", outcome: "all" })} className={`${linkButton} mt-4`}>Clear filters</Link></div> : <ul className="mt-3 divide-y divide-white/10">
      {data.history.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-1 text-xs font-black ${row.clean ? "bg-emerald-300/15 text-emerald-200" : row.solved ? "bg-amber-300/15 text-amber-200" : "bg-rose-300/15 text-rose-200"}`}>{row.clean ? "✓ Clean" : row.solved ? "↺ Helped" : "↗ Missed"}</span><span className="text-sm font-bold text-white">{row.rating === null ? "Unrated puzzle" : `Level ${row.rating}`}</span></div>
          <p className="mt-2 break-words text-sm text-slate-300">{row.themes.map(puzzleTagName).join(" · ") || "Mixed tactics"}</p>
          <p className="mt-1 text-xs text-slate-400"><time dateTime={row.attemptedAt}>{historyDate.format(new Date(row.attemptedAt))}</time> · {puzzleDuration(row.seconds)} · {row.mode === "legacy" ? "Practice" : puzzleTagName(row.mode)}</p>
        </div>
        {row.active && data.replayAvailable ? <Link className={linkButton} href={puzzleReplayHref(row.puzzleId, query)} prefetch={false}>Replay puzzle <span aria-hidden="true" className="ml-2">↗</span></Link> : <span className="text-xs text-slate-500">{row.active ? "Replay coming with update" : "Puzzle retired"}</span>}
      </li>)}
    </ul>}
    <nav aria-label="Puzzle history pages" className="mt-4 flex items-center justify-between gap-3">
      {query.page > 1 ? <Link className={linkButton} href={dashboardHref(query, { page: query.page - 1 })}>← Previous</Link> : <span />}
      {query.page < data.pageCount ? <Link className={linkButton} href={dashboardHref(query, { page: query.page + 1 })}>Next →</Link> : null}
    </nav>
  </Card>;
}

export function PuzzleDashboard({ data }: { data: PuzzleDashboardData }) {
  const { query } = data;
  const reliable = data.themes.filter((theme) => theme.played >= MIN_THEME_SAMPLE);
  const improvement = [...reliable].filter((theme) => theme.accuracy < 100).sort((a, b) => a.accuracy - b.accuracy || b.played - a.played);
  const strengths = [...reliable].filter((theme) => theme.accuracy >= 70).sort((a, b) => b.accuracy - a.accuracy || b.played - a.played);
  const focus = improvement[0];
  const focusHref = focus?.toReplay
    ? dashboardHref(query, { view: "replay", theme: focus.id, opening: "", outcome: "all" })
    : focus && puzzleThemeOptions.some((option) => option.id === focus.id)
      ? `/student/training?theme=${encodeURIComponent(focus.id)}`
      : "/student/training";
  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Train · Discover · Grow</p><h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">Small puzzles. Big progress.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">See what you have learned, find your next challenge, and turn mistakes into superpowers.</p></div>
      <form action="/student/training/dashboard" className="flex items-end gap-2">
        <input type="hidden" name="view" value={query.view} />
        <label className="text-xs font-bold text-slate-300">Time range<select name="period" defaultValue={query.period} className="mt-1 block min-h-11 rounded-lg border border-white/20 bg-slate-950 px-3 text-sm text-white"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select></label><button type="submit" className={linkButton}>Update</button>
      </form>
    </div>
    <div className="grid min-w-0 gap-5 xl:grid-cols-[190px_minmax(0,1fr)]">
      <nav aria-label="Puzzle dashboard" className="flex flex-wrap content-start gap-2 xl:flex-col">
        {navItems.map((item) => <Link key={item.id} aria-current={query.view === item.id ? "page" : undefined} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 ${query.view === item.id ? "border-cyan-200/50 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-slate-950/40 text-slate-300 hover:bg-white/10"}`} href={dashboardHref(query, { view: item.id, theme: "", opening: "", outcome: "all" })}><span aria-hidden="true" className="text-lg">{item.icon}</span>{item.label}{item.id === "replay" && data.toReplay ? <span className="ml-auto rounded bg-slate-950/50 px-1.5 text-xs">{data.toReplay}</span> : null}</Link>)}
        <Link className={linkButton} href="/student/training?mode=adaptiveReview">From my games ↗</Link>
        <Link className={linkButton} href="/student/training">← Training modes</Link>
      </nav>
      <div className="min-w-0 space-y-5">
        {!data.replayAvailable ? <p role="status" className="rounded-lg border border-amber-200/30 bg-amber-300/10 p-3 text-sm text-amber-100">Your results are ready. Saved replays will unlock when the database update is installed.</p> : null}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Played" value={data.played.toLocaleString("en-US")} detail={`${data.uniquePuzzles} different puzzles`} tone="slate" />
          <Metric label="Solved level" value={data.solvedLevel?.toLocaleString("en-US") ?? "—"} detail="Average level of clean solves" tone="amber" />
          <Metric label="Clean solves" value={data.played ? `${data.accuracy}%` : "—"} detail={`${data.clean} without hints or mistakes`} tone="emerald" />
          <Link className="rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200" href={dashboardHref(query, { view: "replay", theme: "", opening: "", outcome: "all" })}><Metric label="To replay ↗" value={String(data.toReplay)} detail="Try again. Learn the pattern." tone="cyan" /></Link>
        </div>
        {query.view === "overview" ? <>
          {!data.played ? <Card className="p-6 text-center"><h3 className="text-xl font-black text-white">Your next move starts your story</h3><p className="mt-2 text-sm leading-6 text-slate-300">No saved puzzle attempts in this time range yet. Play Survival, Woodpecker, or the daily puzzle, then come back to watch your progress grow.</p><Link className={`${linkButton} mt-4`} href="/student/training">Let’s train</Link></Card> : null}
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.8fr)]">
            <Card className="min-w-0 p-4 sm:p-6"><h3 className="text-xl font-black text-white">Your skill map</h3><p className="mt-2 text-sm text-slate-400">Farther out means more clean solves. The outer edge is 100%.</p><SkillRadar skills={data.themes} /><p className="text-xs leading-5 text-slate-400">Up to 8 most-practised themes with 5+ attempts. This is a learning snapshot, not a chess rating.</p></Card>
            <div className="space-y-5">
              <Card className="border-amber-300/25 bg-amber-300/[0.06] p-5"><p className="text-xs font-black uppercase tracking-widest text-amber-200">Your next small win</p><h3 className="mt-3 text-2xl font-black text-white">{focus ? `Practise ${focus.name.toLowerCase()}` : "Explore a new pattern"}</h3><p className="mt-3 text-sm leading-6 text-slate-300">{focus ? `${focus.clean} of ${focus.played} attempts were clean. Slow down, look for checks and captures, and picture the opponent’s reply before moving.` : "Try a mix of themes. Once you have 5 attempts in a theme, we can suggest what to practise next."}</p><Link className={`${linkButton} mt-4`} href={focusHref}>{focus?.toReplay ? `Replay ${focus.toReplay} puzzles` : "Choose some puzzles"}</Link></Card>
              <Card className="p-5"><p className="text-xs font-black uppercase tracking-widest text-violet-200">Keep showing up</p><p className="mt-3 text-3xl font-black text-white">{puzzleDuration(data.seconds)}</p><p className="mt-1 text-sm text-slate-400">Spent on saved puzzle attempts</p><p className="mt-4 text-sm leading-6 text-slate-300">You finished <strong className="text-white">{data.solved}</strong> of {data.played} attempts, including those with help. Every thoughtful retry is a chance to learn.</p></Card>
              <Card className="p-5"><h3 className="font-black text-white">Learn from your own games</h3><p className="mt-2 text-sm leading-6 text-slate-400">Review positions from your analyzed games alongside your Survival mistakes.</p><Link className={`${linkButton} mt-3`} href="/student/training?mode=adaptiveReview">Open mistake review ↗</Link></Card>
            </div>
          </div>
          <Card className="p-4 sm:p-6"><h3 className="text-xl font-black text-white">Your most-practised patterns</h3><SkillList skills={data.themes.slice(0, 6)} query={query} /><Link href={dashboardHref(query, { view: "themes" })} className={`${linkButton} mt-4`}>Explore all themes →</Link></Card>
        </> : query.view === "history" || query.view === "replay" ? <PuzzleHistory data={data} /> : <Card className="p-4 sm:p-6">
          <h2 className="text-2xl font-black text-white">{query.view === "improve" ? "What to practise next" : query.view === "strengths" ? "Look how far you’ve come" : query.view === "openings" ? "Patterns from the opening" : "Explore your puzzle themes"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{query.view === "improve" ? "Start with the themes where you needed the most help. We wait for 5 attempts before making a suggestion." : query.view === "strengths" ? "These themes have at least 5 attempts and 70% clean solves. Keep practising to make the pattern stick." : query.view === "openings" ? "Which openings led to your puzzle positions? Only puzzles with opening tags appear here. Review their positions through History or Replay." : "A puzzle can teach more than one pattern, so it may count in several themes. Compare the puzzle levels as well as the percentages."}</p>
          <SkillList skills={query.view === "improve" ? improvement : query.view === "strengths" ? strengths : query.view === "openings" ? data.openings : data.themes} query={query} opening={query.view === "openings"} />
          {!(query.view === "improve" ? improvement : query.view === "strengths" ? strengths : query.view === "openings" ? data.openings : data.themes).length ? <p className="mt-6 rounded-lg bg-white/5 p-5 text-sm text-slate-300">{query.view === "openings" ? "No opening-tagged puzzles in this time range yet." : "Keep exploring! We need a few more results before filling this section."}</p> : null}
          {query.view === "themes" ? <details className="mt-5 rounded-lg border border-white/10 p-4"><summary className="cursor-pointer font-bold text-cyan-100">Try a different theme</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{puzzleThemeOptions.filter((option) => option.id !== "mixed").map((option) => <Link key={option.id} href={`/student/training?theme=${option.id}`} className="rounded-lg border border-white/10 p-3 hover:bg-white/5"><p className="font-bold text-white">{option.name} ↗</p><p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p></Link>)}</div></details> : null}
        </Card>}
        <details className="rounded-lg border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400"><summary className="cursor-pointer font-bold text-slate-300">How to read your results</summary><div className="mt-3 space-y-2 leading-6"><p>Only puzzles played inside ChessQuest are counted. Repeated Survival and Woodpecker attempts count as practice; dashboard replays are separate. Star Wars, Hide and Seek, and game-review results stay in their own training stats.</p><p>Clean solves ÷ attempts gives the percentage. Solved level is the average catalog rating of clean solves, not your playing rating or a Lichess performance rating. Unrated puzzles are left out of that average.</p><p>To replay counts active puzzles whose latest attempt in this period was missed or helped, unless you cleared them afterward. One clean replay clears that puzzle, but a later training mistake can add it again.</p><p>Time ranges are rolling days. History dates use academy time (Bangkok).</p></div></details>
      </div>
    </div>
  </div>;
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "slate" | "amber" | "emerald" | "cyan" }) {
  const colors = { slate: "border-slate-500/40 bg-slate-800/65 text-slate-100", amber: "border-amber-300/30 bg-amber-300/10 text-amber-100", emerald: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100", cyan: "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" };
  return <div className={`h-full min-w-0 rounded-xl border p-4 sm:p-5 ${colors[tone]}`}><p className="text-[11px] font-black uppercase tracking-wider sm:text-xs">{label}</p><p className="mt-3 break-words text-3xl font-black tabular-nums sm:text-4xl">{value}</p><p className="mt-3 text-xs leading-5 opacity-80">{detail}</p></div>;
}
