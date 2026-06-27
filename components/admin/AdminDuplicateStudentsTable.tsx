"use client";

import { Card } from "@/components/Card";
import { students as seedStudents } from "@/data/students";
import { readAdminStore } from "@/lib/mockStorage";
import { detectDuplicateStudents } from "@/lib/students/detectDuplicateStudents";
import type { Student } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export function AdminDuplicateStudentsTable() {
  const [students, setStudents] = useState<Student[]>(seedStudents);

  useEffect(() => {
    const store = readAdminStore();
    setStudents(store.students ?? seedStudents);
  }, []);

  const duplicates = useMemo(() => detectDuplicateStudents(students), [students]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-black text-white">Possible Duplicate Students</h2>
        <p className="mt-1 text-sm text-slate-400">Use this after Lichess onboarding if a student accidentally creates a new profile.</p>
      </Card>
      <div className="grid gap-3">
        {duplicates.map((pair) => (
          <Card key={`${pair.student.id}-${pair.possibleDuplicate.id}`} className="p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Student</p>
                <p className="font-black text-white">{pair.student.name}</p>
                <p className="text-sm text-slate-400">{pair.student.classGroup} · {pair.student.lichessUsername ?? "No Lichess"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Possible Match</p>
                <p className="font-black text-white">{pair.possibleDuplicate.name}</p>
                <p className="text-sm text-slate-400">{pair.possibleDuplicate.classGroup} · {pair.possibleDuplicate.lichessUsername ?? "No Lichess"}</p>
              </div>
              <div className="text-sm">
                <p className="font-bold text-cyan-100">{pair.reason}</p>
                <Link className="mt-2 inline-flex rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-100" href={`/admin/students?student=${encodeURIComponent(pair.possibleDuplicate.slug)}`}>Review</Link>
              </div>
            </div>
          </Card>
        ))}
        {duplicates.length === 0 && <Card className="p-4 text-sm text-slate-300">No possible duplicates found.</Card>}
      </div>
    </div>
  );
}
