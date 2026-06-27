"use client";

import { Card } from "@/components/Card";
import { classGroups } from "@/data/classGroups";
import type { Student } from "@/lib/types";

export function StudentProfileSettings({ student }: { student: Student }) {
  return (
    <Card className="p-4">
      <h2 className="font-black text-white">Profile Settings</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Display Name
          <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" defaultValue={student.name} readOnly />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Class Group
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" defaultValue={student.classGroup} disabled>
            {classGroups.map((group) => <option key={group.id}>{group.name}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-slate-400">Profile edits are read-only in this local version. The teacher can adjust student records from the admin dashboard.</p>
    </Card>
  );
}
