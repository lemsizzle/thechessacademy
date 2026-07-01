"use client";

import { Card } from "@/components/Card";
import { ADMIN_STORE_UPDATED_EVENT, readAdminStore } from "@/lib/mockStorage";
import { STUDENT_LICHESS_FULL_SYNC_EVENT } from "@/lib/studentLichessFullSync";
import type { Student } from "@/lib/types";
import { useEffect, useState } from "react";

export function StudentLichessQuestSummary({ student }: { student: Student }) {
  const [summary, setSummary] = useState({ count: 0, latest: "" });

  useEffect(() => {
    function loadSummary() {
    const completions = (readAdminStore().questCompletionEvents ?? [])
      .filter((event) => event.studentId === student.id)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    setSummary({
      count: completions.length,
      latest: completions[0] ? (readAdminStore().quests ?? []).find((quest) => quest.id === completions[0].questId)?.title ?? "Lichess quest" : ""
    });
    }

    loadSummary();
    window.addEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, loadSummary);
    window.addEventListener(ADMIN_STORE_UPDATED_EVENT, loadSummary);
    return () => {
      window.removeEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, loadSummary);
      window.removeEventListener(ADMIN_STORE_UPDATED_EVENT, loadSummary);
    };
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
