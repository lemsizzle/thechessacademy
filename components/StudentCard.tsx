import { StudentCallingCard } from "@/components/StudentCallingCard";
import { XpBar } from "@/components/XpBar";
import { getStudentXpWithLichess } from "@/lib/lichessXp";
import type { Student, StudentLichessAccount } from "@/lib/types";
import { getLevelFromXp, getLevelTitleFromXp } from "@/lib/xp";
import Link from "next/link";

export function StudentCard({ student, lichessAccount, profileBasePath = "/app/students" }: { student: Student; lichessAccount?: StudentLichessAccount; profileBasePath?: string }) {
  const xp = getStudentXpWithLichess(student, lichessAccount);
  const level = getLevelFromXp(xp.totalXp);
  const title = getLevelTitleFromXp(xp.totalXp);
  const borderClass = title.banner.split(" ").find((part) => part.startsWith("border-")) ?? "border-white/10";

  return (
    <Link
      href={`${profileBasePath}/${student.slug}`}
      className={`group relative block h-full overflow-hidden rounded-lg border bg-slate-950/70 p-3 shadow-glow backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-slate-950/85 ${borderClass}`}
    >
      <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-70" />
      <div className="absolute -right-10 -top-10 h-28 w-28 rotate-45 border border-white/10 bg-white/5 transition group-hover:scale-110" />
      <div className="relative">
        <StudentCallingCard name={student.name} classGroup={student.classGroup} lichessUsername={student.lichessUsername ?? student.slug} xp={xp.totalXp} />
        <div className="mt-4 rounded-md border border-white/10 bg-black/25 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase text-slate-400">Power XP</p>
            <p className="text-xs font-black text-amber-100">Lv {level}</p>
          </div>
          <XpBar xp={xp.totalXp} />
          {xp.lichessXp > 0 && <p className="mt-2 text-xs font-bold text-cyan-100">Includes {xp.lichessXp.toLocaleString()} Lichess XP</p>}
        </div>
      </div>
    </Link>
  );
}
