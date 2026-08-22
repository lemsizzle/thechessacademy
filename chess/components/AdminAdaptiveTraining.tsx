import Link from "next/link";
import type { AdminAdaptiveReviewStudent } from "@/chess/training/adaptiveReviewServer";
import { Card } from "@/components/Card";

export function AdminAdaptiveTraining({ students }: { students: AdminAdaptiveReviewStudent[] }) {
  const totals = students.reduce((sum, student) => ({
    positions: sum.positions + student.total,
    due: sum.due + student.due,
    mastered: sum.mastered + student.mastered,
    attempts: sum.attempts + student.attempts,
    correct: sum.correct + student.correct
  }), { positions: 0, due: 0, mastered: 0, attempts: 0, correct: 0 });
  const accuracy = totals.attempts ? Math.round((totals.correct / totals.attempts) * 100) : 0;

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {[["Students", students.filter((student) => student.total > 0).length], ["Positions", totals.positions], ["Due now", totals.due], ["Mastered", totals.mastered], ["Accuracy", `${accuracy}%`]].map(([label, value]) => <Card key={String(label)} className="p-4 text-center"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p></Card>)}
    </div>
    <Card className="overflow-hidden p-0">
      <div className="border-b border-white/10 p-4"><h2 className="font-black text-white">Student review progress</h2><p className="mt-1 text-sm text-slate-400">Students with no analyzed game mistakes remain visible.</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Positions</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Learning</th><th className="px-4 py-3">Mastered</th><th className="px-4 py-3">Accuracy</th><th className="px-4 py-3">Last review</th></tr></thead>
          <tbody className="divide-y divide-white/10">
            {students.map((student) => <tr key={student.studentId} className="text-slate-200"><td className="px-4 py-3 font-black text-white"><Link href={`/admin/students/${student.studentId}`} className="hover:text-cyan-200">{student.name}</Link></td><td className="px-4 py-3">{student.classGroup || "—"}</td><td className="px-4 py-3">{student.total}</td><td className="px-4 py-3 font-black text-violet-200">{student.due}</td><td className="px-4 py-3">{student.learning}</td><td className="px-4 py-3 text-emerald-200">{student.mastered}</td><td className="px-4 py-3">{student.attempts ? `${student.accuracy}% (${student.attempts})` : "—"}</td><td className="px-4 py-3 text-xs text-slate-400">{student.lastReviewedAt ? new Date(student.lastReviewedAt).toLocaleDateString() : "Not started"}</td></tr>)}
          </tbody>
        </table>
      </div>
    </Card>
  </div>;
}
