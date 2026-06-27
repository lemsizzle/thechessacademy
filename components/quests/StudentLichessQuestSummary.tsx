"use client";

import { Card } from "@/components/Card";
import { readAdminStore } from "@/lib/mockStorage";
import type { Student } from "@/lib/types";
import { useEffect, useState } from "react";

export function StudentLichessQuestSummary({ student }: { student: Student }) {
  const [summary, setSummary] = useState({ count: 0, latest: "" });

  useEffect(() => {
    const completions = (readAdminStore().questCompletionEvents ?? [])
      .filter((event) => event.studentId === student.id)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    setSummary({
      count: completions.length,
      latest: completions[0] ? (readAdminStore().quests ?? []).find((quest) => quest.id === completions[0].questId)?.title ?? "Lichess quest" : ""
    });
  }, [student.id]);

  if (!summary.count) return null;
  return (
    <Card className="p-4">
      <p className="text-xs font-black uppercase text-cyan-100">Lichess Quests</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-2xl font-black text-white">{summary.count}</p><p className="text-xs text-slate-400">approved completions</p></div>
        <p className="text-sm font-bold text-amber-100">Latest: {summary.latest}</p>
      </div>
    </Card>
  );
}
