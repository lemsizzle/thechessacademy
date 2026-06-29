"use client";

import type { Student, XpEvent } from "@/lib/types";

type PersistXpResult = {
  ok?: boolean;
  mode?: "local-only";
  skipped?: boolean;
  student?: Student;
  event?: XpEvent;
  error?: string;
};

export async function persistStudentXpChange(student: Student, xpAmount: number, reason: string) {
  const response = await fetch(`/api/admin/students/${encodeURIComponent(student.id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      xpAmount,
      reason,
      slug: student.slug,
      lichessUsername: student.lichessUsername
    })
  });
  const data = await response.json().catch(() => ({})) as PersistXpResult;
  if (!response.ok) throw new Error(data.error ?? "Could not save XP.");
  return data;
}
