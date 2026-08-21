import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { AdminChessPerformanceReport, StudentChessPerformance } from "@/chess/performance/types";

const RESULT_STYLES = {
  win: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  draw: "border-slate-300/30 bg-slate-300/10 text-slate-100",
  loss: "border-rose-300/30 bg-rose-300/10 text-rose-100"
} as const;
const DATE_FORMATTER = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

function formatDate(value: string | null) {
  if (!value) return "No games yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return DATE_FORMATTER.format(date);
}

function MetricCard({ label, value, detail, tone = "text-white" }: {
  label: string;
  value: string | number;
  detail: string;
  tone?: string;
}) {
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </Card>
  );
}

function LatestResult({ student }: { student: StudentChessPerformance }) {
  if (!student.latestResult) return <span className="text-slate-500">No games</span>;
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase ${RESULT_STYLES[student.latestResult]}`}>
      {student.latestResult}
    </span>
  );
}

function StudentActions({ student }: { student: StudentChessPerformance }) {
  return (
    <div className="flex flex-wrap gap-2">
      {student.latestGameId ? (
        <Button href={`/admin/play/game/${encodeURIComponent(student.latestGameId)}/analysis`} variant="secondary" className="px-3 py-1.5 text-xs">
          Analyze latest
        </Button>
      ) : null}
      <Button href={`/admin/students?student=${encodeURIComponent(student.id)}`} variant="ghost" className="px-3 py-1.5 text-xs">
        Manage student
      </Button>
    </div>
  );
}

export function AdminChessPerformance({ report }: { report: AdminChessPerformanceReport }) {
  const { summary } = report;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Completed games" value={summary.totalGames} detail={`${summary.computerGames} computer · ${summary.liveGames} live`} />
        <MetricCard label="Active players" value={summary.activePlayers} detail={`of ${summary.students} students in view`} tone="text-cyan-200" />
        <MetricCard label="Last 30 days" value={summary.gamesLast30Days} detail="Recently completed games" tone="text-emerald-200" />
        <MetricCard
          label="Participation"
          value={summary.students > 0 ? `${Math.round((summary.activePlayers / summary.students) * 100)}%` : "0%"}
          detail="Students with a saved game"
          tone="text-amber-200"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Internal chess</p>
            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Student performance</h2>
            <p className="mt-1 text-sm text-slate-400">Computer and live results saved by the academy play system.</p>
          </div>
          <form className="flex items-end gap-2" method="get">
            <label className="text-xs font-bold text-slate-300">
              Class
              <select
                aria-label="Filter chess performance by class"
                className="mt-1 block min-w-44 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                defaultValue={report.selectedClass}
                name="class"
              >
                <option value="all">All classes</option>
                {report.classes.map((classGroup) => <option key={classGroup} value={classGroup}>{classGroup}</option>)}
              </select>
            </label>
            <Button type="submit" variant="secondary">Apply</Button>
          </form>
        </div>

        {report.students.length === 0 ? (
          <div className="grid min-h-52 place-items-center p-6 text-center">
            <div>
              <p className="text-lg font-black text-white">No active students in this class.</p>
              <p className="mt-1 text-sm text-slate-400">Choose another class to review its chess activity.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-black">Student</th>
                    <th className="px-4 py-3 font-black">Record</th>
                    <th className="px-4 py-3 font-black">Win rate</th>
                    <th className="px-4 py-3 font-black">Modes</th>
                    <th className="px-4 py-3 font-black">Latest</th>
                    <th className="px-5 py-3 font-black">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {report.students.map((student) => (
                    <tr key={student.id} className="align-middle">
                      <td className="px-5 py-4">
                        <p className="font-black text-white">{student.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{student.classGroup}</p>
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-200">{student.wins}–{student.draws}–{student.losses}</td>
                      <td className="px-4 py-4 text-slate-300">{student.total ? `${student.winRate}%` : "—"}</td>
                      <td className="px-4 py-4 text-slate-300">{student.computerGames} computer · {student.liveGames} live</td>
                      <td className="px-4 py-4">
                        <LatestResult student={student} />
                        <p className="mt-2 whitespace-nowrap text-xs text-slate-500">{formatDate(student.lastPlayedAt)}</p>
                      </td>
                      <td className="px-5 py-4"><StudentActions student={student} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-white/10 md:hidden">
              {report.students.map((student) => (
                <li key={student.id} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-white">{student.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{student.classGroup}</p>
                    </div>
                    <LatestResult student={student} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-white/5 p-2"><strong className="block text-base text-white">{student.wins}–{student.draws}–{student.losses}</strong><span className="text-slate-500">W–D–L</span></div>
                    <div className="rounded-md bg-white/5 p-2"><strong className="block text-base text-white">{student.total ? `${student.winRate}%` : "—"}</strong><span className="text-slate-500">Win rate</span></div>
                    <div className="rounded-md bg-white/5 p-2"><strong className="block text-base text-white">{student.total}</strong><span className="text-slate-500">Games</span></div>
                  </div>
                  <p className="text-xs text-slate-400">Last played: {formatDate(student.lastPlayedAt)}</p>
                  <StudentActions student={student} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
